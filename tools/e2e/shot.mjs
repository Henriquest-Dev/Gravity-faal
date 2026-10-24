// Visual smoke test: boots the game in Chromium, starts arc 2 at the Mystery Shack,
// drives the player and saves screenshots. Usage: node tools/e2e/shot.mjs <outDir> [url]
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';

const out = process.argv[2] ?? 'shots';
const url = process.argv[3] ?? 'http://localhost:5173/?debug&nocs';
mkdirSync(out, { recursive: true });
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const vw = Number(process.env.VW ?? 1280), vh = Number(process.env.VH ?? 720);
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack}`));
page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });
await page.goto(url);
await page.waitForSelector('.title', { timeout: 60000 });
await page.screenshot({ path: `${out}/01-title.png` });
// start directly in arc 2 for the Mystery Shack validation area
await page.evaluate(() => {
  const g = window.__gfBoot;
  void g;
});
await page.click('[data-a="new"]');
await page.click('[data-slot="1"]');
const confirm = await page.$('.c-yes');
if (confirm) await confirm.click();
await page.waitForFunction(() => !!window.__gf, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/02-arc1-start.png` });
const map = process.env.MAP ?? 'shack_exterior';
await page.evaluate((m) => {
  const gf = window.__gf;
  gf.session.state = { ...gf.session.state };
  const s = gf.state();
  s.arc = 2; s.party = ['dipper', 'mabel']; s.character = 'dipper';
  gf.teleport(m, 'default');
}, map);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/03-${map}.png` });
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k); };
await hold(['KeyS'], 900);
await page.screenshot({ path: `${out}/04-walk-south.png` });
await hold(['KeyD', 'ShiftLeft'], 700);
await page.screenshot({ path: `${out}/05-run-east.png` });
await hold(['KeyW'], 1200);
await page.screenshot({ path: `${out}/06-north.png` });
console.log(logs.slice(-40).join('\n'));
await browser.close();
