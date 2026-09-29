import type { DayKey } from '@/meta/time';

const PREFIX = 'tessel.daily.gift.';
/** Repli en mémoire quand le stockage du navigateur est indisponible (mode privé, données bloquées). */
const memory = new Set<DayKey>();

/** La boîte cadeau du jour a-t-elle déjà été ouverte ? */
export function giftOpened(day: DayKey): boolean {
  if (memory.has(day)) return true;
  try {
    return localStorage.getItem(PREFIX + day) === '1';
  } catch {
    return false;
  }
}

export function markGiftOpened(day: DayKey): void {
  memory.add(day);
  try {
    localStorage.setItem(PREFIX + day, '1');
    // on ne garde que les derniers jours
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys.sort().slice(0, -14)) localStorage.removeItem(k);
  } catch {
    // stockage indisponible : la mémoire suffit pour cette session
  }
}
