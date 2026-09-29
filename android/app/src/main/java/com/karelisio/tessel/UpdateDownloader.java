package com.karelisio.tessel;

import android.os.SystemClock;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Téléchargement d'une mise à jour APK : reprise via l'en-tête Range, redirections manuelles
 * (jusqu'à 5, y compris vers un autre hôte), SHA-256 calculé en flux, annulation propre.
 *
 * <p>Le fichier est écrit dans {@code <cache>/updates/<nom>.part} puis renommé une fois vérifié.
 * À utiliser depuis un thread de fond uniquement.
 */
final class UpdateDownloader {

    /** Rappel de progression, invoqué au plus toutes les 100 ms depuis le thread de téléchargement. */
    interface ProgressListener {
        void onProgress(long downloaded, long total);
    }

    /** Échec typé : {@code code} vaut "network", "cancelled", "checksum_mismatch" ou "io". */
    static final class DownloadException extends Exception {
        final String code;

        DownloadException(String code, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
        }
    }

    private static final int MAX_REDIRECTS = 5;
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 30_000;
    private static final long PROGRESS_INTERVAL_MS = 100;
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final Pattern CONTENT_RANGE = Pattern.compile("bytes\\s+(\\d+)-(\\d+)/(\\d+|\\*)");

    private final File updatesDir;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile boolean cancelled;
    private volatile HttpURLConnection connection;

    UpdateDownloader(File cacheDir) {
        this.updatesDir = new File(cacheDir, "updates");
    }

    /** Demande l'arrêt du téléchargement en cours ; le fichier .part est conservé pour la reprise. */
    void cancel() {
        cancelled = true;
        HttpURLConnection c = connection;
        if (c != null) {
            c.disconnect();
        }
    }

    /**
     * Télécharge et vérifie le fichier.
     *
     * @return le fichier final (renommé depuis .part)
     */
    File download(String url, String fileName, String sha256, long expectedSize, ProgressListener listener)
        throws DownloadException {
        if (!running.compareAndSet(false, true)) {
            throw new DownloadException("io", "Un téléchargement est déjà en cours", null);
        }
        cancelled = false;
        try {
            return doDownload(url, fileName, sha256, expectedSize, listener);
        } finally {
            HttpURLConnection c = connection;
            connection = null;
            if (c != null) {
                c.disconnect();
            }
            running.set(false);
        }
    }

    private File doDownload(String url, String fileName, String sha256, long expectedSize, ProgressListener listener)
        throws DownloadException {
        String name = new File(fileName).getName();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) {
            throw new DownloadException("io", "Nom de fichier invalide", null);
        }
        if (!updatesDir.isDirectory() && !updatesDir.mkdirs()) {
            throw new DownloadException("io", "Impossible de créer le dossier de mise à jour", null);
        }
        File finalFile = new File(updatesDir, name);
        File part = new File(updatesDir, name + ".part");
        String expectedHash = sha256.trim().toLowerCase(Locale.ROOT);

        long offset = part.isFile() ? part.length() : 0;
        HttpURLConnection conn = open(url, offset);
        int status = responseCode(conn);
        if (status == 416 && offset > 0) {
            // Plage refusée (.part périmé ou déjà complet) : on repart de zéro.
            conn.disconnect();
            if (!part.delete()) {
                throw new DownloadException("io", "Impossible de supprimer le fichier partiel", null);
            }
            offset = 0;
            conn = open(url, 0);
            status = responseCode(conn);
        }

        boolean append;
        long total;
        if (status == 206 && offset > 0) {
            append = true;
            total = totalFromPartial(conn, offset);
        } else if (status == 200) {
            append = false;
            offset = 0;
            long length = conn.getContentLengthLong();
            total = length > 0 ? length : Math.max(expectedSize, 0);
        } else {
            throw new DownloadException("network", "Réponse HTTP inattendue : " + status, null);
        }

        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new DownloadException("io", "SHA-256 indisponible", e);
        }
        if (append) {
            hashExisting(part, digest);
        }

        long downloaded = offset;
        InputStream in = null;
        FileOutputStream out = null;
        try {
            try {
                in = conn.getInputStream();
            } catch (IOException e) {
                throw failedRead(e);
            }
            try {
                out = new FileOutputStream(part, append);
            } catch (IOException e) {
                throw new DownloadException("io", "Écriture impossible : " + e.getMessage(), e);
            }

            listener.onProgress(downloaded, total);
            long lastEmit = SystemClock.elapsedRealtime();
            byte[] buffer = new byte[BUFFER_SIZE];
            while (true) {
                if (cancelled) {
                    throw new DownloadException("cancelled", "Téléchargement annulé", null);
                }
                int read;
                try {
                    read = in.read(buffer);
                } catch (IOException e) {
                    throw failedRead(e);
                }
                if (read < 0) {
                    break;
                }
                try {
                    out.write(buffer, 0, read);
                } catch (IOException e) {
                    throw new DownloadException("io", "Écriture impossible : " + e.getMessage(), e);
                }
                digest.update(buffer, 0, read);
                downloaded += read;
                long now = SystemClock.elapsedRealtime();
                if (now - lastEmit >= PROGRESS_INTERVAL_MS) {
                    lastEmit = now;
                    listener.onProgress(downloaded, total);
                }
            }
            try {
                out.flush();
            } catch (IOException e) {
                throw new DownloadException("io", "Écriture impossible : " + e.getMessage(), e);
            }
        } finally {
            closeQuietly(in);
            closeQuietly(out);
            conn.disconnect();
        }

        if (total > 0 && downloaded != total) {
            // Flux coupé avant la fin : le .part est conservé pour une reprise.
            throw new DownloadException("network", "Téléchargement incomplet", null);
        }
        listener.onProgress(downloaded, total > 0 ? total : downloaded);

        String actualHash = toHex(digest.digest());
        if (!actualHash.equals(expectedHash)) {
            if (!part.delete()) {
                part.deleteOnExit();
            }
            throw new DownloadException("checksum_mismatch", "Somme de contrôle invalide", null);
        }

        if (finalFile.exists() && !finalFile.delete()) {
            throw new DownloadException("io", "Impossible de remplacer l'ancien fichier", null);
        }
        if (!part.renameTo(finalFile)) {
            throw new DownloadException("io", "Impossible de finaliser le fichier", null);
        }
        return finalFile;
    }

    /** Ouvre la connexion en suivant les redirections à la main (changements d'hôte et de protocole inclus). */
    private HttpURLConnection open(String url, long offset) throws DownloadException {
        URL current = parseUrl(url);
        boolean secure = current.getProtocol().equals("https");
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            if (cancelled) {
                throw new DownloadException("cancelled", "Téléchargement annulé", null);
            }
            try {
                HttpURLConnection c = (HttpURLConnection) current.openConnection();
                connection = c;
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(CONNECT_TIMEOUT_MS);
                c.setReadTimeout(READ_TIMEOUT_MS);
                c.setRequestProperty("User-Agent", "Tessel");
                // Pas de compression : Range et Content-Length doivent refléter les octets du fichier.
                c.setRequestProperty("Accept-Encoding", "identity");
                if (offset > 0) {
                    c.setRequestProperty("Range", "bytes=" + offset + "-");
                }
                int status = c.getResponseCode();
                if (isRedirect(status)) {
                    String location = c.getHeaderField("Location");
                    c.disconnect();
                    if (location == null) {
                        throw new DownloadException("network", "Redirection sans destination", null);
                    }
                    current = new URL(current, location);
                    String protocol = current.getProtocol();
                    boolean ok = protocol.equals("https") || (protocol.equals("http") && !secure);
                    if (!ok) {
                        throw new DownloadException("network", "Redirection vers un protocole refusé", null);
                    }
                    secure = protocol.equals("https");
                    continue;
                }
                return c;
            } catch (IOException e) {
                throw failedRead(e);
            }
        }
        throw new DownloadException("network", "Trop de redirections", null);
    }

    private static URL parseUrl(String url) throws DownloadException {
        try {
            URL parsed = new URL(url);
            String protocol = parsed.getProtocol();
            if (!protocol.equals("https") && !protocol.equals("http")) {
                throw new DownloadException("network", "Protocole non pris en charge : " + protocol, null);
            }
            return parsed;
        } catch (MalformedURLException e) {
            throw new DownloadException("network", "URL invalide", e);
        }
    }

    private static boolean isRedirect(int status) {
        return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
    }

    private int responseCode(HttpURLConnection conn) throws DownloadException {
        try {
            return conn.getResponseCode();
        } catch (IOException e) {
            throw failedRead(e);
        }
    }

    /** Taille totale d'une réponse 206 : Content-Range en priorité, sinon décalage + Content-Length. */
    private static long totalFromPartial(HttpURLConnection conn, long offset) {
        String header = conn.getHeaderField("Content-Range");
        if (header != null) {
            Matcher m = CONTENT_RANGE.matcher(header);
            if (m.find() && !m.group(3).equals("*")) {
                return Long.parseLong(m.group(3));
            }
        }
        long length = conn.getContentLengthLong();
        return length > 0 ? offset + length : 0;
    }

    /** Ré-alimente le hachage avec la partie déjà présente sur disque (cas de la reprise). */
    private void hashExisting(File part, MessageDigest digest) throws DownloadException {
        byte[] buffer = new byte[BUFFER_SIZE];
        try (FileInputStream existing = new FileInputStream(part)) {
            int read;
            while ((read = existing.read(buffer)) >= 0) {
                if (cancelled) {
                    throw new DownloadException("cancelled", "Téléchargement annulé", null);
                }
                digest.update(buffer, 0, read);
            }
        } catch (IOException e) {
            throw new DownloadException("io", "Lecture du fichier partiel impossible : " + e.getMessage(), e);
        }
    }

    /** Une erreur réseau provoquée par {@link #cancel()} est rapportée comme une annulation. */
    private DownloadException failedRead(IOException e) {
        if (cancelled) {
            return new DownloadException("cancelled", "Téléchargement annulé", e);
        }
        return new DownloadException("network", "Erreur réseau : " + e.getMessage(), e);
    }

    private static void closeQuietly(java.io.Closeable closeable) {
        if (closeable == null) {
            return;
        }
        try {
            closeable.close();
        } catch (IOException ignored) {
            // rien à faire : le fichier est vérifié par sa somme de contrôle
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format(Locale.ROOT, "%02x", b));
        }
        return sb.toString();
    }
}
