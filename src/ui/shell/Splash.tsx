import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getServices } from '@/app/services';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';

/** Couleurs de la marque (tesselles du logo). */
const TILES = [
  '#f4c09f',
  '#eea3b1',
  '#d4a6d8',
  '#a9b9e6',
  '#eea3b1',
  '#d4a6d8',
  '#a9b9e6',
  '#9fd4c4',
  '#d4a6d8',
  '#a9b9e6',
  '#9fd4c4',
  '#f3d58e',
  '#a9b9e6',
  '#9fd4c4',
  '#f3d58e',
  '#f4c09f',
];
const MIN_MS = 1300;
const WORD = 'Tessel';

/** Écran de démarrage animé : les tesselles du logo se posent en vague pendant le chargement. */
export function Splash() {
  const [done, setDone] = useState(() => {
    const p = new URLSearchParams(location.search);
    return p.has('capture') || p.has('nodb');
  });

  useEffect(() => {
    // développement : `?splash` garde l'écran affiché (captures)
    if (done || (import.meta.env.DEV && new URLSearchParams(location.search).has('splash'))) return;
    const started = performance.now();
    let alive = true;
    void getServices()
      .catch(() => undefined)
      .then(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, Math.max(0, MIN_MS - (performance.now() - started)));
          }),
      )
      .then(() => {
        if (alive) setDone(true);
      });
    return () => {
      alive = false;
    };
  }, [done]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="splash"
          exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeOut' } }}
          aria-label={tr(t('Chargement', 'Loading'))}
          role="status"
        >
          <motion.div
            className="splash__logo"
            exit={{ scale: 1.25, opacity: 0, transition: { duration: 0.45 } }}
            aria-hidden
          >
            {TILES.map((c, i) => {
              const x = i % 4;
              const y = Math.floor(i / 4);
              return (
                <motion.span
                  key={i}
                  className="splash__tile"
                  style={{ background: c }}
                  initial={{ scale: 0, rotate: -35, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.08 + (x + y) * 0.07 }}
                />
              );
            })}
          </motion.div>
          <div className="splash__word" aria-hidden>
            {WORD.split('').map((ch, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.05, type: 'spring', stiffness: 300, damping: 22 }}
              >
                {ch}
              </motion.span>
            ))}
          </div>
          <motion.p
            className="splash__tagline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.95, duration: 0.5 }}
          >
            {tr(t('Colorier, tout en douceur', 'Coloring, gently'))}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
