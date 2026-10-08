/**
 * File de lecture des musiques : ordre du catalogue (en repartant après la piste en cours) ou mélange
 * aléatoire, jamais deux fois la même d'affilée.
 */
export function nextQueue(
  ids: readonly string[],
  current: string | null,
  shuffle: boolean,
  random: () => number = Math.random,
): string[] {
  if (ids.length === 0) return [];
  if (!shuffle) {
    const at = current === null ? -1 : ids.indexOf(current);
    return [...ids.slice(at + 1), ...ids.slice(0, at + 1)];
  }
  const q = [...ids];
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = q[i];
    const b = q[j];
    if (a === undefined || b === undefined) continue;
    q[i] = b;
    q[j] = a;
  }
  const first = q[0];
  if (q.length > 1 && first === current) {
    q.shift();
    q.push(first);
  }
  return q;
}

/**
 * Fin du tour de boucle sur laquelle caler le relais : la première fin de tour au moins `lead`
 * secondes après `now`, et jamais avant la fin du premier tour (chaque piste joue en entier).
 */
export function lapEnd(t0: number, loop: number, now: number, lead: number): number {
  const laps = Math.max(1, Math.ceil((now + lead - t0) / loop));
  return t0 + laps * loop;
}
