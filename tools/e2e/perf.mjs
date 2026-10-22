// Measures frame rate and update cost per area (desktop Chromium, software GL).
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:5173/';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(base);
await page.waitForSelector('.title', { timeout: 60000 });
await page.click('[data-a="new"]'); await page.click('[data-slot="1"]');
const c = await page.$('.c-yes'); if (c) await c.click();
await page.click('.b-ok');
await page.waitForFunction(() => !!window.__gf?.scene?.player, null, { timeout: 30000 });
const maps = process.env.MAPS ? process.env.MAPS.split(',') : ['euclydia_plaza', 'euclydia_rupture', 'nightmare_realm', 'shack_exterior', 'town_invaded', 'forest_lake_cave', 'time_city', 'time_baby_arena'];
for (const m of maps) {
  if (process.env.NOAUDIO) await page.evaluate(() => { window.__gf.session.audio.suspend(); window.__gf.session.audio.stopMusic(); });
  await page.evaluate((id) => { const s = window.__gf.state(); s.flags.bill_threat = true; s.flags.baby_fight = true; s.maxHp = 99; for (const p of s.party) s.hp[p] = 99; window.__gf.teleport(id); }, m);
  await page.waitForFunction((id) => window.__gf.state().mapId === id && !document.querySelector('.loading:not(.hidden)'), m, { timeout: 30000 });
  // walk around for 4 s so camera, actors and AI are all active
  await page.keyboard.down('KeyD'); await page.waitForTimeout(2000); await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyS'); await page.waitForTimeout(2000); await page.keyboard.up('KeyS');
  const r = await page.evaluate(() => { const sc = window.__gf.scene; const s = sc.fpsSamples; return { fps: 1000 / (s.reduce((a, b) => a + b, 0) / s.length), worst: Math.max(...s), cpu: sc.cpuMs, objs: sc.children.list.length, tex: sc.textures.getTextureKeys().length }; });
  console.log(`${m.padEnd(18)} fps ${r.fps.toFixed(0).padStart(3)}  worst frame ${r.worst.toFixed(0).padStart(3)} ms  update ${r.cpu.toFixed(2)} ms  objects ${r.objs}  textures ${r.tex}`);
}
await browser.close();
