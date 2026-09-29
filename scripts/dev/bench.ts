import { openPage, type DebugWindow } from './browser';

/** Lance le benchmark scripté dans Chromium headless et affiche les mesures par phase. */
const [mode = 'pixel'] = process.argv.slice(2);
const { browser, page } = await openPage(`http://localhost:5173/?mode=${mode}`);
await page.waitForFunction(() => Boolean((window as unknown as DebugWindow).__bench), null, {
  timeout: 30000,
});
const results = await page.evaluate(() => (window as unknown as DebugWindow).__bench?.());
for (const r of results ?? []) {
  const s = r.stats;
  console.log(
    `${mode.padEnd(8)} ${r.phase.padEnd(6)} fps ${s.fps.toFixed(1).padStart(5)}  frame p95 ${s.frameP95.toFixed(1).padStart(6)} ms  JS moy ${s.workAvg.toFixed(2)} ms  JS p95 ${s.workP95.toFixed(2)} ms`,
  );
}
await browser.close();
