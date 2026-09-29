import { Preferences } from '@capacitor/preferences';
import { create } from 'zustand';
import type { Locale } from '@/i18n/text';
import type { ModeId } from '@/modes/types';

export type ThemeId = 'doux' | 'material' | 'clair' | 'sombre';
export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  theme: ThemeId;
  /** null : langue du téléphone (français par défaut). */
  locale: Locale | null;
  musicVolume: number;
  ambienceVolume: number;
  effectsVolume: number;
  haptics: boolean;
  reducedMotion: boolean;
  keepAwake: boolean;
  quality: Quality;
  /** Taille des numéros sur la grille (0,75 – 1,5). */
  numberScale: number;
  /** Glisser : ne peint que la couleur choisie et ignore les autres cases. */
  autoCorrect: boolean;
  leftHanded: boolean;
  /** Commandes regroupées en bas de l'écran. */
  oneHanded: boolean;
  /** Motifs en plus des numéros (daltonisme). */
  colorblind: boolean;
  /** Intensité de l'aperçu des couleurs sur les cases vides (0 – 2, 1 par défaut). */
  ghost: number;
  /** Minicarte et radar quand on zoome. */
  minimap: boolean;
  /** Ambiance sonore en boucle (`ambience:…`), chaîne vide = aucune. */
  ambience: string;
  /** Matière choisie par mode (clé `texture:…`), la matière de base sinon. */
  textures: Partial<Record<ModeId, string>>;
  highContrast: boolean;
  notifications: boolean;
  autoUpdateCheck: boolean;
  includePrereleases: boolean;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'doux',
  locale: null,
  musicVolume: 0.6,
  ambienceVolume: 0.5,
  effectsVolume: 0.8,
  haptics: true,
  reducedMotion: false,
  keepAwake: true,
  quality: 'high',
  numberScale: 1,
  autoCorrect: true,
  leftHanded: false,
  oneHanded: false,
  colorblind: false,
  ghost: 1,
  minimap: true,
  textures: {},
  ambience: '',
  highContrast: false,
  notifications: false,
  autoUpdateCheck: true,
  includePrereleases: false,
  onboarded: false,
};

const KEY = 'tessel.settings';

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persist(s: Settings): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void Preferences.set({ key: KEY, value: JSON.stringify(s) }).catch(() => undefined);
  }, 300);
}

function pick(state: SettingsState): Settings {
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = state[k as keyof Settings];
  return out as unknown as Settings;
}

/** Réglages du joueur, persistés (Preferences) et appliqués par `useApplySettings`. */
export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    try {
      const { value } = await Preferences.get({ key: KEY });
      const saved = value ? (JSON.parse(value) as Partial<Settings>) : {};
      // seules les clés connues sont reprises : une sauvegarde d'une autre version reste valide
      const merged = { ...DEFAULT_SETTINGS };
      for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
        if (k in saved && typeof saved[k] === typeof DEFAULT_SETTINGS[k])
          (merged as Record<string, unknown>)[k] = saved[k];
        if (k === 'locale' && (saved.locale === 'fr' || saved.locale === 'en')) merged.locale = saved.locale;
      }
      set({ ...merged, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  set: (patch) => {
    set(patch);
    persist(pick(get()));
  },
  reset: () => {
    set({ ...DEFAULT_SETTINGS, onboarded: get().onboarded });
    persist(pick(get()));
  },
}));
