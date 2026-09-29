/** Capture de la coque à onglets dans chaque thème. */
import { openPage } from './browser';

const out = process.argv[2] ?? '.';
const tab = process.argv[3] ?? 'library';
const { browser, page } = await openPage('http://localhost:5173/');
await page.waitForFunction('Boolean(window.__meta)', null, { timeout: 30000 });
await page.waitForTimeout(800);
if (tab !== 'library')
  await page.click(
    `.tabbar__item >> nth=${['library', 'daily', 'gallery', 'create', 'profile'].indexOf(tab)}`,
  );
for (const theme of ['doux', 'sombre', 'clair', 'material']) {
  await page.evaluate(`document.dispatchEvent(new CustomEvent('tessel-set-theme', { detail: '${theme}' }))`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/shell-${tab}-${theme}.png` });
}
await browser.close();
