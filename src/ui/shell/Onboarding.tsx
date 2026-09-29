import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { tr } from '@/i18n/locale';
import { t, type I18nText } from '@/i18n/text';
import { useSettings, type ThemeId } from '@/store/settings';
import { spring } from '@/theme/motion/tokens';
import { Confetti } from '@/ui/fx/Confetti';

/** Petit cœur à colorier (0 = vide, 1–3 = couleurs). */
const HEART = [
  [0, 2, 1, 0, 1, 1, 0],
  [2, 2, 1, 1, 1, 1, 1],
  [2, 1, 1, 1, 1, 1, 3],
  [0, 1, 1, 1, 1, 3, 0],
  [0, 0, 1, 1, 3, 0, 0],
  [0, 0, 0, 3, 0, 0, 0],
];
const COLORS = ['#e8768f', '#f6b8c4', '#b9496a'];
const COLS = HEART[0]?.length ?? 7;
const CELLS = HEART.flat();
const PAINTABLE = CELLS.filter((c) => c > 0).length;

const THEMES: { id: ThemeId; name: I18nText; colors: [string, string, string] }[] = [
  { id: 'doux', name: t('Doux', 'Soft'), colors: ['#f7efe9', '#b7799f', '#e9c6c9'] },
  { id: 'clair', name: t('Clair', 'Light'), colors: ['#f6f7f9', '#5b6fb5', '#d8def0'] },
  { id: 'sombre', name: t('Sombre', 'Dark'), colors: ['#141217', '#d9a3c3', '#3a3040'] },
  { id: 'material', name: t('Material You', 'Material You'), colors: ['#eef1e6', '#4d6a3a', '#cfe6bb'] },
];

function Heart({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState(1);
  const [filled, setFilled] = useState<ReadonlySet<number>>(() => new Set());
  const [shake, setShake] = useState<number | null>(null);
  const painting = useRef(false);
  const done = filled.size === PAINTABLE;

  const paint = (i: number, tap: boolean) => {
    const c = CELLS[i] ?? 0;
    if (c === 0 || filled.has(i)) return;
    if (c !== selected) {
      if (tap) setShake(i);
      return;
    }
    const next = new Set(filled);
    next.add(i);
    setFilled(next);
    if (next.size === PAINTABLE) onDone();
  };

  const cellAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y);
    const v = el instanceof HTMLElement ? el.dataset.cell : undefined;
    return v === undefined ? null : Number(v);
  };

  return (
    <div className="onb-heart">
      <div
        className="onb-heart__grid"
        style={{ gridTemplateColumns: `repeat(${String(COLS)}, 1fr)` }}
        onPointerDown={(e) => {
          painting.current = true;
          const i = cellAt(e.clientX, e.clientY);
          if (i !== null) paint(i, true);
        }}
        onPointerMove={(e) => {
          if (!painting.current) return;
          const i = cellAt(e.clientX, e.clientY);
          if (i !== null) paint(i, false);
        }}
        onPointerUp={() => {
          painting.current = false;
        }}
        onPointerLeave={() => {
          painting.current = false;
        }}
      >
        {CELLS.map((c, i) =>
          c === 0 ? (
            <span key={i} />
          ) : (
            <motion.span
              key={i}
              data-cell={i}
              className="onb-heart__cell"
              data-active={c === selected && !filled.has(i)}
              style={filled.has(i) ? { background: COLORS[c - 1] ?? '#e8768f' } : {}}
              animate={
                shake === i
                  ? { x: [0, -4, 4, -3, 3, 0] }
                  : filled.has(i)
                    ? { scale: [0.6, 1.12, 1] }
                    : { scale: 1 }
              }
              transition={{ duration: 0.32 }}
              onAnimationComplete={() => {
                if (shake === i) setShake(null);
              }}
            >
              {!filled.has(i) && c}
            </motion.span>
          ),
        )}
      </div>
      <div className="onb-heart__palette" role="radiogroup" aria-label={tr(t('Couleurs', 'Colors'))}>
        {COLORS.map((col, k) => {
          const n = k + 1;
          const left = CELLS.some((c, i) => c === n && !filled.has(i));
          return (
            <motion.button
              key={col}
              role="radio"
              aria-checked={selected === n}
              aria-label={tr(t(`Couleur ${n}`, `Color ${n}`))}
              className="onb-heart__swatch"
              style={{ background: col }}
              animate={{ y: selected === n ? -6 : 0, scale: selected === n ? 1.08 : 1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', ...spring.bouncy }}
              onClick={() => {
                setSelected(n);
              }}
            >
              {left ? n : '✓'}
            </motion.button>
          );
        })}
      </div>
      <p className="onb__hint" aria-live="polite">
        {done
          ? tr(t('Magnifique ! Tu as compris l’essentiel.', 'Beautiful! You’ve got the gist.'))
          : tr(
              t(
                'Choisis une couleur, puis touche (ou glisse sur) les cases qui portent son numéro.',
                'Pick a color, then tap (or swipe over) the cells showing its number.',
              ),
            )}
      </p>
    </div>
  );
}

function Tips() {
  const tips: [string, I18nText][] = [
    [
      '🤏',
      t('Pince avec deux doigts pour zoomer et te déplacer.', 'Pinch with two fingers to zoom and move.'),
    ],
    [
      '👆',
      t(
        'Glisse un doigt pour peindre plusieurs cases d’un coup.',
        'Drag one finger to paint many cells at once.',
      ),
    ],
    [
      '✨',
      t(
        'Double-touche pour zoomer ou revoir toute l’œuvre.',
        'Double-tap to zoom in or see the whole artwork.',
      ),
    ],
    [
      '🎁',
      t(
        'Chaque jour : une œuvre offerte, des quêtes et des coffres. Aucune pub, aucun achat.',
        'Every day: a gift artwork, quests and chests. No ads, no purchases.',
      ),
    ],
  ];
  return (
    <ul className="onb-tips">
      {tips.map(([icon, text], i) => (
        <motion.li
          key={icon}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 + i * 0.08, type: 'spring', ...spring.gentle }}
        >
          <span className="onb-tips__icon" aria-hidden>
            {icon}
          </span>
          <span>{tr(text)}</span>
        </motion.li>
      ))}
    </ul>
  );
}

function ThemePicker() {
  const theme = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
  return (
    <div className="onb-themes" role="radiogroup" aria-label={tr(t('Thème', 'Theme'))}>
      {THEMES.map((th) => (
        <motion.button
          key={th.id}
          role="radio"
          aria-checked={theme === th.id}
          className="onb-theme"
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            set({ theme: th.id });
          }}
        >
          <span className="onb-theme__preview" style={{ background: th.colors[0] }}>
            <i style={{ background: th.colors[1] }} />
            <i style={{ background: th.colors[2] }} />
            <i style={{ background: th.colors[2] }} />
          </span>
          <strong>{tr(th.name)}</strong>
        </motion.button>
      ))}
    </div>
  );
}

/** Première ouverture : bienvenue, un petit cœur à colorier, les gestes, le choix du thème. */
export function Onboarding() {
  const loaded = useSettings((s) => s.loaded);
  const onboarded = useSettings((s) => s.onboarded);
  const [page, setPage] = useState(0);
  const [heartDone, setHeartDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const skip = new URLSearchParams(location.search);
  if (!loaded || onboarded || skip.has('capture') || skip.has('nodb')) return null;

  const finish = () => {
    useSettings.getState().set({ onboarded: true });
  };
  const pages = [
    {
      title: t('Bienvenue dans Tessel', 'Welcome to Tessel'),
      body: t(
        'Un coloriage tout doux, case après case : pixel art, diamond painting, point de croix et mosaïque. Pas de chrono, pas de pub, rien à acheter.',
        'Gentle coloring, one cell at a time: pixel art, diamond painting, cross-stitch and mosaic. No timer, no ads, nothing to buy.',
      ),
    },
    { title: t('Essaie tout de suite', 'Try it now'), body: null },
    { title: t('Quelques gestes', 'A few gestures'), body: null },
    {
      title: t('Choisis ton ambiance', 'Choose your look'),
      body: t('Tu pourras la changer dans les réglages.', 'You can change it later in settings.'),
    },
  ];
  const last = page === pages.length - 1;
  const current = pages[page];
  if (!current) return null;
  const blocked = page === 1 && !heartDone;

  return (
    <motion.div
      className="onb"
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Confetti burst={burst} origin={[0.5, 0.42]} count={70} />
      <button className="onb__skip" onClick={finish}>
        {tr(t('Passer', 'Skip'))}
      </button>
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={page}
          className="onb__page"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40, transition: { duration: 0.14 } }}
          transition={{ type: 'spring', ...spring.snappy }}
        >
          {page === 0 && (
            <div className="onb__hero" aria-hidden>
              {[
                '#f4c09f',
                '#eea3b1',
                '#d4a6d8',
                '#a9b9e6',
                '#9fd4c4',
                '#f3d58e',
                '#eea3b1',
                '#a9b9e6',
                '#f4c09f',
              ].map((c, i) => (
                <motion.span
                  key={i}
                  style={{ background: c }}
                  initial={{ scale: 0, rotate: -40 }}
                  animate={{ scale: 1, rotate: 0, y: [0, -4, 0] }}
                  transition={{
                    scale: { type: 'spring', ...spring.bouncy, delay: 0.1 + i * 0.06 },
                    rotate: { type: 'spring', ...spring.bouncy, delay: 0.1 + i * 0.06 },
                    y: { duration: 3, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' },
                  }}
                />
              ))}
            </div>
          )}
          <h1 className="onb__title">{tr(current.title)}</h1>
          {current.body && <p className="onb__body">{tr(current.body)}</p>}
          {page === 1 && (
            <Heart
              onDone={() => {
                setHeartDone(true);
                setBurst((b) => b + 1);
              }}
            />
          )}
          {page === 2 && <Tips />}
          {page === 3 && <ThemePicker />}
        </motion.section>
      </AnimatePresence>
      <footer className="onb__footer">
        <div className="onb__dots" aria-hidden>
          {pages.map((_, i) => (
            <motion.span key={i} animate={{ width: i === page ? 22 : 8, opacity: i === page ? 1 : 0.4 }} />
          ))}
        </div>
        <motion.button
          className="onb__next"
          disabled={blocked}
          whileTap={{ scale: 0.95 }}
          animate={page === 1 && heartDone ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 0.6, repeat: page === 1 && heartDone ? 2 : 0 }}
          onClick={() => {
            if (last) finish();
            else setPage(page + 1);
          }}
        >
          {last
            ? tr(t('C’est parti', 'Let’s go'))
            : blocked
              ? tr(t('Colorie le cœur', 'Color the heart'))
              : tr(t('Suivant', 'Next'))}
        </motion.button>
      </footer>
    </motion.div>
  );
}
