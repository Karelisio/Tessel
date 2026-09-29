import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { luminance } from '@/content/grid';
import { CANVAS_SIZES } from '@/create/document';
import { DEFAULT_PALETTE, PALETTES, paletteColors } from '@/create/palettes';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { catalogItem, type UnlockKey } from '@/meta/catalog';
import { useMetaStore } from '@/store/meta';
import { spring } from '@/theme/motion/tokens';
import { Button, Sheet } from '@/ui/kit';
import { css } from './color';
import { paletteChoices } from './palettes';
import { useEditorStore } from './store';

const SIZE_NAMES: Record<number, () => string> = {
  16: () => tr(t('Mini', 'Tiny')),
  24: () => tr(t('Petite', 'Small')),
  32: () => tr(t('Classique', 'Classic')),
  48: () => tr(t('Détaillée', 'Detailed')),
  64: () => tr(t('Grande', 'Large')),
  96: () => tr(t('Très grande', 'Very large')),
  128: () => tr(t('Immense', 'Huge')),
};

/** Grille d'aperçu : un cœur tiré des couleurs de la palette, à la résolution de la toile choisie. */
function SizePreview({
  side,
  palette,
}: {
  side: number;
  palette: readonly (readonly [number, number, number])[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const box = 176;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    el.width = box * dpr;
    el.height = box * dpr;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--on-surface').trim() || '#000';
    const cell = box / side;
    const lively = palette.filter((c) => luminance(c) > 0.1 && luminance(c) < 0.9);
    const colors = lively.length >= 4 ? lively : palette;
    // un cœur au centre, dégradé de haut en bas dans la palette
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const nx = ((x + 0.5) / side - 0.5) * 2.5;
        const ny = -(((y + 0.5) / side - 0.5) * 2.5) - 0.15;
        const v = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny;
        if (v > 0) continue;
        const c =
          colors[Math.min(colors.length - 1, Math.floor((y / side) * colors.length * 0.9 + x / side))];
        if (!c) continue;
        ctx.fillStyle = css(c);
        ctx.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
    // grille fine (les toiles très denses n'en gardent qu'une trame légère)
    ctx.fillStyle = ink;
    ctx.globalAlpha = side > 48 ? 0.06 : 0.16;
    const step = side > 64 ? 2 : 1;
    for (let i = 0; i <= side; i += step) {
      const p = Math.round(i * cell * dpr) / dpr;
      ctx.fillRect(p, 0, 1 / dpr, box);
      ctx.fillRect(0, p, box, 1 / dpr);
    }
    ctx.globalAlpha = 1;
  }, [side, palette]);
  return <canvas ref={canvas} className="cr-newprev__canvas" aria-hidden />;
}

function Panel({ onClose }: { onClose: () => void }) {
  useMetaStore((s) => s.snap);
  const service = useMetaStore((s) => s.service);
  const unlocked = paletteChoices(service).filter((p) => p.unlocked);
  const [size, setSize] = useState<number>(32);
  const [paletteKey, setPaletteKey] = useState<string>(DEFAULT_PALETTE);
  const [title, setTitle] = useState('');
  const colors = paletteColors(paletteKey);
  return (
    <div className="cr-new">
      <div className="cr-sheet-head">
        <h3>{tr(t('Nouvelle création', 'New creation'))}</h3>
        <p>
          {tr(t('Choisis ta toile et tes premières couleurs.', 'Pick your canvas and your first colors.'))}
        </p>
      </div>

      <div className="cr-newprev">
        <motion.div
          key={size}
          className="cr-newprev__frame cr-checker"
          initial={{ scale: 0.92, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', ...spring.bouncy }}
        >
          <SizePreview side={size} palette={colors} />
        </motion.div>
        <div className="cr-newprev__label">
          <strong>
            {size} × {size}
          </strong>
          <span>
            {SIZE_NAMES[size]?.() ?? ''} · {(size * size).toLocaleString(tr(t('fr-FR', 'en-US')))}{' '}
            {tr(t('cases', 'squares'))}
          </span>
        </div>
      </div>

      <div className="cr-sizes" role="radiogroup" aria-label={tr(t('Taille de la toile', 'Canvas size'))}>
        {CANVAS_SIZES.map((s) => (
          <motion.button
            key={s}
            className="cr-size"
            role="radio"
            aria-checked={size === s}
            whileTap={{ scale: 0.93 }}
            onClick={() => {
              setSize(s);
            }}
          >
            {s}
          </motion.button>
        ))}
      </div>

      <h4 className="cr-label">{tr(t('Palette de départ', 'Starting palette'))}</h4>
      <div
        className="cr-pickpal"
        role="radiogroup"
        aria-label={tr(t('Palette de départ', 'Starting palette'))}
      >
        {unlocked.map(({ key }) => (
          <motion.button
            key={key}
            className="cr-pickpal__item"
            role="radio"
            aria-checked={paletteKey === key}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setPaletteKey(key);
            }}
          >
            <span className="cr-pickpal__swatches" aria-hidden>
              {(PALETTES[key] ?? []).slice(0, 8).map((c, i) => (
                <span key={i} style={{ background: css(c) }} />
              ))}
            </span>
            <strong>{tr(catalogItem(key as UnlockKey)?.name ?? t(key, key))}</strong>
          </motion.button>
        ))}
      </div>

      <label className="cr-field">
        <span className="cr-label">{tr(t('Titre', 'Title'))}</span>
        <input
          className="cr-input"
          value={title}
          maxLength={60}
          placeholder={tr(t('Ma création', 'My creation'))}
          enterKeyHint="done"
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </label>

      <Button
        variant="filled"
        onClick={() => {
          useEditorStore.getState().openNew({ title, width: size, height: size, palette: colors });
          onClose();
        }}
      >
        {tr(t('Créer la toile', 'Create the canvas'))}
      </Button>
    </div>
  );
}

/** Nouvelle création : taille de toile (avec aperçu de la grille), palette de départ, titre. */
export function NewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label={tr(t('Nouvelle création', 'New creation'))}>
      <Panel onClose={onClose} />
    </Sheet>
  );
}
