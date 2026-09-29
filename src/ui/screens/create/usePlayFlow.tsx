import { useState, type ReactNode } from 'react';
import { paintedCount, type CreationDoc } from '@/create/document';
import { creationRef } from '@/create/refs';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { ModeId } from '@/modes/types';
import { useNav } from '@/store/nav';
import { emptyMessage } from './messages';
import { ModeSheet } from './ModeSheet';
import { useUnlockedModes } from './useModes';
import type { Notify } from './useToast';

/**
 * Jouer une création : rien de peint → message doux ; un seul mode → départ direct ; sinon choix du mode.
 * `before` (par exemple l'enregistrement) est attendu avant l'ouverture de la partie.
 */
export function usePlayFlow(notify: Notify): {
  start: (title: string, doc: CreationDoc, before?: () => Promise<void>) => void;
  sheet: ReactNode;
} {
  const modes = useUnlockedModes();
  const [pending, setPending] = useState<{
    title: string;
    doc: CreationDoc;
    before: (() => Promise<void>) | undefined;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const launch = (
    title: string,
    doc: CreationDoc,
    mode: ModeId,
    before: (() => Promise<void>) | undefined,
  ) => {
    void (async () => {
      try {
        await before?.();
        useNav.getState().open(creationRef(title, doc), { mode });
      } catch {
        notify(
          tr(t('Impossible de lancer la partie pour l’instant.', 'Could not start the game right now.')),
          'soft',
        );
      }
    })();
  };
  const start = (title: string, doc: CreationDoc, before?: () => Promise<void>) => {
    if (paintedCount(doc) === 0) {
      notify(emptyMessage(), 'soft');
      return;
    }
    const only = modes.length === 1 ? modes[0] : undefined;
    if (only) {
      launch(title, doc, only, before);
      return;
    }
    setPending({ title, doc, before });
    setOpen(true);
  };
  const sheet = (
    <ModeSheet
      open={open}
      onClose={() => {
        setOpen(false);
      }}
      onPick={(mode) => {
        setOpen(false);
        if (pending) launch(pending.title, pending.doc, mode, pending.before);
      }}
    />
  );
  return { start, sheet };
}
