import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { create } from 'zustand';
import { APP_CONFIG } from '@/config/app';
import { TesselNative } from '@/native/TesselNative';
import { useSettings } from '@/store/settings';
import { UpdateError, fetchLatestRelease, fetchSha256, type Release, type UpdateErrorKind } from './github';
import { isNewer, parse } from './semver';

const LAST_CHECK_KEY = 'tessel.update.lastCheck';
const IGNORED_KEY = 'tessel.update.ignored';

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  /** L'installation depuis Tessel n'est pas encore autorisée dans les réglages d'Android. */
  | 'permission'
  | 'downloading'
  /** APK téléchargé et vérifié, en attente d'installation. */
  | 'ready'
  /** Vérification manuelle échouée. */
  | 'error';

interface Progress {
  downloaded: number;
  total: number;
}

interface UpdaterStore {
  state: UpdateState;
  release: Release | null;
  /** Version installée (celle de l'application). */
  installed: string;
  progress: Progress;
  /** Dernier échec (vérification ou téléchargement). */
  error: UpdateErrorKind | null;
  /** La feuille est demandée (elle attend la fin d'une partie avant de s'afficher). */
  open: boolean;
  /** Vérifie s'il existe une version plus récente. `manual` : ignore la version écartée et affiche les erreurs. */
  check: (manual: boolean) => Promise<void>;
  /** Télécharge puis installe (sur navigateur : ouvre la page de la release). */
  download: () => Promise<void>;
  /** Interrompt le téléchargement (le fichier partiel est gardé pour la reprise). */
  cancel: () => void;
  /** Ne plus proposer cette version automatiquement. */
  ignore: () => void;
  /** « Plus tard » : ferme la feuille. */
  dismiss: () => void;
  /** Rouvre la feuille (depuis les réglages). */
  show: () => void;
  /** Relance l'installation d'un APK déjà téléchargé. */
  install: () => Promise<void>;
  /** Ouvre l'écran Android « installer des applications inconnues ». */
  openInstallSettings: () => void;
}

const isNative = (): boolean => Capacitor.isNativePlatform();

/** Version installée : `APP_CONFIG.version`, sinon (build de dev) celle que déclare le paquet Android. */
async function installedVersion(): Promise<string> {
  const configured = APP_CONFIG.version;
  const p = parse(configured);
  const placeholder = p !== null && p.major === 0 && p.minor === 0 && p.patch === 0 && p.pre.length > 0;
  if (p && !placeholder) return configured;
  if (isNative()) {
    try {
      const { versionName } = await TesselNative.getBuildInfo();
      if (parse(versionName)) return versionName;
    } catch {
      /* on garde la version configurée */
    }
  }
  return configured;
}

async function readPref(key: string): Promise<string | null> {
  try {
    return (await Preferences.get({ key })).value;
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  void Preferences.set({ key, value }).catch(() => undefined);
}

function errorKind(e: unknown): UpdateErrorKind | 'cancelled' {
  if (e instanceof UpdateError) return e.kind;
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  switch (code) {
    case 'cancelled':
      return 'cancelled';
    case 'network':
      return 'network';
    case 'checksum_mismatch':
      return 'corrupt';
    case 'install_not_allowed':
      return 'unavailable';
    default:
      return 'io';
  }
}

let working = false;
let cancelRequested = false;
const wasCancelled = (): boolean => cancelRequested;
/** APK téléchargé et vérifié de la release en cours. */
let apkPath: string | null = null;

export const useUpdater = create<UpdaterStore>((set, get) => {
  /** Lance l'installeur système (l'état reste « prêt » : on peut le relancer si l'utilisateur revient). */
  const runInstall = async (path: string): Promise<void> => {
    apkPath = path;
    set({ state: 'ready' });
    try {
      await TesselNative.installApk({ path });
      set({ error: null });
    } catch (e) {
      const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
      if (code === 'install_not_allowed') set({ state: 'permission', error: null });
      else set({ error: 'install' });
    }
  };

  return {
    state: 'idle',
    release: null,
    installed: APP_CONFIG.version,
    progress: { downloaded: 0, total: 0 },
    error: null,
    open: false,

    check: async (manual) => {
      const before = get().state;
      if (before === 'checking' || before === 'downloading' || working) return;
      set({ state: 'checking', error: null });
      try {
        const [installed, release, ignored] = await Promise.all([
          installedVersion(),
          fetchLatestRelease(useSettings.getState().includePrereleases),
          readPref(IGNORED_KEY),
        ]);
        writePref(LAST_CHECK_KEY, String(Date.now()));
        if (release && isNewer(release.version, installed)) {
          if (release.version !== get().release?.version) apkPath = null;
          set({
            state: 'available',
            release,
            installed,
            open: manual || ignored !== release.version,
            progress: { downloaded: 0, total: release.apk.size },
          });
        } else {
          set({ state: 'upToDate', release: null, installed, open: false });
        }
      } catch (e) {
        const kind = e instanceof UpdateError ? e.kind : 'network';
        // vérification automatique : silence, on retrouve l'état précédent
        set(
          manual
            ? { state: 'error', error: kind }
            : { state: get().release ? 'available' : 'idle', error: null },
        );
      }
    },

    download: async () => {
      const release = get().release;
      if (!release || working) return;
      if (!isNative()) {
        window.open(release.htmlUrl, '_blank', 'noopener,noreferrer');
        set({ open: false });
        return;
      }
      working = true;
      cancelRequested = false;
      let listener: PluginListenerHandle | null = null;
      try {
        set({ error: null });
        try {
          const { allowed } = await TesselNative.canInstallPackages();
          if (!allowed) {
            set({ state: 'permission' });
            return;
          }
        } catch {
          /* installApk dira s'il manque l'autorisation */
        }
        set({ state: 'downloading', progress: { downloaded: 0, total: release.apk.size } });
        const sha256 = await fetchSha256(release);
        if (wasCancelled()) throw new UpdateError('unavailable', 'cancelled');
        listener = await TesselNative.addListener('downloadProgress', (event) => {
          set({
            progress: {
              downloaded: event.downloaded,
              total: event.total > 0 ? event.total : release.apk.size,
            },
          });
        });
        const { path } = await TesselNative.downloadUpdate({
          url: release.apk.url,
          fileName: release.apk.name,
          sha256,
          ...(release.apk.size > 0 && { size: release.apk.size }),
        });
        if (wasCancelled()) {
          apkPath = path;
          throw new UpdateError('unavailable', 'cancelled');
        }
        await runInstall(path);
      } catch (e) {
        const kind = wasCancelled() ? 'cancelled' : errorKind(e);
        set({ state: 'available', error: kind === 'cancelled' ? null : kind });
      } finally {
        working = false;
        await listener?.remove().catch(() => undefined);
      }
    },

    cancel: () => {
      if (get().state !== 'downloading') return;
      cancelRequested = true;
      void TesselNative.cancelDownload().catch(() => undefined);
    },

    ignore: () => {
      const release = get().release;
      if (release) writePref(IGNORED_KEY, release.version);
      set({ open: false, error: null });
    },

    dismiss: () => {
      if (get().state === 'downloading') return;
      set((s) => ({ open: false, error: null, state: s.state === 'permission' ? 'available' : s.state }));
    },

    show: () => {
      set({ open: true });
    },

    install: async () => {
      const path = apkPath;
      if (path) await runInstall(path);
      else await get().download();
    },

    openInstallSettings: () => {
      void TesselNative.openInstallSettings().catch(() => undefined);
    },
  };
});

let autoStarted = false;

/** Vérification automatique du lancement : au plus une fois par 24 h, si le joueur ne l'a pas désactivée. */
export async function runAutoCheck(): Promise<void> {
  if (autoStarted || !useSettings.getState().autoUpdateCheck) return;
  autoStarted = true;
  const last = Number(await readPref(LAST_CHECK_KEY));
  const now = Date.now();
  // un horodatage dans le futur (horloge réglée à la main) ne bloque pas la vérification
  if (Number.isFinite(last) && last > 0 && last <= now && now - last < APP_CONFIG.updateCheckIntervalMs)
    return;
  await useUpdater.getState().check(false);
}

// Retour depuis les réglages Android « applications inconnues » : on réessaie tout seul.
function retryAfterSettings(): void {
  if (document.visibilityState === 'visible' && useUpdater.getState().state === 'permission') {
    void useUpdater.getState().download();
  }
}
document.addEventListener('visibilitychange', retryAfterSettings);
if (isNative()) void CapApp.addListener('resume', retryAfterSettings).catch(() => undefined);

if (import.meta.env.DEV)
  Object.assign(window as unknown as Record<string, unknown>, { __updater: useUpdater });
