import { motion } from 'framer-motion';
import { useEffect, useState, useSyncExternalStore } from 'react';
import './music.css';
import { sharedAudio } from '@/audio/AudioEngine';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { catalogItem } from '@/meta/catalog';
import { unlockLevel } from '@/meta/unlocks';
import { useMetaStore } from '@/store/meta';
import { useSettings } from '@/store/settings';
import { Switch } from '@/ui/kit';
import { IconCheck, IconLock } from '@/ui/meta/icons';

const TRACKS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `music:${String(n)}` as const);

const subscribe = (fn: () => void) => sharedAudio.onMusicChange(fn);
const playingNow = () => sharedAudio.currentMusic();

/**
 * Choix des musiques : on coche celles qu'on aime. Une seule cochée tourne en boucle sans fin ;
 * plusieurs s'enchaînent en fondu, dans l'ordre ou au hasard. Les pistes à venir restent verrouillées.
 */
export function MusicPicker() {
  const excluded = useSettings((s) => s.musicExcluded);
  const shuffle = useSettings((s) => s.musicShuffle);
  const service = useMetaStore((s) => s.service);
  // redessine quand un niveau débloque une piste
  useMetaStore((s) => s.snap?.level.level);
  const playing = useSyncExternalStore(subscribe, playingNow);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => {
      setHint(null);
    }, 2600);
    return () => {
      clearTimeout(timer);
    };
  }, [hint]);

  const unlocked = (id: (typeof TRACKS)[number]) =>
    service ? service.isUnlocked(id) : Number(id.split(':')[1]) <= 4;
  const checked = TRACKS.filter((id) => unlocked(id) && !excluded.includes(id));

  const toggle = (id: (typeof TRACKS)[number]) => {
    if (!unlocked(id)) {
      const level = unlockLevel(id) ?? 0;
      setHint(tr(t(`Se débloque au niveau ${String(level)}`, `Unlocks at level ${String(level)}`)));
      return;
    }
    const next = excluded.includes(id) ? excluded.filter((x) => x !== id) : [...excluded, id];
    useSettings.getState().set({ musicExcluded: next });
  };

  const status =
    hint ??
    (checked.length === 0
      ? tr(t('Aucune musique cochée : silence.', 'No music selected: silence.'))
      : checked.length === 1
        ? tr(t('Une seule musique : elle tourne en boucle, sans coupure.', 'One track: it loops seamlessly.'))
        : tr(t('Les musiques cochées s’enchaînent en fondu.', 'Selected tracks crossfade into each other.')));

  return (
    <div className="music-picker">
      <div className="texture-chips" role="group" aria-label={tr(t('Musiques', 'Music'))}>
        {TRACKS.map((id) => {
          const locked = !unlocked(id);
          const on = !locked && !excluded.includes(id);
          const name = catalogItem(id)?.name;
          const now = playing === id;
          return (
            <motion.button
              key={id}
              type="button"
              className="texture-chip music-chip"
              aria-pressed={on}
              data-locked={locked}
              data-playing={now}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                toggle(id);
              }}
            >
              {locked ? <IconLock size={12} /> : on && <IconCheck size={14} />}
              {name ? tr(name) : id}
              {now && (
                <span className="music-chip__eq" role="img" aria-label={tr(t('en cours', 'playing'))}>
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      <p className="music-picker__status" aria-live="polite">
        {status}
      </p>
      <div className="music-picker__row">
        <Switch
          label={tr(t('Ordre aléatoire', 'Shuffle'))}
          checked={shuffle}
          disabled={checked.length < 2}
          onChange={(v) => {
            useSettings.getState().set({ musicShuffle: v });
          }}
        />
        <motion.button
          type="button"
          className="btn btn--text music-picker__skip"
          disabled={checked.length < 2 || playing === null}
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            sharedAudio.skipMusic();
          }}
        >
          {tr(t('Suivante', 'Next'))}
        </motion.button>
      </div>
    </div>
  );
}
