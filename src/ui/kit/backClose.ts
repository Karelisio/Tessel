import { useEffect, useRef } from 'react';
import { pushOverlay } from '@/store/nav';

/** Tant que `open`, le retour Android appelle `onClose` (au lieu de quitter la page). */
export function useBackClose(open: boolean, onClose: () => void): void {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    return pushOverlay(() => {
      latest.current();
    });
  }, [open]);
}
