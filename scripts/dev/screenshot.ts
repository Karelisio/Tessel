import { openPage, type DebugWindow } from './browser';

const [url = 'http://localhost:5173/', out = 'shot.png', setup = ''] = process.argv.slice(2);
const { browser, page } = await openPage(url);
await page.waitForFunction(() => Boolean((window as unknown as DebugWindow).__tessel?.game), null, {
  timeout: 30000,
});
if (setup) await page.evaluate(setup);
await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close();
