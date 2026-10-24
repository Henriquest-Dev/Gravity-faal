// In-browser mechanics checks (real engine, real input events).
// Usage: node tools/e2e/mechanics.mjs <outDir> [baseUrl]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'shots';
const base = process.argv[3] ?? 'http://localhost:5173/?nocs';
mkdirSync(out, { recursive: true });
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const errors = [];
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

async function boot(page) {
  page.on('pageerror', (e) => errors.push(e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base);
  await page.waitForSelector('.title', { timeout: 60000 });
  await page.click('[data-a="new"]');
  await page.click('[data-slot="2"]');
  const c = await page.$('.c-yes');
  if (c) await c.click();
  await page.waitForFunction(() => !!window.__gf?.scene?.player, null, { timeout: 30000 });
  await page.evaluate(() => {
    const s = window.__gf.state();
    s.arc = 2; s.party = ['dipper', 'mabel']; s.character = 'dipper'; s.flags.stan_briefing = true;
    s.hp = { dipper: 6, mabel: 6 };
    window.__gf.teleport('shack_exterior', 'default');
  });
  await page.waitForFunction(() => window.__gf.state().mapId === 'shack_exterior' && !document.querySelector('.loading:not(.hidden)'), null, { timeout: 30000 });
  await page.waitForTimeout(600);
}

const P = (page) => page.evaluate(() => {
  const p = window.__gf.scene.player;
  return { x: p.x, y: p.y, z: p.z, level: p.body.level, state: p.state, anim: p.sprite.anims.currentAnim?.key, depth: p.sprite.depth, dir: p.dir };
});
const place = (page, tx, ty) => page.evaluate(([x, y]) => { const p = window.__gf.scene.player; p.body.x = x * 32; p.body.y = y * 32; p.body.level = 0; p.body.airborne = false; p.z = 0; p.force('idle'); }, [tx, ty]);
const hold = async (page, keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of [...keys].reverse()) await page.keyboard.up(k); await page.waitForTimeout(80); };

// ---------------------------------------------------------------- desktop
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await boot(page);

  // speed: straight vs diagonal, sampled from the engine's measured ground speed
  const fps = await page.evaluate(() => { const s = window.__gf.scene.fpsSamples; return 1000 / (s.reduce((a, b) => a + b, 0) / s.length); });
  results.push(`INFO  headless render rate ≈ ${fps.toFixed(0)} fps (software GL)`);
  const sampleSpeed = async (keys) => {
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(250);
    const v = [];
    for (let i = 0; i < 6; i++) { v.push(await page.evaluate(() => window.__gf.scene.player.speedNow)); await page.waitForTimeout(60); }
    const anim = (await P(page)).anim;
    for (const k of [...keys].reverse()) await page.keyboard.up(k);
    await page.waitForTimeout(100);
    return { speed: v.reduce((a, b) => a + b, 0) / v.length, anim };
  };
  await place(page, 24, 20.5);
  const st = await sampleSpeed(['KeyD']);
  check('walk east plays walk:east animation', (st.anim ?? '').includes('walk:east'), st.anim);
  await place(page, 24, 20.5);
  const dg = await sampleSpeed(['KeyD', 'KeyS']);
  const straight = st.speed;
  check('diagonal speed equals straight speed (±5%)', Math.abs(dg.speed - st.speed) / st.speed < 0.05, `straight ${st.speed.toFixed(1)} px/s, diagonal ${dg.speed.toFixed(1)} px/s`);
  let b = await P(page);
  let a;
  check('last facing kept after stopping', ['east', 'south'].includes(b.dir), b.dir);

  // run uses its own cycle and is faster
  await place(page, 24, 20.5);
  const rn = await sampleSpeed(['ShiftLeft', 'KeyD']);
  check('run uses the run sheet', (rn.anim ?? '').includes(':run:'), rn.anim);
  check('run is faster than walk', rn.speed > straight * 1.4, `${rn.speed.toFixed(0)} vs ${straight.toFixed(0)} px/s`);
  const rate = await page.evaluate(() => window.__gf.scene.player.sprite.anims.timeScale);
  check('animation rate follows ground speed (no sliding)', rate > 0.3 && rate <= 1.6, `timeScale ${rate}`);

  // building wall: walking north into the Shack stops at its footprint
  await place(page, 17.5, 16.6);
  await hold(page, ['KeyW'], 900);
  b = await P(page);
  check('Shack wall blocks (feet stop at footprint)', b.y >= 15 * 32 && b.y < 15 * 32 + 12, `y=${b.y.toFixed(1)} footprint bottom=480`);

  // behind the building: drawn under it and the façade fades
  await place(page, 19.5, 9.6);
  await page.waitForTimeout(400);
  const behind = await page.evaluate(() => {
    const sc = window.__gf.scene;
    const b = sc.built.buildings.find((x) => x.def.id === 'mystery_shack');
    return { pd: sc.player.sprite.depth, bd: b.img.depth, alpha: b.img.alpha };
  });
  check('behind the Shack the player is drawn under it', behind.pd < behind.bd, JSON.stringify(behind));
  check('façade turns translucent when the player is behind', behind.alpha < 0.9, `alpha ${behind.alpha.toFixed(2)}`);
  await page.screenshot({ path: `${out}/m-behind-shack.png` });
  await place(page, 19.5, 16.4);
  await page.waitForTimeout(400);
  const front = await page.evaluate(() => {
    const sc = window.__gf.scene;
    const b = sc.built.buildings.find((x) => x.def.id === 'mystery_shack');
    return { pd: sc.player.sprite.depth, bd: b.img.depth };
  });
  check('in front of the Shack the player is drawn over it', front.pd > front.bd, JSON.stringify(front));

  // pine: in front of the trunk draws over, behind draws under
  const pine = await page.evaluate(() => {
    const sc = window.__gf.scene;
    const f = sc.built.fades.filter((x) => x.baseY !== Infinity && x.img.texture.key.includes('pine')).sort((u, v) => Math.hypot(u.img.x - 33.6 * 32, u.baseY - 20.2 * 32) - Math.hypot(v.img.x - 33.6 * 32, v.baseY - 20.2 * 32))[0];
    return f ? { x: f.img.x, y: f.baseY, depth: f.img.depth } : null;
  });
  if (pine) {
    await place(page, (pine.x) / 32, (pine.y + 14) / 32);
    await page.waitForTimeout(200);
    let p1 = await P(page);
    check('in front of a pine trunk: drawn over the tree', p1.depth > pine.depth, `player ${p1.depth.toFixed(0)} tree ${pine.depth.toFixed(0)}`);
    await place(page, (pine.x) / 32, (pine.y - 16) / 32);
    await page.waitForTimeout(1200);
    p1 = await P(page);
    const al = await page.evaluate((px) => window.__gf.scene.built.fades.find((f) => Math.abs(f.img.x - px) < 1).img.alpha, pine.x);
    check('behind a pine: drawn under it, canopy translucent', p1.depth < pine.depth && al < 0.9, `alpha ${al.toFixed(2)}`);
    await page.screenshot({ path: `${out}/m-behind-pine.png` });
    // trunk blocks
    await place(page, pine.x / 32, (pine.y + 20) / 32);
    await hold(page, ['KeyW'], 600);
    p1 = await P(page);
    check('pine trunk blocks the feet box', p1.y > pine.y, `y ${p1.y.toFixed(0)} trunk base ${pine.y}`);
  } else check('pine found for depth test', false);

  // water: shallow slows, deep swims, exit only on banks
  await place(page, 31.5, 22.6);
  await hold(page, ['KeyS'], 900);
  b = await P(page);
  check('deep water switches to swimming', b.state === 'swim' && (b.anim ?? '').includes('swim'), `${b.state} ${b.anim}`);
  await page.screenshot({ path: `${out}/m-swim.png` });
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  b = await P(page);
  check('cannot jump while swimming', b.z === 0 && b.state === 'swim', b.state);
  await hold(page, ['KeyW'], 1200);
  b = await P(page);
  check('climbs out on the bank and walks again', b.state !== 'swim', b.state);

  // bridge: walkers on the deck at level 1, swimmers under it at level 0
  await place(page, 21.8, 22.4);
  await hold(page, ['KeyS'], 500);
  b = await P(page);
  check('stepping onto the bridge raises to deck level', b.level === 1, `level ${b.level} y ${(b.y / 32).toFixed(2)}`);
  await page.screenshot({ path: `${out}/m-bridge.png` });
  await hold(page, ['KeyS'], 2400);
  b = await P(page);
  check('leaving the bridge returns to ground level', b.level === 0 && b.state !== 'swim', `level ${b.level} ${b.state}`);
  await place(page, 25.5, 24.6);
  await page.keyboard.down('KeyA');
  await page.waitForFunction(() => window.__gf.scene.player.x < 20.8 * 32, null, { timeout: 20000 }).catch(() => {});
  await page.keyboard.up('KeyA');
  b = await P(page);
  const deck = await page.evaluate(() => window.__gf.scene.children.list.filter((o) => o.texture?.key?.startsWith('bridge_')).map((o) => o.depth));
  check('a swimmer passes under the bridge (stays level 0, drawn below deck)', b.level === 0 && b.x < 21.6 * 32 && b.depth < Math.max(...deck), `x ${(b.x / 32).toFixed(1)} level ${b.level}`);

  // jumping clears a low log, never a solid tree
  const log = await page.evaluate(() => { const r = window.__gf.scene.grid.getRect('prop:tutorial_log'); return r; });
  await place(page, (log.x + log.w / 2) / 32, (log.y + log.h + 14) / 32);
  await hold(page, ['KeyW'], 500);
  b = await P(page);
  check('the log blocks walking', b.y >= log.y + log.h, `y ${b.y.toFixed(0)} log bottom ${(log.y + log.h).toFixed(0)}`);
  await page.keyboard.down('KeyW');
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyW');
  b = await P(page);
  check('jumping clears the log', b.y < log.y, `y ${b.y.toFixed(0)} log top ${log.y.toFixed(0)}`);
  await place(page, 17.5, 16.6);
  await page.keyboard.down('KeyW');
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyW');
  b = await P(page);
  check('jumping does not pass through the Shack', b.y >= 15 * 32, `y ${b.y.toFixed(0)}`);

  // dialogue: E talks, Space does not jump during dialogue, Enter advances
  await place(page, 26.5, 17.3);
  await page.evaluate(() => { window.__gf.scene.player.dir = 'north'; });
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  const open = await page.$eval('.dialogue', (e) => !e.classList.contains('hidden'));
  check('E opens a dialogue with the NPC in front', open);
  await page.screenshot({ path: `${out}/m-dialogue.png` });
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  b = await P(page);
  const stillOpen = await page.$eval('.dialogue', (e) => !e.classList.contains('hidden'));
  check('Space during dialogue does not jump (dialogue keeps the controls)', b.z === 0 && b.state === 'dialogue' && stillOpen, b.state);
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(250); }
  const closed = await page.$eval('.dialogue', (e) => e.classList.contains('hidden'));
  check('Enter advances and closes the dialogue', closed);
  await page.waitForTimeout(200);
  b = await P(page);
  check('the Enter that closed the dialogue did not trigger an action', b.state === 'idle' || b.state === 'walk', b.state);

  // switching characters keeps both on valid ground
  await place(page, 24, 20.5);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(300);
  const sw = await page.evaluate(() => {
    const sc = window.__gf.scene;
    return { ch: window.__gf.state().character, ok: sc.grid.standable(sc.player.x, sc.player.y), cok: sc.grid.standable(sc.companion.x, sc.companion.y) };
  });
  check('Q switches to Mabel and both stand on valid tiles', sw.ch === 'mabel' && sw.ok && sw.cok, JSON.stringify(sw));

  // grapple with range and a valid target
  await place(page, 33.5, 26.6);
  await page.evaluate(() => { window.__gf.state().abilities.push('grapple'); window.__gf.state().selectedAbility.mabel = 'grapple'; window.__gf.state().energy = 10; window.__gf.scene.player.dir = 'south'; });
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(700);
  b = await P(page);
  check('Mabel grapples to the islet post within range', Math.abs(b.x / 32 - 34.5) < 1 && Math.abs(b.y / 32 - 29.9) < 1, `at ${(b.x / 32).toFixed(1)},${(b.y / 32).toFixed(1)}`);
  await place(page, 24, 20.5);
  await page.evaluate(() => { window.__gf.scene.player.dir = 'north'; window.__gf.state().energy = 10; });
  await page.waitForTimeout(800);
  const before = await P(page);
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(500);
  b = await P(page);
  check('no valid post: the hook does not move Mabel', Math.hypot(b.x - before.x, b.y - before.y) < 2);

  // pause on hidden page and save/load round trip
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Escape opens the pause menu', await page.$eval('.panel', (e) => !e.classList.contains('hidden')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.close();
}

// ----------------------------------------------------------------- mobile
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await boot(page);
  await place(page, 24, 20.5);
  await page.waitForTimeout(300);
  const visible = await page.$eval('.touch', (e) => !e.classList.contains('hidden'));
  check('touch controls visible on a touch device', visible);
  await page.screenshot({ path: `${out}/m-mobile.png` });
  const btn = await page.$eval('.t-primary', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; });
  check('primary button is at least 48 CSS px', btn.w >= 48, `${btn.w}px`);
  const cdp = await ctx.newCDPSession(page);
  const tp = (id, x, y) => ({ x, y, id, radiusX: 5, radiusY: 5, force: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(1, 120, 300)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(1, 170, 300)] });
  await page.waitForTimeout(300);
  const a = await P(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(1, 170, 300), tp(2, btn.x, btn.y)] });
  await page.waitForTimeout(120);
  const atk = await P(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [tp(2, btn.x, btn.y)] }); // CDP lists the released finger
  await page.waitForTimeout(600);
  const b = await P(page);
  const stick = await page.evaluate(() => window.__gf.session.input.touchMove);
  check('second finger triggers the action while the first steers', atk.state === 'ability', atk.state);
  check('releasing the button does not cancel the joystick', stick.x > 0.5 && b.x > a.x, `stick ${JSON.stringify(stick)}, moved ${(b.x - a.x).toFixed(0)}px`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [tp(1, 170, 300)] });
  await page.waitForTimeout(300);
  const c = await P(page);
  await page.waitForTimeout(300);
  const d = await P(page);
  check('lifting the stick finger stops the player', Math.abs(d.x - c.x) < 1);
  await ctx.close();
}

console.log(results.join('\n'));
console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 10).join('\n') : 'no page errors');
await browser.close();
