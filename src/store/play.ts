import { create } from 'zustand';
import type { GameSnapshot } from '@/engine/Game';
import type { ModeId } from '@/modes/types';

interface PlayState {
  snapshot: GameSnapshot | null;
  mode: ModeId;
  showHud: boolean;
  canUndo: boolean;
  canRedo: boolean;
  setSnapshot: (s: GameSnapshot, canUndo: boolean, canRedo: boolean) => void;
  setMode: (m: ModeId) => void;
  toggleHud: () => void;
}

/** État de l'écran de jeu, alimenté au plus une fois par frame par le moteur. */
export const usePlayStore = create<PlayState>((set) => ({
  snapshot: null,
  mode: 'pixel',
  showHud: import.meta.env.DEV,
  canUndo: false,
  canRedo: false,
  setSnapshot: (snapshot, canUndo, canRedo) => {
    set({ snapshot, canUndo, canRedo });
  },
  setMode: (mode) => {
    set({ mode });
  },
  toggleHud: () => {
    set((s) => ({ showHud: !s.showHud }));
  },
}));
