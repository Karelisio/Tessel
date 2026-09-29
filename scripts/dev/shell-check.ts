/**
 * Capture de la coque dans chaque thème.
 * Usage : shell-check.ts <dossier> <onglet|sous-page> [défilements px séparés par des virgules]
 */
import { openPage } from './browser';

const TABS = ['library', 'daily', 'gallery', 'create', 'profile'];
const out = process.argv[2] ?? '.';
const target = process.argv[3] ?? 'library';
const scrolls = (process.argv[4] ?? '0').split(',').map(Number);
const { browser, page } = await openPage('http://localhost:5173/');
await page.waitForFunction('Boolean(window.__meta && window.__nav && window.__settings)', null, {
  timeout: 30000,
});
// ni introduction ni écran de démarrage sur les captures
await page.evaluate(`window.__settings.getState().set({ onboarded: true })`);
await page.waitForFunction('!document.querySelector(".splash, .onb")', null, { timeout: 15000 });
await page.waitForTimeout(500);
if (TABS.includes(target)) await page.evaluate(`window.__nav.getState().setTab('${target}')`);
else await page.evaluate(`window.__nav.getState().push('${target}')`);
await page.waitForTimeout(900);
for (const theme of ['doux', 'sombre', 'clair', 'material']) {
  await page.evaluate(`document.dispatchEvent(new CustomEvent('tessel-set-theme', { detail: '${theme}' }))`);
  for (const y of scrolls) {
    await page.evaluate(
      `document.querySelectorAll('.screen__scroll').forEach((e) => { e.scrollTop = ${String(y)}; })`,
    );
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/shell-${target}-${theme}${y ? `-${String(y)}` : ''}.png` });
  }
}
await browser.close();
