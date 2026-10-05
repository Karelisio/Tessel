import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useSettings } from '@/store/settings';
import { Slider } from '@/ui/kit';

type VolumeKey = 'musicVolume' | 'ambienceVolume' | 'effectsVolume';

const percent = (v: number) => `${String(Math.round(v * 100))} %`;

function Volume({ k, label }: { k: VolumeKey; label: string }) {
  const value = useSettings((s) => s[k]);
  return (
    <Slider
      label={label}
      value={value}
      min={0}
      max={1}
      step={0.05}
      valueText={percent(value)}
      onChange={(v) => {
        useSettings.getState().set({ [k]: v });
      }}
    />
  );
}

/** Volumes réglables sans quitter la partie (mêmes réglages que l'écran Réglages). */
export function SoundControls() {
  return (
    <div className="sound-controls">
      <Volume k="musicVolume" label={tr(t('Musique', 'Music'))} />
      <Volume k="ambienceVolume" label={tr(t('Ambiance', 'Ambience'))} />
      <Volume k="effectsVolume" label={tr(t('Effets', 'Effects'))} />
    </div>
  );
}
