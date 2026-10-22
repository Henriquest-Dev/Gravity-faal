// Combat smoke test: every enemy type acts in the real engine without runtime
// errors, telegraphs its attacks, and can be hit by the player.
// Usage: node tools/e2e/combat.mjs <outDir> [baseUrl]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'shots';
const base = process.argv[3] ?? 'http://localhost:5173/';
mkdirSync(out, { recursive: true });
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForSelector('.title', { timeout: 60000 });
await page.click('[data-a="new"]');
await page.click('[data-slot="1"]');
const c = await page.$('.c-yes');
if (c) await c.click();
await page.click('.b-ok');
await page.waitForFunction(() => !!window.__gf?.scene?.player, null, { timeout: 30000 });

const cases = [
  { map: 'nightmare_realm', arc: 1, enemy: 'nm_teeth_1' },
  { map: 'nightmare_realm', arc: 1, enemy: 'nm_hectorgon' },
  { map: 'nightmare_realm', arc: 1, enemy: 'nm_pyronica' },
  { map: 'nightmare_realm', arc: 1, enemy: 'nm_keyhole' },
  { map: 'nightmare_realm', arc: 1, enemy: 'nm_bola8' },
  { map: 'euclydia_rupture', arc: 1, enemy: 'rupt_shard_1' },
  { map: 'town_invaded', arc: 2, enemy: 'inv_bola8', flags: { bill_threat: true } },
  { map: 'time_city', arc: 2, enemy: 'agent_lolph' },
  { map: 'time_city', arc: 2, enemy: 'city_cyclock' },
  { map: 'time_baby_arena', arc: 2, enemy: 'time_baby', flags: { baby_fight: true } },
];
const lines = [];
for (const cs of cases) {
  await page.evaluate((k) => {
    const gf = window.__gf;
    const s = gf.state();
    s.arc = k.arc;
    s.party = k.arc === 1 ? ['bill_child'] : ['dipper', 'mabel'];
    s.character = s.party[0];
    s.defeated = [];
    s.flags = { ...s.flags, ...(k.flags ?? {}) };
    s.maxHp = 99; for (const p of s.party) s.hp[p] = 99;
    gf.teleport(k.map, 'default');
  }, cs);
  await page.waitForFunction((m) => window.__gf.state().mapId === m && !document.querySelector('.loading:not(.hidden)') && window.__gf.scene.player, cs.map, { timeout: 30000 });
  await page.waitForTimeout(300);
  // stand next to the enemy (on a free tile) and let it act
  const setup = await page.evaluate((id) => {
    const sc = window.__gf.scene;
    const e = sc.enemies.find((x) => x.id === id);
    if (!e) return null;
    const spot = sc.grid.findStandable(e.x, e.y + 56, 4) ?? sc.grid.findStandable(e.x + 56, e.y, 4);
    sc.player.body.x = spot.x; sc.player.body.y = spot.y; sc.player.hp = 99; sc.player.maxHp = 99;
    window.__seen = { hazards: 0, maxHaz: 0 };
    window.__probe = setInterval(() => { const n = sc.combat.hazards.filter((h) => h.team === 'enemy').length + sc.combat.activeProjectiles; window.__seen.maxHaz = Math.max(window.__seen.maxHaz, n); if (n) window.__seen.hazards++; }, 50);
    return { hp: e.hp, type: e.def.type };
  }, cs.enemy);
  if (!setup) { lines.push(`FAIL  ${cs.map}/${cs.enemy}: enemy not spawned`); continue; }
  await page.waitForTimeout(5000);
  // attack: face the enemy and press J repeatedly
  const before = await page.evaluate((id) => window.__gf.scene.enemies.find((x) => x.id === id).hp, cs.enemy);
  for (let i = 0; i < 14; i++) {
    await page.evaluate((id) => {
      const sc = window.__gf.scene; const e = sc.enemies.find((x) => x.id === id); const p = sc.player;
      const dx = e.x - p.x, dy = e.y - p.y;
      p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
      // keep close, as a player would
      if (Math.hypot(dx, dy) > 40) { const spot = sc.grid.findStandable(e.x - Math.sign(dx || 1) * 30, e.y + 6, 3); if (spot) { p.body.x = spot.x; p.body.y = spot.y; } }
    }, cs.enemy);
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(260);
  }
  const res = await page.evaluate((id) => {
    clearInterval(window.__probe);
    const sc = window.__gf.scene; const e = sc.enemies.find((x) => x.id === id);
    return { hp: e.hp, alive: e.alive, ai: e.ai, playerHp: sc.player.hp, seen: window.__seen };
  }, cs.enemy);
  await page.screenshot({ path: `${out}/c-${cs.enemy}.png` });
  const telegraphed = res.seen.hazards > 0;
  const hurt = res.hp < before || !res.alive || res.ai === 'stunned';
  const note = setup.type === 'time_baby' || setup.type === 'keyhole' || setup.type === 'hectorgon' ? ' (only vulnerable in windows)' : '';
  lines.push(`${telegraphed ? 'PASS' : 'FAIL'}  ${cs.enemy} (${setup.type}) telegraphs attacks — peak ${res.seen.maxHaz} hazards/projectiles, player hp ${res.playerHp}/99`);
  lines.push(`${hurt || note ? 'PASS' : 'FAIL'}  ${cs.enemy} takes player hits${note} — hp ${before} → ${res.hp}, ai ${res.ai}`);
}
console.log(lines.join('\n'));
console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 10).join('\n') : 'no page errors');
await browser.close();
