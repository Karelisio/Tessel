import { mulberry32 } from '@/content/random';
import { xpScale } from './levels';
import { mergeRewards, reward, type ChestSize, type Reward, type ToolId } from './rewards';

type Weights = readonly [loupe: number, bucket: number, wand: number];

function rollTool(rnd: () => number, [loupe, bucket]: Weights): ToolId {
  const r = rnd();
  if (r < loupe) return 'loupe';
  if (r < loupe + bucket) return 'bucket';
  return 'wand';
}

/**
 * Contenu d'un coffre, tiré au moment de l'ouverture avec une graine déterministe
 * (numéro du coffre + graine du joueur) : rouvrir l'application ne change rien.
 */
export function chestContents(size: ChestSize, seed: number, level: number): Reward[] {
  const rnd = mulberry32(seed);
  const out: Reward[] = [];
  const xp = (base: number, step: number) =>
    reward.xp(Math.round(((base + step * Math.floor(rnd() * 5)) * xpScale(level)) / 5) * 5);
  switch (size) {
    case 'small':
      out.push(xp(60, 10), reward.tool(rollTool(rnd, [0.5, 0.35, 0.15])));
      if (rnd() < 0.25) out.push(reward.tool('loupe'));
      break;
    case 'medium':
      out.push(xp(150, 25), reward.tool('loupe'));
      for (let k = 0; k < 2; k++) out.push(reward.tool(rollTool(rnd, [0.35, 0.45, 0.2])));
      break;
    case 'large':
      out.push(xp(400, 50), reward.tool('wand'));
      for (let k = 0; k < 3; k++) out.push(reward.tool(rollTool(rnd, [0.3, 0.4, 0.3])));
      if (rnd() < 0.35) out.push(reward.freeze());
      break;
  }
  return mergeRewards(out);
}
