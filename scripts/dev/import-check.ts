import { readFileSync } from 'node:fs';
import { openPage } from './browser';

/**
 * Parcours d'import automatisé : ouvre l'écran d'import sur une image locale, active la suppression
 * du fond, lance « Colorier » et capture le jeu obtenu.
 * Usage : tsx scripts/dev/import-check.ts <image.jpg> <capture.png>
 */
const [image = '', out = 'import-check.png'] = process.argv.slice(2);
const { browser, page } = await openPage('http://localhost:5173/?nodb=1&size=48');
const warnings: string[] = [];
page.on('console', (m) => {
  if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text().slice(0, 160));
});
await page.waitForFunction('Boolean(window.__tessel && window.__tessel.game && window.__importBlob)', null, {
  timeout: 30000,
});
const b64 = readFileSync(image).toString('base64');
await page.evaluate(`(() => {
  const bytes = Uint8Array.from(atob('${b64}'), (c) => c.charCodeAt(0));
  window.__importBlob(new Blob([bytes], { type: 'image/jpeg' }));
})()`);
await page.getByRole('switch', { name: /Supprimer le fond/ }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Colorier' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
console.log(warnings.length ? `avertissements :\n${warnings.join('\n')}` : 'aucun avertissement');
await browser.close();
