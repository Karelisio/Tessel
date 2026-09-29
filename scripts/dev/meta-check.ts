/**
 * Vérification visuelle de la méta-progression : pastille de niveau, outils, toasts, panneau, fin d'œuvre.
 * npx tsx --tsconfig tsconfig.app.json scripts/dev/meta-check.ts [dossier]
 */
import { openPage } from './browser';

const out = process.argv[2] ?? '.';
const { browser, page } = await openPage('http://localhost:5173/?size=40');
await page.waitForFunction('Boolean(window.__tessel?.game && window.__meta)', null, { timeout: 30000 });
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/meta-1-depart.png` });

// pose presque toute l'œuvre : XP, niveaux, succès, quêtes
const left = await page.evaluate<number>(`(() => {
  const g = window.__tessel.game;
  const keep = [];
  for (let i = 0; i < g.grid.cells.length && keep.length < 60; i += 7) if (g.grid.cells[i] !== 255) keep.push(i);
  g.debugFillExcept(keep);
  return g.progress.left;
})()`);
console.log('cases restantes', left);
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/meta-2-toasts.png` });
console.log(
  await page.evaluate(
    `JSON.stringify({ level: window.__meta.level, xp: window.__meta.xp, tools: ['loupe','bucket','wand'].map(t => window.__meta.tools(t)), achievements: window.__meta.achievementCount })`,
  ),
);

await page.click('.tool[aria-label^="Loupe"]');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/meta-3-loupe.png` });

await page.click('.tool[aria-label^="Pot"]');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/meta-4-pot-arme.png` });
await page.click('.tool[aria-label^="Pot"]');

await page.click('.level-chip');
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/meta-5-panneau.png` });
await page.mouse.click(200, 60);
await page.waitForTimeout(600);

await page.click('.tool[aria-label^="Baguette"]');
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/meta-6-baguette.png` });
// dernières cases posées comme par le joueur : couleurs terminées, fin d'œuvre, récompenses
await page.evaluate(`(() => {
  const g = window.__tessel.game;
  for (let i = 0; i < g.grid.cells.length; i++)
    if (g.grid.cells[i] !== 255 && !g.progress.filled.get(i)) g.placeIndex(i);
})()`);
await page.waitForTimeout(5200);
await page.screenshot({ path: `${out}/meta-7-fin.png` });
console.log(
  await page.evaluate(
    `JSON.stringify({ level: window.__meta.level, artworks: window.__meta.stat('artworks'), quests: window.__meta.quests().map(q => [q.template, q.progress, q.target, q.doneAt !== null]) })`,
  ),
);
await browser.close();
