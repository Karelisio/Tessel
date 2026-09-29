import { AnimatePresence, motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';
import type { ModeId } from '@/modes/types';
import { useSpringTransition } from './hooks';
import { IconInfo } from './icons';
import { Segmented } from './Segmented';
import {
  COLOR_RANGE,
  SIZE_RANGE,
  difficultyOf,
  formatPercent,
  isDefaultSettings,
  type Output,
  type Settings,
} from './settings';
import { Slider } from './Slider';
import { Switch } from './Switch';

const MODES: readonly { id: ModeId; label: string }[] = [
  { id: 'pixel', label: 'Pixel' },
  { id: 'diamond', label: 'Diamant' },
  { id: 'crossstitch', label: 'Croix' },
  { id: 'mosaic', label: 'Mosaïque' },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="imp-group" aria-labelledby={id}>
      <h3 id={id} className="imp-group__title">
        {title}
      </h3>
      <div className="imp-group__body">{children}</div>
    </section>
  );
}

interface SettingsPanelProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onReset: () => void;
  /** Dimensions de la grille résultant de la taille choisie et du format du recadrage. */
  dims: { width: number; height: number };
  /** Dernier résultat de conversion (pour « retenues » et « fond détecté »). */
  output: Output | null;
  mode: ModeId;
  onMode: (mode: ModeId) => void;
}

/** Panneau défilant des réglages de conversion et du mode de jeu. */
export function SettingsPanel({
  settings: s,
  onChange,
  onReset,
  dims,
  output,
  mode,
  onMode,
}: SettingsPanelProps) {
  const transition = useSpringTransition('gentle');

  // le nombre de couleurs retenues n'a de sens que pour le nombre demandé qui l'a produit
  const retained = output && output.params.colors === s.colors ? output.result.stats.colors : null;
  const colorsText =
    retained !== null && retained !== s.colors
      ? `${s.colors} couleurs (${retained} ${retained > 1 ? 'retenues' : 'retenue'})`
      : `${s.colors} couleurs`;
  // idem : « aucun fond » ne vaut que pour un résultat calculé avec la suppression du fond
  const noBackground =
    s.removeBackground && output?.params.removeBackground === true && !output.result.stats.backgroundFound;

  return (
    <div className="imp-panel">
      <Group title="Grille">
        <Slider
          label="Taille"
          value={s.size}
          {...SIZE_RANGE}
          valueText={`${dims.width}×${dims.height} cases · ${difficultyOf(s.size)}`}
          onChange={(size) => {
            onChange({ size });
          }}
        />
        <Slider
          label="Couleurs"
          value={s.colors}
          {...COLOR_RANGE}
          valueText={colorsText}
          onChange={(colors) => {
            onChange({ colors });
          }}
        />
      </Group>

      <Group title="Image">
        <Slider
          label="Luminosité"
          value={s.brightness}
          min={-1}
          max={1}
          step={0.05}
          origin={0}
          valueText={formatPercent(s.brightness, true)}
          onChange={(brightness) => {
            onChange({ brightness });
          }}
        />
        <Slider
          label="Contraste"
          value={s.contrast}
          min={-1}
          max={1}
          step={0.05}
          origin={0}
          valueText={formatPercent(s.contrast, true)}
          onChange={(contrast) => {
            onChange({ contrast });
          }}
        />
        <Slider
          label="Saturation"
          value={s.saturation}
          min={-1}
          max={1}
          step={0.05}
          origin={0}
          valueText={formatPercent(s.saturation, true)}
          onChange={(saturation) => {
            onChange({ saturation });
          }}
        />
        <Slider
          label="Netteté"
          value={s.sharpen}
          min={0}
          max={1}
          step={0.05}
          valueText={formatPercent(s.sharpen)}
          onChange={(sharpen) => {
            onChange({ sharpen });
          }}
        />
      </Group>

      <Group title="Rendu">
        <Slider
          label="Nettoyage"
          value={s.cleanup}
          min={0}
          max={1}
          step={0.05}
          valueText={formatPercent(s.cleanup)}
          disabled={s.dither}
          {...(s.dither && { hint: 'Sans effet avec le tramage' })}
          onChange={(cleanup) => {
            onChange({ cleanup });
          }}
        />
        <Switch
          label="Tramage"
          hint="Simule les nuances avec de petits points"
          checked={s.dither}
          onChange={(dither) => {
            onChange({ dither });
          }}
        />
      </Group>

      <Group title="Fond">
        <Switch
          label="Supprimer le fond"
          hint="Laisse transparent le fond uni autour du sujet"
          checked={s.removeBackground}
          onChange={(removeBackground) => {
            onChange({ removeBackground });
          }}
        />
        <AnimatePresence initial={false}>
          {s.removeBackground && (
            <motion.div
              key="tolerance"
              className="imp-collapse"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={transition}
            >
              <Slider
                label="Tolérance"
                value={s.tolerance}
                min={0}
                max={1}
                step={0.05}
                valueText={formatPercent(s.tolerance)}
                onChange={(tolerance) => {
                  onChange({ tolerance });
                }}
              />
              {noBackground && (
                <p className="imp-note" role="status">
                  <IconInfo size={18} />
                  <span>Aucun fond uni détecté</span>
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Group>

      <button type="button" className="imp-reset" disabled={isDefaultSettings(s)} onClick={onReset}>
        Réinitialiser les réglages
      </button>

      <Group title="Mode de jeu">
        <div className="imp-modes">
          <Segmented
            variant="chips"
            layoutId="imp-mode"
            label="Mode de jeu"
            options={MODES}
            value={mode}
            onChange={onMode}
          />
        </div>
      </Group>
    </div>
  );
}
