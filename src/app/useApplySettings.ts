import { App as CapApp } from '@capacitor/app';
import { useEffect } from 'react';
import { detectLocale, setLocale } from '@/i18n/locale';
import { useNav } from '@/store/nav';
import { useSettings } from '@/store/settings';
import { applyTheme } from '@/theme/applyTheme';

/** Charge les réglages et applique ceux qui concernent tout le document (thème, langue, animations). */
export function useApplySettings(): void {
  const loaded = useSettings((s) => s.loaded);
  const theme = useSettings((s) => s.theme);
  const highContrast = useSettings((s) => s.highContrast);
  const locale = useSettings((s) => s.locale);
  const reducedMotion = useSettings((s) => s.reducedMotion);

  useEffect(() => {
    void useSettings.getState().load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void applyTheme(theme, highContrast);
    if (theme !== 'material') return;
    // Material You suit le mode sombre du téléphone
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      void applyTheme(theme, highContrast);
    };
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, [loaded, theme, highContrast]);

  useEffect(() => {
    setLocale(locale ?? detectLocale());
    document.documentElement.lang = locale ?? detectLocale();
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [reducedMotion]);

  // bouton retour Android : jeu → sous-page → onglet principal → application en arrière-plan
  useEffect(() => {
    const handle = CapApp.addListener('backButton', () => {
      if (!useNav.getState().back()) void CapApp.minimizeApp().catch(() => undefined);
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);
}

// développement : les scripts de capture changent de thème sans passer par l'écran Réglages
if (import.meta.env.DEV) {
  document.addEventListener('tessel-set-theme', (e) => {
    const theme = (e as CustomEvent<string>).detail;
    if (theme === 'doux' || theme === 'sombre' || theme === 'clair' || theme === 'material')
      useSettings.getState().set({ theme });
  });
}
