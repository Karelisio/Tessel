import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { rgbToHex, type Rgb } from '@/content/grid';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { Button, Sheet } from '@/ui/kit';
import { css, hslToRgb, hueGradient, inkOn, rgbToHsl, type Hsl } from '../color';

export type ColorTarget = { kind: 'edit'; index: number; color: Rgb } | { kind: 'add'; color: Rgb };

/** Quelques teintes pour aller vite. */
const QUICK: readonly Rgb[] = [
  ...[0, 25, 50, 90, 140, 175, 200, 225, 260, 290, 325].map((h) => hslToRgb({ h, s: 72, l: 56 })),
  [255, 255, 255],
  [160, 160, 165],
  [30, 28, 34],
];

function GradientSlider({
  label,
  value,
  max,
  gradient,
  onChange,
  onEnd,
  text,
}: {
  label: string;
  value: number;
  max: number;
  gradient: string;
  onChange: (v: number) => void;
  onEnd: () => void;
  text: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  // le glissé horizontal règle la couleur : il ne doit pas entraîner la feuille
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const stop = (e: Event) => {
      e.stopPropagation();
    };
    el.addEventListener('pointerdown', stop);
    return () => {
      el.removeEventListener('pointerdown', stop);
    };
  }, []);
  return (
    <div className="cr-grad" ref={wrap}>
      <div className="cr-grad__head">
        <span>{label}</span>
        <span>{text}</span>
      </div>
      <input
        type="range"
        className="cr-grad__input"
        style={{ backgroundImage: gradient }}
        min={0}
        max={max}
        step={1}
        value={Math.round(value)}
        aria-label={label}
        aria-valuetext={text}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onKeyUp={onEnd}
        onBlur={onEnd}
      />
    </div>
  );
}

function Panel({
  target,
  onApply,
  onClose,
}: {
  target: ColorTarget;
  onApply: (color: Rgb) => void;
  onClose: () => void;
}) {
  const [hsl, setHsl] = useState<Hsl>(() => rgbToHsl(target.color));
  const latest = useRef<Rgb>(target.color);
  const committed = useRef<Rgb>(target.color);
  const rgb = hslToRgb(hsl);
  const set = (next: Hsl) => {
    setHsl(next);
    latest.current = hslToRgb(next);
  };
  /** Une modification = une entrée dans l'historique, à la fin du geste. */
  const commit = () => {
    if (target.kind !== 'edit') return;
    const c = latest.current;
    const p = committed.current;
    if (c[0] === p[0] && c[1] === p[1] && c[2] === p[2]) return;
    committed.current = c;
    onApply(c);
  };
  const adding = target.kind === 'add';
  const hex = rgbToHex(rgb).toUpperCase();
  return (
    <div className="cr-color">
      <h3>{adding ? tr(t('Nouvelle couleur', 'New color')) : tr(t('Modifier la couleur', 'Edit color'))}</h3>
      <div className="cr-color__preview" style={{ background: css(rgb), color: inkOn(rgb) }}>
        {!adding && (
          <span className="cr-color__before" style={{ background: css(target.color) }} aria-hidden />
        )}
        <strong>{hex}</strong>
      </div>
      <GradientSlider
        label={tr(t('Teinte', 'Hue'))}
        value={hsl.h}
        max={360}
        gradient={hueGradient(hsl.s, hsl.l)}
        text={`${String(Math.round(hsl.h))}°`}
        onChange={(h) => {
          set({ ...hsl, h });
        }}
        onEnd={commit}
      />
      <GradientSlider
        label={tr(t('Saturation', 'Saturation'))}
        value={hsl.s}
        max={100}
        gradient={`linear-gradient(90deg, ${css(hslToRgb({ ...hsl, s: 0 }))}, ${css(hslToRgb({ ...hsl, s: 100 }))})`}
        text={`${String(Math.round(hsl.s))} %`}
        onChange={(s) => {
          set({ ...hsl, s });
        }}
        onEnd={commit}
      />
      <GradientSlider
        label={tr(t('Luminosité', 'Lightness'))}
        value={hsl.l}
        max={100}
        gradient={`linear-gradient(90deg, #000, ${css(hslToRgb({ ...hsl, l: 50 }))}, #fff)`}
        text={`${String(Math.round(hsl.l))} %`}
        onChange={(l) => {
          set({ ...hsl, l });
        }}
        onEnd={commit}
      />
      <div className="cr-color__quick" role="group" aria-label={tr(t('Nuancier', 'Swatches'))}>
        {QUICK.map((c, i) => (
          <motion.button
            key={i}
            className="cr-color__chip"
            style={{ background: css(c) }}
            aria-label={rgbToHex(c)}
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              set(rgbToHsl(c));
              latest.current = c;
              commit();
            }}
          />
        ))}
      </div>
      <div className="cr-color__buttons">
        <Button
          variant="filled"
          onClick={() => {
            if (adding) onApply(latest.current);
            else commit();
            onClose();
          }}
        >
          {adding ? tr(t('Ajouter la couleur', 'Add color')) : tr(t('Terminé', 'Done'))}
        </Button>
      </div>
    </div>
  );
}

/** Sélecteur de couleur : teinte, saturation, luminosité et nuancier. */
export function ColorSheet({
  target,
  onClose,
  onApply,
}: {
  target: ColorTarget | null;
  onClose: () => void;
  onApply: (color: Rgb) => void;
}) {
  // le contenu reste affiché pendant la fermeture
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);
  return (
    <Sheet open={target !== null} onClose={onClose} label={tr(t('Couleur', 'Color'))}>
      {shown && <Panel key={target ? 'open' : 'closed'} target={shown} onApply={onApply} onClose={onClose} />}
    </Sheet>
  );
}
