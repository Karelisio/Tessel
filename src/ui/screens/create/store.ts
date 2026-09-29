import { create } from 'zustand';
import type { Rgb } from '@/content/grid';

/** Ce qu'il faut pour commencer une toile vierge. */
export interface NewSpec {
  title: string;
  width: number;
  height: number;
  palette: readonly Rgb[];
}

export type EditorTarget =
  { token: number; kind: 'saved'; id: string } | { token: number; kind: 'new'; spec: NewSpec };

interface EditorState {
  target: EditorTarget | null;
  /** Augmente quand la liste des créations a pu changer (fermeture de l'éditeur, renommage…). */
  version: number;
  open: (id: string) => void;
  openNew: (spec: NewSpec) => void;
  close: () => void;
  touch: () => void;
}

let seq = 1;

/**
 * Éditeur plein écran : ouvert depuis l'onglet Créer ou depuis une œuvre reçue (`SharedImportSheet`),
 * monté une seule fois dans l'application, donc visible quel que soit l'onglet actif.
 */
export const useEditorStore = create<EditorState>((set) => ({
  target: null,
  version: 0,
  open: (id) => {
    set({ target: { token: seq++, kind: 'saved', id } });
  },
  openNew: (spec) => {
    set({ target: { token: seq++, kind: 'new', spec } });
  },
  close: () => {
    set((s) => ({ target: null, version: s.version + 1 }));
  },
  touch: () => {
    set((s) => ({ version: s.version + 1 }));
  },
}));
