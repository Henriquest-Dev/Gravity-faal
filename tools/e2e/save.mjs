// Save/restore through the real UI: save from the pause menu, reload the page,
// continue from the title screen and check world state and position.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/?nocs';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const out = [];
const check = (n, ok, d = '') => out.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`);
await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('.title');
await page.click('[data-a="new"]');
await page.click('[data-slot="1"]');
await page.waitForFunction(() => !!window.__gf?.scene?.player);
await page.waitForTimeout(500);
// change the world: pick the fountain clue, move somewhere specific
await page.evaluate(() => {
  const s = window.__gf.state();
  s.flags.talked_professor = true;
  s.inventory.geometry_shard = 2;
  s.objects['euclydia_plaza/north_gate'] = 'open';
  s.vars.empathy = 4;
  const p = window.__gf.scene.player;
  p.body.x = 19 * 32; p.body.y = 21 * 32;
});
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.click('[data-open="saves"]');
await page.click('[data-save="2"]');
await page.waitForTimeout(300);
const stored = await page.evaluate(() => !!localStorage.getItem('gf.save.slot2'));
check('saving from the pause menu writes slot 2', stored);
// slot 2 was empty: no confirmation expected; now save again and expect a confirmation
await page.click('[data-save="2"]');
const confirmShown = await page.$('.confirm');
check('overwriting a slot asks for confirmation', !!confirmShown);
if (confirmShown) await page.click('.c-no');
await page.reload();
await page.waitForSelector('.title');
const contLabel = await page.$eval('[data-a="continue"]', (e) => e.textContent);
check('title offers Continue with the latest slot', /página 2/i.test(contLabel ?? ''), contLabel ?? '');
await page.click('[data-a="continue"]');
await page.waitForFunction(() => !!window.__gf?.scene?.player);
await page.waitForTimeout(800);
const st = await page.evaluate(() => {
  const s = window.__gf.state(); const p = window.__gf.scene.player;
  return { map: s.mapId, flag: s.flags.talked_professor, shards: s.inventory.geometry_shard, gate: s.objects['euclydia_plaza/north_gate'], emp: s.vars.empathy, x: p.x / 32, y: p.y / 32, gateSolid: !!window.__gf.scene.grid.getRect('obj:north_gate') };
});
check('flags, inventory, variables and object states restored', st.flag === true && st.shards === 2 && st.gate === 'open' && st.emp === 4, JSON.stringify(st));
check('opened door stays open (no collision) after reload', st.gateSolid === false);
check('position restored', Math.abs(st.x - 19) < 0.2 && Math.abs(st.y - 21) < 0.2, `${st.x.toFixed(2)},${st.y.toFixed(2)}`);
// an invalid saved position falls back to a safe spawn
await page.evaluate(() => {
  const f = JSON.parse(localStorage.getItem('gf.save.slot2'));
  f.state.pos = { x: 1 * 32, y: 1 * 32, level: 0, dir: 'south' }; // inside the forest wall
  delete f.checksum;
  localStorage.setItem('gf.save.slot2', JSON.stringify(f));
});
await page.reload();
await page.waitForSelector('.title');
await page.click('[data-a="continue"]');
await page.waitForFunction(() => !!window.__gf?.scene?.player);
await page.waitForTimeout(800);
const safe = await page.evaluate(() => { const sc = window.__gf.scene; return { ok: sc.grid.standable(sc.player.x, sc.player.y), x: sc.player.x / 32, y: sc.player.y / 32 }; });
check('invalid saved position is replaced by a safe point', safe.ok && safe.x > 2.5, JSON.stringify(safe));
// corrupt slot is reported, not crashing the title
await page.evaluate(() => localStorage.setItem('gf.save.slot3', '{"format":"gravity-falls-save","checksum":"deadbeef","state":{}}'));
await page.reload();
await page.waitForSelector('.title');
await page.click('[data-a="load"]');
const err = await page.$eval('.panel', (e) => e.textContent);
check('corrupt slot shows an identifiable error in the list', /Inválida/.test(err ?? ''));
console.log(out.join('\n'));
await browser.close();
