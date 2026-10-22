// Interface stills: title, HUD, dialogue with portrait, journal, touch layout.
// Usage: node tools/e2e/ui.mjs <outDir>   (env VW, VH, TOUCH=1 for a phone-like touch viewport)
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';

const out = process.argv[2] ?? 'shots';
mkdirSync(out, { recursive: true });
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const touch = !!process.env.TOUCH;
const ctx = await browser.newContext({ viewport: { width: Number(process.env.VW ?? 1280), height: Number(process.env.VH ?? 720) }, hasTouch: touch, isMobile: touch });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.stack)));
const tag = touch ? 'touch-' : '';
await page.goto('http://localhost:5173/');
await page.waitForSelector('.title', { timeout: 60000 });
await page.waitForTimeout(2600);
await page.screenshot({ path: `${out}/${tag}01-title.png` });
await page.click('[data-a="new"]');
await page.click('[data-slot="3"]');
const c = await page.$('.c-yes');
if (c) await c.click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/${tag}02-banner.png` });
await page.click('.b-ok');
await page.waitForFunction(() => !!window.__gf, null, { timeout: 30000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${out}/${tag}03-hud.png` });
await page.evaluate(() => window.__gf.scene.talk('professor'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/${tag}04-dialogue.png` });
for (let i = 0; i < 4; i++) { const ch = await page.$('.d-choice'); if (ch) await ch.click(); else if (await page.$('.dialogue:not(.hidden)')) await page.click('.d-body'); await page.waitForTimeout(500); }
await page.evaluate(() => { const gf = window.__gf; const s = gf.state(); s.arc = 2; s.party = ['dipper', 'mabel']; s.character = 'dipper'; gf.teleport('shack_interior'); });
await page.waitForTimeout(3000);
await page.evaluate(() => window.__gf.scene.talk('stan'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/${tag}05-dialogue-stan.png` });
for (let i = 0; i < 3; i++) { if (await page.$('.dialogue:not(.hidden) .d-choice')) break; if (await page.$('.dialogue:not(.hidden)')) await page.click('.d-body'); await page.waitForTimeout(400); await page.click('.d-body').catch(() => {}); await page.waitForTimeout(700); }
await page.screenshot({ path: `${out}/${tag}06-dialogue-stan-b.png` });
await page.keyboard.press('Escape');
await page.evaluate(() => window.__gf.scene.ui.open('journal'));
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/${tag}07-journal.png` });
await page.evaluate(() => window.__gf.scene.ui.open('pause'));
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/${tag}08-pause.png` });
console.log(errors.slice(0, 20).join('\n') || 'no console errors');
await browser.close();
