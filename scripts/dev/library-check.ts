/** Parcours de la bibliothèque : œuvre du jour au démarrage, feuille, choix d'une œuvre et d'une difficulté. */
import { openPage } from './browser';

const out = process.argv[2] ?? '.';
const { browser, page } = await openPage('http://localhost:5173/');
await page.waitForFunction('Boolean(window.__tessel?.game && window.__meta)', null, { timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/lib-1-jour.png` });
await page.click('[aria-label="Bibliothèque"]');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/lib-2-feuille.png` });
await page.mouse.wheel(0, 600);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/lib-3-defile.png` });
await page.click('.lib-card[data-locked="false"] >> nth=2');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/lib-4-choix.png` });
await page.click('.lib-pick .btn--primary');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/lib-5-partie.png` });
console.log(
  await page.evaluate(
    `JSON.stringify({ w: window.__tessel.game.grid.width, h: window.__tessel.game.grid.height })`,
  ),
);
await browser.close();
