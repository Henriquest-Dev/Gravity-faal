// Plays cutscenes and captures frames along the way.
// Usage: node tools/e2e/cutscenes.mjs <outDir> [cutsceneId...]   (env VW, VH)
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';

const out = process.argv[2] ?? 'shots';
mkdirSync(out, { recursive: true });
const ALL = {
  a1_intro: ['euclydia_plaza', 1], a1_fountain: ['euclydia_plaza', 1], a1_vision: ['observatory', 1], a1_rupture: ['euclydia_rupture', 1],
  a1_nightmare: ['nightmare_realm', 1], a1_heart: ['nightmare_realm', 1], a2_intro: ['shack_exterior', 2], a2_journal: ['forest_lake_cave', 2],
  a2_bill_ally: ['portal_bunker', 2], a2_invasion: ['town_invaded', 2], a2_time_baby: ['time_baby_arena', 2], a2_crossing: ['timeline_crossing', 2],
};
const only = process.argv.slice(3);
const list = only.length ? only : Object.keys(ALL);
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.VW ?? 1280), height: Number(process.env.VH ?? 720) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.stack)));
await page.goto((process.env.BASE ?? 'http://localhost:5173/') + '?nocs');
await page.waitForSelector('.title', { timeout: 60000 });
await page.click('[data-a="new"]');
await page.click('[data-slot="3"]');
const c = await page.$('.c-yes');
if (c) await c.click();
await page.waitForFunction(() => !!window.__gf, null, { timeout: 30000 });
await page.waitForTimeout(1500);
for (const id of list) {
  const [map, arc] = ALL[id];
  await page.evaluate(([m, a]) => {
    const gf = window.__gf; const s = gf.state();
    s.arc = a; s.party = a === 2 ? ['dipper', 'mabel'] : ['bill_child']; s.character = s.party[0];
    s.flags.bill_ally = true;
    for (const c of s.party) s.hp[c] = s.maxHp;
    if (s.mapId !== m) gf.teleport(m);
  }, [map, arc]);
  await page.waitForFunction((m) => window.__gf.state().mapId === m && !document.querySelector('.loading:not(.hidden)'), map, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate((i) => { window.__gf.scene.playCutscene(i, true); }, id);
  let n = 0;
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(k === 0 ? 900 : 1300);
    const st = await page.evaluate(() => ({ cine: window.__gf.scene.ui.cinematic, dlg: !!document.querySelector('.dialogue:not(.hidden)'), choice: !!document.querySelector('.dialogue:not(.hidden) .d-choice'), card: !!document.querySelector('.card:not(.hidden)') }));
    if (!st.cine && !st.dlg) break;
    if (n < 14) await page.screenshot({ path: `${out}/${id}-${String(n++).padStart(2, '0')}.png` });
    if (st.choice) await page.click('.d-choice');
    else if (st.dlg) { await page.click('.d-body'); await page.waitForTimeout(150); await page.click('.d-body').catch(() => {}); }
  }
  console.log('played', id, n, 'frames');
}
console.log(errors.slice(0, 20).join('\n') || 'no console errors');
await browser.close();
