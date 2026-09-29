import { create } from 'zustand';

export const useDebug = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({
  open: false,
  set: (open) => {
    set({ open });
  },
}));

const taps: number[] = [];

/** Compte les appuis sur l'onglet Profil : 7 en moins de 3 s ouvrent le menu. */
export function debugTap(): void {
  const now = Date.now();
  taps.push(now);
  while (taps.length > 0 && now - (taps[0] ?? 0) > 3000) taps.shift();
  if (taps.length >= 7) {
    taps.length = 0;
    useDebug.getState().set(true);
  }
}
