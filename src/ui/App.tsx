import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { listenIncomingShares } from '@/create/incoming';
import { useApplySettings } from '@/app/useApplySettings';
import { getServices } from '@/app/services';
import { useNav } from '@/store/nav';
import { useSettings } from '@/store/settings';
import { ImportSheet, type ImportResult } from '@/ui/import/ImportSheet';
import { Toasts } from '@/ui/meta/Toasts';
import { Onboarding } from '@/ui/shell/Onboarding';
import { Shell } from '@/ui/shell/Shell';
import { Splash } from '@/ui/shell/Splash';
import { usePlayStore } from '@/store/play';
import { useMetaStore } from '@/store/meta';
import { PlayScreen } from './play/PlayScreen';

/** Transforme la photo convertie en partie et l'ouvre. */
function confirmImport({ grid, mode, title }: ImportResult): void {
  useNav.getState().closeImport();
  void getServices().then(({ meta }) => {
    meta.record('photos');
  });
  useNav
    .getState()
    .open({ artworkId: `photo:${crypto.randomUUID()}`, source: 'photo', title, grid: () => grid }, { mode });
}

if (import.meta.env.DEV)
  Object.assign(window as unknown as Record<string, unknown>, { __nav: useNav, __settings: useSettings });

export function App() {
  useApplySettings();
  useEffect(listenIncomingShares, []);
  const reduced = useSettings((s) => s.reducedMotion);
  const locale = useSettings((s) => s.locale);
  const importing = useNav((s) => s.importing);
  const mode = usePlayStore((s) => s.mode);
  const modes = useMetaStore((s) => s.snap?.modes);
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      {/* la langue change tout l'arbre : on le remonte pour relire les textes */}
      <div key={locale ?? 'auto'} className="app">
        <PlayScreen />
        <Shell />
        <ImportSheet
          open={importing !== null}
          initialMode={mode}
          initialPhoto={importing?.photo ?? null}
          {...(modes && { modes })}
          onClose={() => {
            useNav.getState().closeImport();
          }}
          onConfirm={confirmImport}
        />
        <Toasts />
        <Onboarding />
        <Splash />
      </div>
    </MotionConfig>
  );
}
