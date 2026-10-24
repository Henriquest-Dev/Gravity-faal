// Title screen stills over time (the Shack changes version every 7 s).
// Usage: node tools/e2e/title.mjs <outDir>   (env BASE, VW, VH)
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';

const out = process.argv[2] ?? 'shots';
mkdirSync(out, { recursive: true });
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.VW ?? 1280), height: Number(process.env.VH ?? 720) } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack)));
await page.goto((process.env.BASE ?? 'http://localhost:5173/') + '?nocs');
await page.waitForSelector('.title', { timeout: 60000 });
for (const [i, t] of [3000, 7000, 7000, 7000].entries()) {
  await page.waitForTimeout(t);
  await page.screenshot({ path: `${out}/title-${i}.png` });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
