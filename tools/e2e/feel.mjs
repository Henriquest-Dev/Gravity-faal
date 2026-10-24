// Movement feel and time of day: idle, run, dash frames, and one exterior at four hours.
// Usage: node tools/e2e/feel.mjs <outDir>   (env BASE, VW, VH)
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';

const out = process.argv[2] ?? 'shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:5173/';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.VW ?? 1280), height: Number(process.env.VH ?? 720) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.stack)));
await page.goto(base + '?nocs&zoom=3');
await page.waitForSelector('.title', { timeout: 60000 });
await page.click('[data-a="new"]');
await page.click('[data-slot="3"]');
const c = await page.$('.c-yes');
if (c) await c.click();
await page.waitForFunction(() => !!window.__gf, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const anim = () => page.evaluate(() => { const p = window.__gf.scene.player; return `${p.state} ${p.sprite.anims.currentAnim?.key} frame=${p.sprite.frame.name} x=${Math.round(p.x)}`; });
console.log('idle', await anim());
await page.screenshot({ path: `${out}/01-idle.png` });
await page.waitForTimeout(800);
console.log('idle later', await anim());
await page.keyboard.down('KeyD');
await page.waitForTimeout(500);
console.log('walk', await anim());
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(400);
console.log('run', await anim());
await page.screenshot({ path: `${out}/02-run.png` });
const x0 = await page.evaluate(() => window.__gf.scene.player.x);
await page.keyboard.press('KeyL');
await page.waitForTimeout(120);
console.log('dash', await anim());
await page.screenshot({ path: `${out}/03-dash.png` });
await page.waitForTimeout(300);
const x1 = await page.evaluate(() => window.__gf.scene.player.x);
console.log('dash distance (with run)', Math.round(x1 - x0));
await page.keyboard.up('ShiftLeft');
await page.keyboard.up('KeyD');
await page.waitForTimeout(500);
// talking NPC gestures, others stand still
const npcFrames = await page.evaluate(async () => {
  const sc = window.__gf.scene;
  const f = () => sc.npcs.map((n) => `${n.id}:${n.actor.sprite.frame.name}`).join(' ');
  const a = f(); await new Promise((r) => setTimeout(r, 900)); const b = f();
  return { a, b };
});
console.log('npcs still?', npcFrames.a === npcFrames.b, npcFrames.a);
await page.evaluate(() => { const gf = window.__gf; const s = gf.state(); s.arc = 2; s.party = ['dipper', 'mabel']; s.character = 'dipper'; gf.teleport('shack_exterior'); });
await page.waitForFunction(() => window.__gf.state().mapId === 'shack_exterior' && !document.querySelector('.loading:not(.hidden)'), null, { timeout: 30000 });
for (const [name, m] of [['manha', 600], ['tarde', 1000], ['entardecer', 1170], ['noite', 1380]]) {
  await page.evaluate((mm) => { window.__gf.state().clock = mm; }, m);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/time-${name}.png` });
}
console.log(errors.slice(0, 10).join('\n') || 'no console errors');
await browser.close();
