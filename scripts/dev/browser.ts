import { chromium, type Browser, type Page } from 'playwright-core';

export const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Lance Chromium headless avec WebGL (SwiftShader) au format téléphone. */
export async function openPage(
  url: string,
  size = { width: 412, height: 892 },
): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const page = await browser.newPage({
    viewport: size,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text().slice(0, 2000));
  });
  page.on('pageerror', (e) => {
    console.log('[pageerror]', e.message);
  });
  await page.goto(url);
  return { browser, page };
}

/** Points d'entrée de debug exposés par l'app (voir src/ui/play/PlayScreen.tsx). */
export interface DebugWindow {
  __tessel?: { game: unknown };
  __capture?: { frames: number; frame(i: number): void };
  __bench?: () => Promise<
    { phase: string; stats: { fps: number; frameP95: number; workAvg: number; workP95: number } }[]
  >;
}
export const dbg = (): DebugWindow => window as unknown as DebugWindow;
