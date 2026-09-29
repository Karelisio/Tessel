import { dailyRef } from '@/content/refs';
import type { DayKey } from '@/meta/time';
import { useNav } from '@/store/nav';
import { originOf } from '@/ui/library/origin';

/** Ouvre une œuvre du jour depuis sa vignette (transition partagée vers la grille). */
export function openDaily(day: DayKey, from: Element | null): void {
  const origin = originOf(from);
  useNav.getState().open(dailyRef(day), origin ? { origin } : {});
}
