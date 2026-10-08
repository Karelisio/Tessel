import { useEffect } from 'react';
import { sharedAudio } from '@/audio/AudioEngine';
import { useMetaStore } from '@/store/meta';
import { useSettings } from '@/store/settings';

const trackNumber = (id: string) => Number(id.split(':')[1] ?? 0);

/** Pistes débloquées, dans l'ordre (les 4 premières sont offertes, les autres viennent avec les niveaux). */
function unlockedMusic(): string[] {
  const service = useMetaStore.getState().service;
  const keys: string[] = service ? service.unlocked('music') : [];
  const list = keys.length > 0 ? keys : ['music:1', 'music:2', 'music:3', 'music:4'];
  return [...list].sort((a, b) => trackNumber(a) - trackNumber(b));
}

/** Pistes à jouer : débloquées et cochées. */
function playlist(excluded: readonly string[]): string[] {
  return unlockedMusic().filter((id) => !excluded.includes(id));
}

/**
 * Son de toute l'application : volumes, musique de fond (pistes débloquées et cochées), ambiance choisie.
 * Le contexte audio s'ouvre au premier geste (politique d'autoplay).
 */
export function useAudio(): void {
  useEffect(() => {
    const apply = () => {
      const s = useSettings.getState();
      sharedAudio.setVolume('music', s.musicVolume);
      sharedAudio.setVolume('ambience', s.ambienceVolume);
      sharedAudio.setVolume('sfx', s.effectsVolume);
      void sharedAudio.setMusic(playlist(s.musicExcluded), { shuffle: s.musicShuffle });
      const service = useMetaStore.getState().service;
      const amb =
        s.ambience && (service?.isUnlocked(s.ambience as `ambience:${string}`) ?? true) ? s.ambience : null;
      void sharedAudio.setAmbience(amb);
    };
    apply();
    const offSettings = useSettings.subscribe(apply);
    // nouvelle piste débloquée : la liste de lecture s'agrandit
    const offMeta = useMetaStore.subscribe((s, prev) => {
      if (s.snap?.level.level !== prev.snap?.level.level || s.service !== prev.service) apply();
    });
    const unlock = () => {
      void sharedAudio.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    return () => {
      offSettings();
      offMeta();
      window.removeEventListener('pointerdown', unlock, { capture: true });
    };
  }, []);
}
