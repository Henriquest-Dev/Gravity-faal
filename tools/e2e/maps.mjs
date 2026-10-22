// Screenshots every map at zoom 1 and reports console errors / missing assets.
// Usage: node tools/e2e/maps.mjs <outDir> [mapId...]
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';

const out = process.argv[2] ?? 'shots';
const only = process.argv.slice(3);
mkdirSync(out, { recursive: true });
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.VW ?? 1600), height: Number(process.env.VH ?? 1150) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.stack}`));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });
await page.goto('http://localhost:5173/?zoom=' + (process.env.ZOOM ?? '1'));
await page.waitForSelector('.title', { timeout: 60000 });
await page.click('[data-a="new"]');
await page.click('[data-slot="3"]');
const c = await page.$('.c-yes');
if (c) await c.click();
await page.click('.b-ok');
await page.waitForFunction(() => !!window.__gf, null, { timeout: 30000 });
await page.waitForTimeout(1200);
const maps = only.length ? only : await page.evaluate(() => Object.keys(window.__gf.scene.registry.list ?? {}).length >= 0 && ['euclydia_plaza', 'bill_house', 'observatory', 'euclydia_rupture', 'nightmare_realm', 'shack_exterior', 'shack_interior', 'town_center', 'forest_lake_cave', 'mcgucket_workshop', 'portal_bunker', 'town_invaded', 'time_city', 'time_archive', 'time_baby_arena', 'timeline_crossing']);
for (const m of maps) {
  await page.evaluate((id) => {
    const gf = window.__gf;
    const s = gf.state();
    const arc2 = !['euclydia_plaza', 'bill_house', 'observatory', 'euclydia_rupture', 'nightmare_realm'].includes(id);
    s.arc = arc2 ? 2 : 1;
    s.party = arc2 ? ['dipper', 'mabel'] : ['bill_child'];
    s.character = s.party[0];
    if (s.mapId !== id) gf.teleport(id);
  }, m);
  await page.waitForFunction((id) => window.__gf.state().mapId === id && !document.querySelector('.loading:not(.hidden)'), m, { timeout: 30000 });
  await page.waitForTimeout(900);
  if (process.env.EVAL) await page.evaluate(process.env.EVAL);
  if (process.env.LOOK) {
    // frame a world point (tiles) for a still: "x,y"
    await page.evaluate((v) => { const [x, y] = v.split(',').map(Number); const cam = window.__gf.scene.cameras.main; cam.stopFollow(); cam.centerOn(x * 32, y * 32); }, process.env.LOOK);
    await page.waitForTimeout(400);
  }
  if (process.env.WALK) {
    const [key, ms] = process.env.WALK.split(':');
    await page.keyboard.down(key);
    await page.waitForTimeout(Number(ms));
    await page.keyboard.up(key);
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${out}/${m}.png` });
  console.log('shot', m);
}
console.log(errors.filter((e) => !e.includes('GL Driver')).slice(0, 30).join('\n') || 'no console errors');
await browser.close();
