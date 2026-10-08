package com.karelisio.tessel;

import android.Manifest;
import android.app.WallpaperManager;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.MimeTypeMap;
import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Plugin Capacitor local de Tessel : mise à jour APK, fond d'écran, couleurs dynamiques (Material You),
 * haptique fine et enregistrement en galerie.
 */
@CapacitorPlugin(
    name = "TesselNative",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class TesselNativePlugin extends Plugin {

    /** Tons Material You exposés, dans l'ordre attendu côté TypeScript. */
    private static final int[] TONES = { 0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000 };

    private static final String[] PALETTES = { "accent1", "accent2", "accent3", "neutral1", "neutral2" };

    // Deux files distinctes : une annulation ou un téléchargement long ne bloque jamais le reste.
    private final ExecutorService downloadExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private UpdateDownloader downloader;

    @Override
    public void load() {
        downloader = new UpdateDownloader(getContext().getCacheDir());
    }

    @Override
    protected void handleOnDestroy() {
        if (downloader != null) {
            downloader.cancel();
        }
        downloadExecutor.shutdown();
        ioExecutor.shutdown();
    }

    // ---------------------------------------------------------------- informations

    @PluginMethod
    public void getBuildInfo(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            PackageInfo info;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                info = pm.getPackageInfo(context.getPackageName(), PackageManager.PackageInfoFlags.of(0));
            } else {
                info = getPackageInfoLegacy(pm, context.getPackageName());
            }
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : legacyVersionCode(info);
            JSObject result = new JSObject();
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            result.put("versionCode", code);
            result.put("sdkInt", Build.VERSION.SDK_INT);
            call.resolve(result);
        } catch (PackageManager.NameNotFoundException e) {
            call.reject("Informations de version introuvables", "io", e);
        }
    }

    @SuppressWarnings("deprecation")
    private static PackageInfo getPackageInfoLegacy(PackageManager pm, String packageName)
        throws PackageManager.NameNotFoundException {
        return pm.getPackageInfo(packageName, 0);
    }

    @SuppressWarnings("deprecation")
    private static long legacyVersionCode(PackageInfo info) {
        return info.versionCode;
    }

    // ---------------------------------------------------------------- couleurs dynamiques

    @PluginMethod
    public void getDynamicColors(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            result.put("available", false);
            call.resolve(result);
            return;
        }
        try {
            Context context = getContext();
            JSObject palettes = new JSObject();
            for (String palette : PALETTES) {
                JSArray tones = new JSArray();
                for (int tone : TONES) {
                    // Équivalent de android.R.color.system_<palette>_<ton>, résolu par nom.
                    int id = context.getResources().getIdentifier("system_" + palette + "_" + tone, "color", "android");
                    if (id == 0) {
                        throw new IllegalStateException("Couleur système absente : " + palette + "_" + tone);
                    }
                    // Entier ARGB non signé (0xAARRGGBB) pour rester positif côté JavaScript.
                    tones.put(ContextCompat.getColor(context, id) & 0xFFFFFFFFL);
                }
                palettes.put(palette, tones);
            }
            result.put("available", true);
            result.put("palettes", palettes);
        } catch (RuntimeException e) {
            result = new JSObject();
            result.put("available", false);
        }
        call.resolve(result);
    }

    // ---------------------------------------------------------------- haptique

    /**
     * Attributs d'une vibration de jeu jusqu'à Android 12 (l'usage « jeu » y devient l'usage « média »).
     * Sans attributs, Android range toute vibration courte dans le retour tactile, que beaucoup de
     * téléphones coupent (vibration au toucher désactivée dans les réglages du système).
     */
    private static final AudioAttributes GAME_ATTRIBUTES = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_GAME)
        .build();

    /** Vibration du jeu en forme d'onde : segments de `timings` ms, chacun à son amplitude (0 à 255). */
    @PluginMethod
    public void vibrate(PluginCall call) {
        long[] timings = numbers(call.getArray("timings"), 0, 10_000);
        long[] levels = numbers(call.getArray("amplitudes"), 0, 255);
        if (timings == null || levels == null || timings.length == 0 || timings.length != levels.length) {
            call.reject("Forme d'onde invalide");
            return;
        }
        int[] amplitudes = new int[levels.length];
        for (int i = 0; i < levels.length; i++) {
            amplitudes[i] = (int) levels[i];
        }
        Vibrator vibrator = getVibrator();
        boolean played = vibrator != null && vibrator.hasVibrator();
        if (played) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                play(vibrator, VibrationEffect.createWaveform(timings, amplitudes, -1));
            } else {
                playLegacy(vibrator, onOffPattern(timings, amplitudes));
            }
        }
        JSObject result = new JSObject();
        result.put("played", played);
        call.resolve(result);
    }

    /** Entiers d'un tableau JS, bornés ; null s'il manque ou contient autre chose qu'un nombre. */
    private static long[] numbers(JSArray array, long min, long max) {
        if (array == null) {
            return null;
        }
        long[] out = new long[array.length()];
        for (int i = 0; i < out.length; i++) {
            double value = array.optDouble(i, Double.NaN);
            if (Double.isNaN(value)) {
                return null;
            }
            out[i] = Math.max(min, Math.min(max, Math.round(value)));
        }
        return out;
    }

    /** Joue un effet avec les attributs d'un jeu (usage « média »). */
    @RequiresApi(Build.VERSION_CODES.O)
    @SuppressWarnings("deprecation")
    private static void play(Vibrator vibrator, VibrationEffect effect) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_MEDIA));
        } else {
            vibrator.vibrate(effect, GAME_ATTRIBUTES);
        }
    }

    /** Android 7 : motif marche/arrêt (pause, vibration, pause…), sans réglage d'amplitude. */
    @SuppressWarnings("deprecation")
    private static void playLegacy(Vibrator vibrator, long[] pattern) {
        vibrator.vibrate(pattern, -1, GAME_ATTRIBUTES);
    }

    /** Forme d'onde → motif marche/arrêt des anciens Android, qui commence toujours par une pause. */
    private static long[] onOffPattern(long[] timings, int[] amplitudes) {
        ArrayList<Long> runs = new ArrayList<>();
        boolean on = false;
        long run = 0;
        for (int i = 0; i < timings.length; i++) {
            boolean segment = amplitudes[i] > 0;
            if (segment != on) {
                runs.add(run);
                run = 0;
                on = segment;
            }
            run += timings[i];
        }
        runs.add(run);
        long[] pattern = new long[runs.size()];
        for (int i = 0; i < pattern.length; i++) {
            pattern[i] = runs.get(i);
        }
        return pattern;
    }

    @PluginMethod
    public void haptic(PluginCall call) {
        String primitive = call.getString("primitive");
        if (primitive == null) {
            call.reject("Paramètre « primitive » manquant");
            return;
        }
        float scale = Math.max(0f, Math.min(1f, call.getFloat("scale", 1f)));
        Vibrator vibrator = getVibrator();
        JSObject result = new JSObject();
        if (vibrator == null || !vibrator.hasVibrator()) {
            result.put("usedPrimitives", false);
            call.resolve(result);
            return;
        }

        boolean usedPrimitives = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            int id = primitiveId(primitive);
            if (id != -1 && vibrator.arePrimitivesSupported(id)[0]) {
                play(vibrator, VibrationEffect.startComposition().addPrimitive(id, scale).compose());
                usedPrimitives = true;
            }
        }
        if (!usedPrimitives) {
            fallbackVibration(vibrator, primitive, scale);
        }
        result.put("usedPrimitives", usedPrimitives);
        call.resolve(result);
    }

    /** Identifiant de primitive (API 30+), ou -1 si inconnue. */
    private static int primitiveId(String primitive) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return -1;
        }
        switch (primitive) {
            case "tick":
                return VibrationEffect.Composition.PRIMITIVE_TICK;
            case "lowTick":
                return VibrationEffect.Composition.PRIMITIVE_LOW_TICK;
            case "click":
                return VibrationEffect.Composition.PRIMITIVE_CLICK;
            case "thud":
                return VibrationEffect.Composition.PRIMITIVE_THUD;
            case "spin":
                return VibrationEffect.Composition.PRIMITIVE_SPIN;
            case "quickRise":
                return VibrationEffect.Composition.PRIMITIVE_QUICK_RISE;
            default:
                return -1;
        }
    }

    private static void fallbackVibration(Vibrator vibrator, String primitive, float scale) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int effect;
            switch (primitive) {
                case "tick":
                case "lowTick":
                    effect = VibrationEffect.EFFECT_TICK;
                    break;
                case "thud":
                    effect = VibrationEffect.EFFECT_HEAVY_CLICK;
                    break;
                default:
                    effect = VibrationEffect.EFFECT_CLICK;
                    break;
            }
            play(vibrator, VibrationEffect.createPredefined(effect));
            return;
        }
        long duration = "tick".equals(primitive) || "lowTick".equals(primitive) ? 10 : "thud".equals(primitive) ? 20 : 15;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            int amplitude = Math.max(1, Math.min(255, Math.round(255 * scale)));
            play(vibrator, VibrationEffect.createOneShot(duration, amplitude));
        } else {
            playLegacy(vibrator, new long[] { 0, duration });
        }
    }

    private Vibrator getVibrator() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return getVibratorLegacy(context);
    }

    @SuppressWarnings("deprecation")
    private static Vibrator getVibratorLegacy(Context context) {
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    // ---------------------------------------------------------------- installation

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", canInstall());
        call.resolve(result);
    }

    private boolean canInstall() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return true;
        }
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Réglages d'installation introuvables", "io", e);
        }
    }

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        final String url = call.getString("url");
        final String fileName = call.getString("fileName");
        final String sha256 = call.getString("sha256");
        if (url == null || fileName == null || sha256 == null) {
            call.reject("Paramètres « url », « fileName » et « sha256 » requis");
            return;
        }
        final long size = call.getLong("size", 0L);
        downloadExecutor.execute(() -> {
            try {
                File file = downloader.download(url, fileName, sha256, size, (downloaded, total) -> {
                    JSObject event = new JSObject();
                    event.put("downloaded", downloaded);
                    event.put("total", total);
                    notifyListeners("downloadProgress", event);
                });
                JSObject result = new JSObject();
                result.put("path", file.getAbsolutePath());
                call.resolve(result);
            } catch (UpdateDownloader.DownloadException e) {
                call.reject(e.getMessage(), e.code, e);
            } catch (RuntimeException e) {
                call.reject("Erreur inattendue : " + e.getMessage(), "io", e);
            }
        });
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        downloader.cancel();
        call.resolve();
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        File file = resolveFile(call.getString("path"));
        if (file == null || !file.isFile()) {
            call.reject("Fichier APK introuvable", "io");
            return;
        }
        if (!canInstall()) {
            call.reject("Installation depuis cette application non autorisée", "install_not_allowed");
            return;
        }
        try {
            Context context = getContext();
            Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (IllegalArgumentException | ActivityNotFoundException e) {
            call.reject("Impossible de lancer l'installation : " + e.getMessage(), "io", e);
        }
    }

    // ---------------------------------------------------------------- fond d'écran

    @PluginMethod
    public void setWallpaper(PluginCall call) {
        final File file = resolveFile(call.getString("path"));
        final String target = call.getString("target", "both");
        if (file == null || !file.isFile()) {
            call.reject("Image introuvable", "io");
            return;
        }
        final int flags;
        if ("home".equals(target)) {
            flags = WallpaperManager.FLAG_SYSTEM;
        } else if ("lock".equals(target)) {
            flags = WallpaperManager.FLAG_LOCK;
        } else if ("both".equals(target)) {
            flags = WallpaperManager.FLAG_SYSTEM | WallpaperManager.FLAG_LOCK;
        } else {
            call.reject("Cible de fond d'écran invalide : " + target);
            return;
        }
        ioExecutor.execute(() -> {
            WallpaperManager manager = WallpaperManager.getInstance(getContext());
            if (!manager.isWallpaperSupported() || !manager.isSetWallpaperAllowed()) {
                call.reject("Changement de fond d'écran non autorisé", "wallpaper_unavailable");
                return;
            }
            try (InputStream in = new FileInputStream(file)) {
                manager.setStream(in, null, true, flags);
                call.resolve();
            } catch (IOException | SecurityException e) {
                call.reject("Échec du changement de fond d'écran : " + e.getMessage(), "io", e);
            }
        });
    }

    // ---------------------------------------------------------------- galerie

    @PluginMethod
    public void saveToGallery(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
            return;
        }
        runSaveToGallery(call);
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            runSaveToGallery(call);
        } else {
            call.reject("Permission de stockage refusée", "permission_denied");
        }
    }

    private void runSaveToGallery(PluginCall call) {
        final File source = resolveFile(call.getString("path"));
        final String mimeType = call.getString("mimeType");
        final String rawName = call.getString("displayName");
        final String rawAlbum = call.getString("album", "Tessel");
        if (source == null || !source.isFile()) {
            call.reject("Fichier source introuvable", "io");
            return;
        }
        if (mimeType == null || rawName == null) {
            call.reject("Paramètres « mimeType » et « displayName » requis");
            return;
        }
        final boolean video = mimeType.startsWith("video/");
        if (!video && !mimeType.startsWith("image/")) {
            call.reject("Type non pris en charge : " + mimeType, "unsupported_type");
            return;
        }
        final String displayName = withExtension(sanitize(rawName), mimeType);
        final String album = sanitize(rawAlbum == null || rawAlbum.isEmpty() ? "Tessel" : rawAlbum);
        final String publicDir = video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES;

        ioExecutor.execute(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    saveWithMediaStore(call, source, mimeType, displayName, publicDir + "/" + album, video);
                } else {
                    saveLegacy(call, source, mimeType, displayName, publicDir, album);
                }
            } catch (IOException | RuntimeException e) {
                call.reject("Enregistrement en galerie impossible : " + e.getMessage(), "io", e);
            }
        });
    }

    private void saveWithMediaStore(
        PluginCall call,
        File source,
        String mimeType,
        String displayName,
        String relativePath,
        boolean video
    ) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        Uri collection = video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = resolver.insert(collection, values);
        if (uri == null) {
            throw new IOException("insertion MediaStore refusée");
        }
        try (InputStream in = new FileInputStream(source); OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) {
                throw new IOException("flux de sortie MediaStore indisponible");
            }
            copy(in, out);
        } catch (IOException | RuntimeException e) {
            resolver.delete(uri, null, null);
            throw e;
        }
        ContentValues done = new ContentValues();
        done.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, done, null, null);
        JSObject result = new JSObject();
        result.put("uri", uri.toString());
        call.resolve(result);
    }

    @SuppressWarnings("deprecation")
    private void saveLegacy(PluginCall call, File source, String mimeType, String displayName, String publicDir, String album)
        throws IOException {
        File directory = new File(Environment.getExternalStoragePublicDirectory(publicDir), album);
        if (!directory.isDirectory() && !directory.mkdirs()) {
            throw new IOException("dossier public inaccessible");
        }
        File target = uniqueFile(directory, displayName);
        try (InputStream in = new FileInputStream(source); OutputStream out = new java.io.FileOutputStream(target)) {
            copy(in, out);
        }
        MediaScannerConnection.scanFile(
            getContext(),
            new String[] { target.getAbsolutePath() },
            new String[] { mimeType },
            (path, uri) -> {
                JSObject result = new JSObject();
                result.put("uri", (uri != null ? uri : Uri.fromFile(target)).toString());
                call.resolve(result);
            }
        );
    }

    // ---------------------------------------------------------------- utilitaires

    /** Convertit un chemin (éventuellement préfixé « file:// ») en fichier, ou null si absent. */
    private static File resolveFile(String path) {
        if (path == null || path.isEmpty()) {
            return null;
        }
        String resolved = path;
        if (path.startsWith("file:")) {
            resolved = Uri.parse(path).getPath();
            if (resolved == null) {
                return null;
            }
        }
        return new File(resolved);
    }

    private static String sanitize(String name) {
        String cleaned = name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return cleaned.isEmpty() ? "Tessel" : cleaned;
    }

    /** Ajoute l'extension déduite du type MIME si le nom n'en porte pas. */
    private static String withExtension(String name, String mimeType) {
        if (name.lastIndexOf('.') > 0) {
            return name;
        }
        String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType.toLowerCase(Locale.ROOT));
        return extension == null ? name : name + "." + extension;
    }

    private static File uniqueFile(File directory, String name) {
        File candidate = new File(directory, name);
        if (!candidate.exists()) {
            return candidate;
        }
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        String extension = dot > 0 ? name.substring(dot) : "";
        int index = 1;
        while (candidate.exists()) {
            candidate = new File(directory, base + " (" + index + ")" + extension);
            index++;
        }
        return candidate;
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = in.read(buffer)) >= 0) {
            out.write(buffer, 0, read);
        }
        out.flush();
    }
}
