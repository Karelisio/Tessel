/**
 * Parcours complet de l'application (serveur de dev lancé) : premier lancement, bibliothèque,
 * partie terminée (menu debug), galerie, sauvegarde. Échoue sur toute erreur de page.
 * Usage : npx tsx --tsconfig tsconfig.app.json scripts/dev/smoke-check.ts <dossier-captures>
 */
import { openPage } from './browser';

const out = process.argv[2] ?? '.';
const { browser, page } = await openPage('http://localhost:5173/');
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const shot = (name: string) => page.screenshot({ path: `${out}/smoke-${name}.png` });

await page.waitForSelector('.onb', { timeout: 30000 });
await shot('1-onboarding');
await page.click('.onb__skip');
await page.waitForFunction('!document.querySelector(".splash, .onb")', null, { timeout: 15000 });
await page.waitForTimeout(1500);
await shot('2-library');

// ouvre la première œuvre de la bibliothèque en facile
await page.evaluate(`(async () => {
  const { getServices } = await import('/src/app/services.ts');
  const { libraryRef } = await import('/src/content/refs.ts');
  const s = await getServices();
  const entry = s.library.artworks.find((a) => !a.event);
  window.__nav.getState().open(libraryRef(entry, 'easy', s.library), { mode: 'pixel' });
})()`);
await page.waitForFunction('window.__nav.getState().playing', null, { timeout: 30000 });
await page.waitForTimeout(1500);
await shot('3-playing');

// termine l'œuvre comme le ferait le menu debug
await page.evaluate(`(() => {
  const g = window.__tessel.game;
  let last = -1;
  for (let i = g.grid.cells.length - 1; i >= 0; i--) if (g.grid.cells[i] !== 255 && !g.progress.filled.get(i)) { last = i; break; }
  g.debugFillExcept([last]);
  g.placeIndex(last);
})()`);
await page.waitForFunction("window.__tessel.game.phase === 'finished'", null, { timeout: 30000 });
await page.waitForTimeout(1500);
await shot('4-finished');
await page.click('.levelup__continue').catch(() => undefined);
await page.evaluate(`window.__nav.getState().closePlay()`);
await page.evaluate(`window.__nav.getState().setTab('gallery')`);
await page.waitForTimeout(4000);
await shot('5-gallery');
const hung = await page.evaluate(
  `document.querySelectorAll('.gal img, [class*="gallery"] img, [class*="art-frame"] img').length`,
);
console.log('œuvres accrochées :', hung);

// sauvegarde de la progression (téléchargement hors Android)
await page.evaluate(`window.__nav.getState().setTab('profile')`);
await page.evaluate(`window.__nav.getState().push('settings')`);
await page.waitForTimeout(1200);
const download = page.waitForEvent('download', { timeout: 20000 });
await page.getByText(/Sauvegarder ma progression/).click();
const d = await download;
console.log('sauvegarde :', d.suggestedFilename());

await browser.close();
if (errors.length > 0) {
  console.error('ERREURS :', errors.join('\n'));
  process.exit(1);
}
console.log('Parcours OK');
