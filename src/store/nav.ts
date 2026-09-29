import { create } from 'zustand';
import type { ArtworkRef } from '@/db/session';
import type { ModeId } from '@/modes/types';

export type TabId = 'library' | 'daily' | 'gallery' | 'create' | 'profile';
export const TABS: readonly TabId[] = ['library', 'daily', 'gallery', 'create', 'profile'];

/** Sous-pages empilées sur un onglet (succès, collections, statistiques, réglages…). */
export type SubPage = 'achievements' | 'collections' | 'stats' | 'settings' | 'quests';

export interface OpenRequest {
  id: number;
  ref: ArtworkRef;
  mode?: ModeId;
  /** Vignette d'origine (transition partagée vers la grille). */
  origin?: { rect: DOMRect; image: string | null };
}

interface NavState {
  tab: TabId;
  stack: SubPage[];
  playing: boolean;
  request: OpenRequest | null;
  /** Import de photo ouvert (photo déjà choisie : outils de test). */
  importing: { photo: Blob | null } | null;
  openImport: (photo?: Blob | null) => void;
  closeImport: () => void;
  setTab: (tab: TabId) => void;
  push: (page: SubPage) => void;
  pop: () => void;
  /** Ouvre une œuvre en plein écran (le moteur la charge, puis `playing` passe à vrai). */
  open: (ref: ArtworkRef, opts?: { mode?: ModeId; origin?: OpenRequest['origin'] }) => void;
  setPlaying: (playing: boolean) => void;
  closePlay: () => void;
  /** Retour Android : jeu → sous-page → onglet Bibliothèque. Renvoie false s'il n'y a plus rien à fermer. */
  back: () => boolean;
}

let nextId = 1;

export const useNav = create<NavState>((set, get) => ({
  tab: 'library',
  stack: [],
  playing: false,
  request: null,
  importing: null,
  openImport: (photo = null) => {
    set({ importing: { photo } });
  },
  closeImport: () => {
    set({ importing: null });
  },
  setTab: (tab) => {
    set({ tab, stack: [] });
  },
  push: (page) => {
    set((s) => ({ stack: [...s.stack, page] }));
  },
  pop: () => {
    set((s) => ({ stack: s.stack.slice(0, -1) }));
  },
  open: (ref, opts = {}) => {
    set({
      request: {
        id: nextId++,
        ref,
        ...(opts.mode !== undefined && { mode: opts.mode }),
        ...(opts.origin !== undefined && { origin: opts.origin }),
      },
    });
  },
  setPlaying: (playing) => {
    set({ playing });
  },
  closePlay: () => {
    set({ playing: false });
  },
  back: () => {
    const s = get();
    if (s.importing) {
      set({ importing: null });
      return true;
    }
    if (s.playing) {
      set({ playing: false });
      return true;
    }
    if (s.stack.length > 0) {
      s.pop();
      return true;
    }
    if (s.tab !== 'library') {
      s.setTab('library');
      return true;
    }
    return false;
  },
}));
