/**
 * Simulation d'équilibrage de la progression : npx tsx --tsconfig tsconfig.app.json scripts/sim/progression.ts [jours]
 */
import { PROFILES, simulate } from './simulate';

const days = Number(process.argv[2] ?? 450);
const checkpoints = [1, 3, 7, 14, 30, 60, 90, 180, 270, 365, 450, 540].filter((d) => d <= days);

for (const profile of Object.values(PROFILES)) {
  const t0 = performance.now();
  const r = simulate(profile, days);
  const ms = performance.now() - t0;
  console.log(
    `\n== ${profile.name} (${profile.minutesPerDay} min/j, ${Math.round(profile.playChance * 100)} % des jours) — ${ms.toFixed(0)} ms`,
  );
  console.log('jour  niveau  succès  œuvres  série  loupe/pot/baguette');
  for (const d of checkpoints) {
    const s = r.samples[d - 1];
    if (!s) continue;
    console.log(
      `${String(d).padStart(4)}  ${String(s.level).padStart(6)}  ${String(s.achievements).padStart(6)}  ${String(s.artworks).padStart(6)}  ${String(s.streak).padStart(5)}  ${s.tools.loupe}/${s.tools.bucket}/${s.tools.wand}`,
    );
  }
  const reach = [10, 20, 30, 50, 75, 100]
    .map((l) => `niv ${l} : ${r.levelDay.has(l) ? `j${(r.levelDay.get(l) ?? 0) + 1}` : '—'}`)
    .join(' · ');
  console.log(reach);
  const total = Object.values(r.xpBySource).reduce((s, v) => s + v, 0);
  console.log(
    'XP : ' +
      Object.entries(r.xpBySource)
        .map(([k, v]) => `${k} ${((v / total) * 100).toFixed(0)} %`)
        .join(' · ') +
      ` · ${Math.round(total / days)} XP/jour`,
  );
  console.log(
    `outils utilisés : loupe ${r.toolsUsed.loupe}, pot ${r.toolsUsed.bucket}, baguette ${r.toolsUsed.wand}`,
  );
}
