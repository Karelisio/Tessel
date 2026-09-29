import type { UnlockKey } from './catalog';

export type ToolId = 'loupe' | 'bucket' | 'wand';
export const TOOL_IDS: readonly ToolId[] = ['loupe', 'bucket', 'wand'];

export type ChestSize = 'small' | 'medium' | 'large';
export const CHEST_SIZES: readonly ChestSize[] = ['small', 'medium', 'large'];

export type Reward =
  | { readonly kind: 'xp'; readonly amount: number }
  | { readonly kind: 'tool'; readonly tool: ToolId; readonly count: number }
  | { readonly kind: 'freeze'; readonly count: number }
  | { readonly kind: 'chest'; readonly size: ChestSize; readonly count: number }
  | { readonly kind: 'unlock'; readonly key: UnlockKey };

export const reward = {
  xp: (amount: number): Reward => ({ kind: 'xp', amount }),
  tool: (tool: ToolId, count = 1): Reward => ({ kind: 'tool', tool, count }),
  freeze: (count = 1): Reward => ({ kind: 'freeze', count }),
  chest: (size: ChestSize, count = 1): Reward => ({ kind: 'chest', size, count }),
  unlock: (key: UnlockKey): Reward => ({ kind: 'unlock', key }),
};

/** Objets d'inventaire (table `inventory`) ; les jokers de série vivent dans la table `streak`. */
export type ItemKey = `tool.${ToolId}` | `chest.${ChestSize}`;

export const toolItem = (tool: ToolId): ItemKey => `tool.${tool}`;
export const chestItem = (size: ChestSize): ItemKey => `chest.${size}`;

/** Inventaire de départ : de quoi découvrir chaque outil. */
export const STARTING_TOOLS: Readonly<Record<ToolId, number>> = { loupe: 3, bucket: 2, wand: 1 };

function rewardId(r: Reward): string {
  switch (r.kind) {
    case 'xp':
      return 'xp';
    case 'tool':
      return `tool.${r.tool}`;
    case 'freeze':
      return 'freeze';
    case 'chest':
      return `chest.${r.size}`;
    case 'unlock':
      return `unlock.${r.key}`;
  }
}

/** Regroupe les récompenses identiques (plusieurs niveaux d'un coup, contenu d'un coffre). */
export function mergeRewards(list: readonly Reward[]): Reward[] {
  const out = new Map<string, Reward>();
  for (const r of list) {
    const id = rewardId(r);
    const prev = out.get(id);
    if (!prev) {
      out.set(id, r);
      continue;
    }
    if (prev.kind === 'xp' && r.kind === 'xp') out.set(id, reward.xp(prev.amount + r.amount));
    else if (prev.kind === 'tool' && r.kind === 'tool')
      out.set(id, reward.tool(r.tool, prev.count + r.count));
    else if (prev.kind === 'freeze' && r.kind === 'freeze') out.set(id, reward.freeze(prev.count + r.count));
    else if (prev.kind === 'chest' && r.kind === 'chest')
      out.set(id, reward.chest(r.size, prev.count + r.count));
  }
  return [...out.values()];
}

export function totalXp(list: readonly Reward[]): number {
  return list.reduce((s, r) => s + (r.kind === 'xp' ? r.amount : 0), 0);
}
