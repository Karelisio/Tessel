import type { ModeId } from '@/modes/types';
import { useMetaStore } from '@/store/meta';

/** Modes débloqués (le mode pixel tant que la progression se charge). */
export function useUnlockedModes(): readonly ModeId[] {
  return useMetaStore((s) => s.snap?.modes) ?? ['pixel'];
}
