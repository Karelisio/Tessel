import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { openPage, type DebugWindow } from './browser';

/** Capture image par image d'un scénario de démonstration → MP4 H.264 60 i/s. */
const [mode = 'pixel', out = `capture-${mode}.mp4`] = process.argv.slice(2);
const dir = `${out}.frames`;
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const { browser, page } = await openPage(`http://localhost:5173/?capture&mode=${mode}`);
await page.waitForFunction(() => Boolean((window as unknown as DebugWindow).__capture), null, {
  timeout: 30000,
});
await page.evaluate(() => {
  document.querySelector('.hud')?.remove();
});
const frames = await page.evaluate(() => (window as unknown as DebugWindow).__capture?.frames ?? 0);
for (let i = 0; i < frames; i++) {
  await page.evaluate((f) => (window as unknown as DebugWindow).__capture?.frame(f), i);
  await page.screenshot({ path: join(dir, `${String(i).padStart(5, '0')}.png`) });
  if (i % 60 === 0) console.log(`frame ${i}/${frames}`);
}
await browser.close();

const res = spawnSync(
  ffmpeg as unknown as string,
  [
    '-y',
    '-framerate',
    '60',
    '-i',
    join(dir, '%05d.png'),
    '-vf',
    'scale=720:-2',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '20',
    '-movflags',
    '+faststart',
    out,
  ],
  { stdio: 'inherit' },
);
rmSync(dir, { recursive: true, force: true });
process.exit(res.status ?? 1);
