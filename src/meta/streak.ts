import { reward, type Reward } from './rewards';
import { daysBetween, type DayKey } from './time';

export interface StreakState {
  current: number;
  best: number;
  /** Dernier jour validé. */
  lastDay: DayKey | null;
  /** Jokers : comblent automatiquement les jours manqués. */
  freezes: number;
}

export const STREAK = {
  /** Cases à poser dans la journée pour la valider : quelques minutes suffisent. */
  cellsToValidate: 30,
  maxFreezes: 3,
  /** Un joker gagné tous les 7 jours de série. */
  freezeEvery: 7,
  /** Joker gagné alors que le maximum est atteint : compensé en XP. */
  overflowXp: 150,
  milestones: [3, 7, 14, 30, 60, 100, 200, 365] as readonly number[],
} as const;

export const INITIAL_STREAK: StreakState = { current: 0, best: 0, lastDay: null, freezes: 1 };

export interface StreakUpdate {
  state: StreakState;
  /** Le jour vient d'être validé (false s'il l'était déjà). */
  validated: boolean;
  /** Jokers consommés pour combler des jours manqués. */
  freezesUsed: number;
  /** La série précédente s'est arrêtée (on repart à 1, la meilleure est conservée). */
  broken: boolean;
  /** Joker gagné par la série. */
  freezeEarned: boolean;
  /** Joker gagné alors que la réserve est pleine : compensé en XP. */
  freezeOverflow: boolean;
  /** Palier atteint (récompense), sinon null. */
  milestone: number | null;
}

export function isMilestone(days: number): boolean {
  return STREAK.milestones.includes(days) || (days > 365 && days % 100 === 0);
}

/**
 * Valide `today`. Jours manqués : comblés par les jokers s'il y en a assez,
 * sinon la série repart doucement à 1 (jamais de perte de la meilleure série).
 */
export function validateDay(s: StreakState, today: DayKey): StreakUpdate {
  const same: StreakUpdate = {
    state: s,
    validated: false,
    freezesUsed: 0,
    broken: false,
    freezeEarned: false,
    freezeOverflow: false,
    milestone: null,
  };
  let current = 1;
  let freezes = s.freezes;
  let freezesUsed = 0;
  let broken = false;
  if (s.lastDay !== null) {
    const missed = daysBetween(s.lastDay, today) - 1;
    // même jour, ou date reculée (fuseau, date forcée) : rien à faire
    if (missed < 0) return same;
    if (missed === 0) current = s.current + 1;
    else if (missed <= freezes) {
      freezesUsed = missed;
      freezes -= missed;
      current = s.current + 1;
    } else broken = s.current > 0;
  }
  const earns = current % STREAK.freezeEvery === 0;
  const freezeEarned = earns && freezes < STREAK.maxFreezes;
  if (freezeEarned) freezes++;
  return {
    state: { current, best: Math.max(s.best, current), lastDay: today, freezes },
    validated: true,
    freezesUsed,
    broken,
    freezeEarned,
    freezeOverflow: earns && !freezeEarned,
    milestone: isMilestone(current) ? current : null,
  };
}

export type StreakStatus =
  /** Déjà validée aujourd'hui. */
  | 'done'
  /** À valider aujourd'hui pour continuer (éventuellement grâce aux jokers). */
  | 'pending'
  /** Trop de jours manqués : la prochaine journée validée relance une série. */
  | 'lost'
  /** Jamais commencée. */
  | 'none';

export function streakStatus(s: StreakState, today: DayKey): StreakStatus {
  if (s.lastDay === null) return 'none';
  const missed = daysBetween(s.lastDay, today) - 1;
  if (missed < 0) return 'done';
  return missed <= s.freezes ? 'pending' : 'lost';
}

/** Série affichée : une série perdue s'affiche à 0 jusqu'à la prochaine journée validée. */
export function displayedStreak(s: StreakState, today: DayKey): number {
  return streakStatus(s, today) === 'lost' ? 0 : s.current;
}

/** Petite XP de chaque journée validée, qui grandit avec la série (plafonnée). */
export function streakDayXp(current: number): number {
  return 20 + 5 * Math.min(Math.max(current, 1), 20);
}

/** Récompense d'un palier de série. */
export function milestoneRewards(days: number): Reward[] {
  switch (days) {
    case 3:
      return [reward.chest('small')];
    case 7:
      return [reward.chest('medium')];
    case 14:
      return [reward.chest('medium'), reward.tool('wand')];
    case 30:
      return [reward.chest('large'), reward.unlock('frame:flamme')];
    case 60:
      return [reward.chest('large')];
    case 100:
      return [reward.chest('large'), reward.unlock('frame:constellation')];
    case 200:
      return [reward.chest('large'), reward.tool('wand', 2)];
    case 365:
      return [reward.chest('large'), reward.unlock('frame:jubile')];
    default:
      return isMilestone(days) ? [reward.chest('large')] : [];
  }
}
