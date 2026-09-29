import { PALETTES } from '@/create/palettes';
import { STARTER_UNLOCKS } from '@/meta/catalog';
import type { UnlockKey } from '@/meta/catalog';
import type { MetaService } from '@/meta/MetaService';
import { unlockLevel } from '@/meta/unlocks';

/** Toutes les palettes, avec ce qui est débloqué (les palettes de départ tant que les services s'ouvrent). */
export function paletteChoices(service: MetaService | null): { key: string; unlocked: boolean }[] {
  const open = new Set<string>(
    service ? service.unlocked('palette') : STARTER_UNLOCKS.filter((k) => k.startsWith('palette:')),
  );
  return Object.keys(PALETTES)
    .map((key, i) => ({ key, unlocked: open.has(key), i, level: unlockLevel(key as UnlockKey) ?? 0 }))
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || (a.unlocked ? a.i - b.i : a.level - b.level))
    .map(({ key, unlocked }) => ({ key, unlocked }));
}
