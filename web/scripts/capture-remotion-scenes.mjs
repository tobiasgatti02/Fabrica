import { mkdir, writeFile } from 'node:fs/promises';
import { openBrowser } from '@remotion/renderer';

const output = new URL('../public/video-captures/', import.meta.url);
const base = process.env.FABRICA_CAPTURE_URL || 'http://localhost:3000';
const scenes = [
  ['team', '/estudio/equipo', 2500],
  ['inspiration', '/estudio/inspiracion', 3500],
  ['panel', '/estudio/panel', 2500],
];

await mkdir(output, { recursive: true });

const browser = await openBrowser('chrome', { logLevel: 'error' });

try {
  const page = await browser.newPage({
    context: () => null,
    logLevel: 'error',
    indent: false,
    pageIndex: 0,
    onBrowserLog: null,
    onLog: () => {},
  });

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('fabrica:studio-tour:v1:local-preview', 'done');
  });

  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  for (const [name, pathname, settleMs] of scenes) {
    await page.goto({ url: `${base}${pathname}`, timeout: 30_000 });
    await new Promise((resolve) => setTimeout(resolve, settleMs));

    await page.evaluate(() => window.scrollTo(0, 0));
    const result = await page
      ._client()
      .send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });

    const file = new URL(`studio-${name}.png`, output);
    await writeFile(file, Buffer.from(result.value.data, 'base64'));
    console.log(`Captured ${file.pathname}`);
  }
} finally {
  await browser.close({ silent: true });
}
