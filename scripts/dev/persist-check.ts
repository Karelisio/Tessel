import { openPage } from './browser';

/** Vérifie la reprise d'une partie après rechargement (sauvegarde IndexedDB en développement). */
const { browser, page } = await openPage('http://localhost:5173/?size=48');
const ready = 'Boolean(window.__tessel && window.__tessel.game)';
await page.waitForFunction(ready, null, { timeout: 30000 });
const before = await page.evaluate(`(() => {
  const g = window.__tessel.game;
  if (g.progress.total - g.progress.left > 0) g.restart();
  for (let i = 0; i < 30; i++) g.placeIndex(i * 3);
  g.undo();
  return { placed: g.progress.total - g.progress.left, history: g.placementOrder.slice(0, 5) };
})()`);
await page.waitForTimeout(3500);
await page.reload();
await page.waitForFunction(ready, null, { timeout: 30000 });
await page.waitForTimeout(500);
const after = await page.evaluate(`(() => {
  const g = window.__tessel.game;
  return { placed: g.progress.total - g.progress.left, history: g.placementOrder.slice(0, 5) };
})()`);
console.log(JSON.stringify({ before, after }));
await browser.close();
