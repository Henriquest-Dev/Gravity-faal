import Phaser from 'phaser';
import { TILE } from '../../core/grid';
import type { BuildingDef } from '../../core/types';
import { texKey } from '../assets';

/**
 * Builds a façade texture from catalogue materials: walls, roof, door, windows
 * and sign. Large buildings are composed instead of scaled-up props so their
 * pixel density matches the characters and the 32px grid.
 */

interface Style { wall: string; wallTint: string; roof: string; roofTint: string; trim: string; door: string; window: string; gable: boolean }
const STYLES: Record<BuildingDef['style'], Style> = {
  shack: { wall: 'wood_floor', wallTint: 'rgba(40,18,6,0.35)', roof: 'grass_dark', roofTint: 'rgba(60,50,20,0.35)', trim: '#2a1a0e', door: '#3b2412', window: '#ffd66b', gable: true },
  cabin: { wall: 'wood_floor', wallTint: 'rgba(30,12,4,0.2)', roof: 'rock_dark', roofTint: 'rgba(80,30,20,0.35)', trim: '#2a1a0e', door: '#3b2412', window: '#ffd66b', gable: false },
  shop: { wall: 'brick', wallTint: 'rgba(0,0,0,0.05)', roof: 'rock_dark', roofTint: 'rgba(20,30,50,0.3)', trim: '#e8dcc0', door: '#2f4d5c', window: '#bfe9ff', gable: false },
  bunker: { wall: 'metal_plate', wallTint: 'rgba(0,10,20,0.25)', roof: 'metal_teal', roofTint: 'rgba(0,0,0,0.35)', trim: '#11181c', door: '#56606a', window: '#7af0ff', gable: false },
  workshop: { wall: 'brick', wallTint: 'rgba(30,10,5,0.3)', roof: 'metal_plate', roofTint: 'rgba(60,40,10,0.35)', trim: '#2a1a14', door: '#4a3a24', window: '#ffcf5a', gable: false },
  euclid: { wall: 'euclid_lavender', wallTint: 'rgba(0,0,0,0)', roof: 'euclid_gold', roofTint: 'rgba(0,0,0,0.1)', trim: '#3b3360', door: '#5a3b2a', window: '#fff1a8', gable: true },
  temporal: { wall: 'metal_teal', wallTint: 'rgba(0,0,0,0.15)', roof: 'euclid_gold', roofTint: 'rgba(0,0,0,0.35)', trim: '#0f2526', door: '#1d3c3e', window: '#7af0ff', gable: false },
  stone: { wall: 'stone_beige', wallTint: 'rgba(0,0,0,0.1)', roof: 'rock_dark', roofTint: 'rgba(0,0,0,0.1)', trim: '#3a3228', door: '#3b2412', window: '#ffd66b', gable: false },
};

// 3x5 pixel font for signs (uppercase + digits)
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '010101101101010', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '?': '110001010000010', '!': '010010010000010', '-': '000000111000000', ' ': '000000000000000', "'": '010010000000000',
};

export function drawPixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, scale: number, color: string): number {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT['?'];
    for (let i = 0; i < 15; i++) if (glyph[i] === '1') ctx.fillRect(cx + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale);
    cx += 4 * scale;
  }
  return cx - x;
}

export function textWidth(text: string, scale: number): number {
  return text.length * 4 * scale - scale;
}

export function bakeBuilding(scene: Phaser.Scene, b: BuildingDef, key: string): { key: string; w: number; h: number } {
  const st = STYLES[b.style];
  const wallH = Math.round((b.wallHeight ?? 2) * TILE);
  const roofH = Math.round((b.roofHeight ?? 2) * TILE);
  const over = 6;
  const W = b.w * TILE + over * 2;
  const H = wallH + roofH + (b.sign ? 18 : 0);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, W, H)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  const img = (n: string) => scene.textures.get(texKey(n)).getSourceImage() as CanvasImageSource;
  const tile = (n: string, x: number, y: number, w: number, h: number) => {
    const src = img(n);
    for (let yy = 0; yy < h; yy += 64) for (let xx = 0; xx < w; xx += 64) {
      const ww = Math.min(64, w - xx), hh = Math.min(64, h - yy);
      ctx.drawImage(src, 0, 0, ww / 2, hh / 2, x + xx, y + yy, ww, hh);
    }
  };
  const rect = (c: string, x: number, y: number, w: number, h: number) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const top = b.sign ? 18 : 0;
  const wallY = top + roofH;
  const wx = over, ww = b.w * TILE;

  // walls
  tile(st.wall, wx, wallY, ww, wallH);
  rect(st.wallTint, wx, wallY, ww, wallH);
  rect('rgba(0,0,0,0.35)', wx, wallY, ww, 6); // eave shadow
  rect('rgba(0,0,0,0.45)', wx, wallY + wallH - 4, ww, 4); // foundation
  rect(st.trim, wx, wallY, 4, wallH);
  rect(st.trim, wx + ww - 4, wallY, 4, wallH);

  // roof band seen from above-front, with shingle rows
  tile(st.roof, 0, top, W, roofH);
  rect(st.roofTint, 0, top, W, roofH);
  for (let y = top + 6; y < top + roofH; y += 8) {
    rect('rgba(0,0,0,0.22)', 0, y, W, 2);
    for (let x = (y / 8) % 2 ? 0 : 6; x < W; x += 12) rect('rgba(0,0,0,0.18)', x, y - 6, 2, 6);
  }
  rect('rgba(255,255,255,0.12)', 0, top, W, 2);
  rect('rgba(0,0,0,0.5)', 0, top + roofH - 3, W, 3);

  const doorX = b.door ? (b.door.x - b.x) * TILE + wx : -1;
  if (st.gable && b.door) {
    // front gable over the entrance
    const gw = 3 * TILE, gx = doorX + TILE / 2 - gw / 2, gy = top - 2, gh = roofH + 10;
    for (let row = 0; row < gh; row += 2) {
      const half = Math.round(((row / gh) * gw) / 2 / 2) * 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx + gw / 2 - half, gy + row, half * 2, 2);
      ctx.clip();
      tile(st.wall, gx, gy, gw, gh + 2);
      rect(st.wallTint, gx, gy, gw, gh + 2);
      ctx.restore();
      rect(st.trim, gx + gw / 2 - half - 2, gy + row, 2, 2);
      rect(st.trim, gx + gw / 2 + half, gy + row, 2, 2);
    }
    rect(st.window, gx + gw / 2 - 5, gy + gh - 22, 10, 10);
    rect(st.trim, gx + gw / 2 - 1, gy + gh - 22, 2, 10);
  }

  for (const wxTile of b.windows ?? []) {
    const x = (wxTile - b.x) * TILE + wx + 6, y = wallY + 14;
    rect(st.trim, x - 2, y - 2, 24, 22);
    rect(st.window, x, y, 20, 18);
    rect('rgba(255,255,255,0.35)', x + 2, y + 2, 4, 6);
    rect(st.trim, x + 9, y, 2, 18);
    rect(st.trim, x, y + 8, 20, 2);
  }

  if (b.door) {
    const dw = 24, dh = Math.min(wallH - 6, 46);
    const x = doorX + (TILE - dw) / 2, y = wallY + wallH - dh;
    rect(st.trim, x - 3, y - 3, dw + 6, dh + 3);
    rect(st.door, x, y, dw, dh);
    rect('rgba(255,255,255,0.08)', x + 2, y + 2, dw / 2 - 3, dh - 4);
    rect('rgba(0,0,0,0.25)', x + dw / 2 + 1, y + 2, dw / 2 - 3, dh - 4);
    rect('#d9b45a', x + dw - 6, y + dh / 2, 3, 3);
    if (b.door.locked) rect('rgba(200,40,40,0.8)', x + dw / 2 - 3, y + 6, 6, 6);
  }

  if (b.sign) {
    const scale = 2;
    const tw = textWidth(b.sign, scale);
    const sx = Math.round(W / 2 - tw / 2) - 6;
    rect('#2a1a0e', sx - 2, 0, tw + 16, 18);
    rect('#6b4424', sx, 2, tw + 12, 14);
    drawPixelText(ctx, b.sign, sx + 6, 4, scale, '#f2e3b3');
    rect('#2a1a0e', sx + 6, 16, 4, top + 4);
    rect('#2a1a0e', sx + tw + 2, 16, 4, top + 4);
  }

  tex.refresh();
  return { key, w: W, h: H };
}

function h32(x: number, y: number): number {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * The Mystery Shack, painted pixel by pixel: log walls with end caps, a steep
 * central gable with an attic window, a covered porch on posts, a mossy
 * shingle roof, a stone chimney and the roof sign whose S has fallen off.
 */
export function bakeShack(scene: Phaser.Scene, b: BuildingDef, key: string): { key: string; w: number; h: number } {
  const over = 6;
  const W = b.w * TILE + over * 2;
  const wallH = Math.round((b.wallHeight ?? 4) * TILE);
  const roofH = Math.round((b.roofHeight ?? 3) * TILE);
  const gableH = roofH + 104;
  const signH = 8;
  const H = wallH + gableH + signH;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, W, H)!;
  const c = tex.getContext();
  c.imageSmoothingEnabled = false;
  const r = (col: string, x: number, y: number, w: number, h: number) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const base = H;
  const wallTop = base - wallH;
  const roofTop = wallTop - roofH;
  const doorX = b.door ? (b.door.x - b.x) * TILE + over + TILE / 2 : W / 2;
  const L = { a: '#6b4428', b: '#5c3a22', hi: '#8a5a34', gap: '#24140a', knot: '#3a2414' };

  const logs = (x0: number, y0: number, w: number, h: number, clip?: (x: number, y: number) => boolean) => {
    for (let y = y0; y < y0 + h; y += 8) {
      const col = ((y - y0) / 8) % 2 ? L.a : L.b;
      for (let x = x0; x < x0 + w; x += 2) {
        if (clip && !clip(x, y)) continue;
        r(col, x, y, 2, 8);
        r(L.hi, x, y, 2, 1);
        r(L.gap, x, y + 7, 2, 1);
        if (h32(x, y) < 0.02) r(L.knot, x, y + 3, 2, 2);
      }
    }
  };

  // --- main roof (behind the gable): mossy shingles, hipped at the ends
  for (let y = roofTop; y < wallTop + 6; y += 6) {
    const t = (y - roofTop) / (wallTop - roofTop);
    const inset = Math.round((1 - t) * 34);
    const x0 = inset, x1 = W - inset;
    const row = (y - roofTop) / 6;
    for (let x = x0; x < x1; x += 2) {
      const tone = h32(x >> 3, row) < 0.5 ? '#3f352a' : '#4a3e2f';
      r(tone, x, y, 2, 6);
      if (((x + row * 5) % 12) === 0) r('#231a12', x, y, 1, 6);
      // moss creeps over the shingles
      if (h32(x >> 2, row * 3) < 0.10 + t * 0.12) r(h32(x, y) < 0.5 ? '#56622c' : '#47512a', x, y + 1, 2, 3);
    }
    r('#1c140c', x0, y + 5, x1 - x0, 1);
  }
  r('#2a1d12', 0, wallTop - 2, W, 6); // eave

  // --- stone chimney on the right
  const chX = W - 120, chW = 26;
  for (let y = roofTop - 40; y < wallTop - 10; y += 6) {
    for (let x = chX; x < chX + chW; x += 8) {
      const off = ((y / 6) % 2) * 4;
      r(h32(x, y) < 0.5 ? '#6b6560' : '#58534e', x + off - 4, y, 8, 6);
      r('#2e2b29', x + off - 4, y + 5, 8, 1);
    }
  }
  r('#2a2522', chX - 3, roofTop - 46, chW + 6, 8);

  // --- walls: horizontal logs with round end caps
  logs(over, wallTop, W - over * 2, wallH);
  for (let y = wallTop; y < base - 6; y += 8) {
    for (const x of [over - 4, W - over - 4]) {
      r('#4a2e18', x, y + 1, 8, 6);
      r('#8a5a34', x + 2, y + 2, 4, 4);
      r('#5c3a22', x + 3, y + 3, 2, 2);
    }
  }
  r('rgba(0,0,0,0.35)', over, wallTop + 4, W - over * 2, 10); // shade under the eave

  // --- central gable with attic window
  const gw = Math.min(300, Math.round(W * 0.56)), gx0 = doorX - gw / 2, gTop = wallTop - gableH;
  const inGable = (x: number, y: number) => {
    const t = (y - gTop) / (wallTop + 6 - gTop);
    return Math.abs(x - doorX) <= t * (gw / 2);
  };
  logs(gx0, gTop, gw, wallTop + 6 - gTop, inGable);
  // bargeboards (roof edges) overhanging the gable
  for (let y = gTop - 6; y < wallTop + 10; y += 2) {
    const t = (y - (gTop - 6)) / (wallTop + 10 - (gTop - 6));
    const half = t * (gw / 2 + 16);
    for (const s of [-1, 1]) {
      const x = doorX + s * half;
      r('#3b2a1a', x - (s > 0 ? 0 : 8), y, 10, 3);
      r('#4f3a24', x - (s > 0 ? 0 : 8), y, 10, 1);
      r(h32(x, y) < 0.3 ? '#56622c' : '#2a1d12', x - (s > 0 ? 0 : 8), y + 2, 10, 1);
    }
  }
  r('#2a1d12', doorX - 3, gTop - 10, 6, 10); // ridge finial
  // attic window: octagon, warm light, cross bars
  const aw = 34, ay = gTop + (wallTop - gTop) * 0.42;
  r('#1e140c', doorX - aw / 2 - 3, ay - 3, aw + 6, aw + 6);
  r('#ffcf6a', doorX - aw / 2, ay, aw, aw);
  r('#ffe9a8', doorX - aw / 2 + 3, ay + 3, aw / 2 - 4, aw / 2 - 4);
  r('#1e140c', doorX - 1, ay, 2, aw);
  r('#1e140c', doorX - aw / 2, ay + aw / 2 - 1, aw, 2);
  for (const [dx, dy] of [[0, 0], [aw - 4, 0], [0, aw - 4], [aw - 4, aw - 4]]) r('#1e140c', doorX - aw / 2 + dx, ay + dy, 4, 4);

  // --- windows on the front wall
  // two floors of windows; the upper ones only where the gable does not cover the wall
  const winRows = [wallTop + wallH * 0.52, wallTop + 16];
  for (const [ri, wy] of winRows.entries()) for (const wt of b.windows ?? []) {
    const x = (wt - b.x) * TILE + over + 4, y = wy, ww = 24, wh = ri ? 24 : 28;
    if (ri && Math.abs(x + ww / 2 - doorX) < gw / 2 + 6) continue;
    r('#1e140c', x - 3, y - 3, ww + 6, wh + 7);
    r('#ffcf6a', x, y, ww, wh);
    r('#ffe9a8', x + 2, y + 2, 8, 10);
    r('#c98a3a', x, y + wh - 6, ww, 6); // lamp-lit sill glow
    r('#1e140c', x + ww / 2 - 1, y, 2, wh);
    r('#1e140c', x, y + wh / 2 - 1, ww, 2);
    r('#7a2a20', x, y, 5, wh); // half-drawn curtain
    r('#3a2414', x - 4, y + wh + 3, ww + 8, 3);
  }

  // --- covered porch: slanted roof on posts, plank floor
  const pTop = base - 74, px0 = 18, px1 = W - 18;
  for (let y = pTop; y < pTop + 14; y += 2) {
    r(((y - pTop) / 2) % 2 ? '#4a3e2f' : '#3f352a', px0 - (y - pTop) / 2, y, px1 - px0 + (y - pTop), 2);
  }
  r('#1c140c', px0 - 7, pTop + 14, px1 - px0 + 14, 2);
  for (let x = px0 + 6; x < px1; x += 70) {
    if (Math.abs(x - doorX) < 34) continue;
    r('#3a2414', x, pTop + 16, 6, base - pTop - 22);
    r('#5c3a22', x + 1, pTop + 16, 2, base - pTop - 22);
  }
  r('rgba(0,0,0,0.28)', px0, pTop + 16, px1 - px0, 10);
  for (let x = px0 - 6; x < px1 + 6; x += 4) {
    r(((x - px0) / 4) % 2 ? '#7a5636' : '#6a4a2e', x, base - 8, 4, 8);
    r('#2a1a0e', x + 3, base - 8, 1, 8);
  }
  r('#2a1a0e', px0 - 6, base - 9, px1 - px0 + 12, 1);

  // --- front door with the "?" plaque
  if (b.door) {
    const dw = 28, dh = 50, x = doorX - dw / 2, y = base - 8 - dh;
    r('#1e140c', x - 4, y - 4, dw + 8, dh + 4);
    r('#3a2414', x, y, dw, dh);
    for (let i = 4; i < dw; i += 7) r('#2a180c', x + i, y + 2, 1, dh - 4);
    r('#d9b45a', x + dw - 7, y + dh / 2, 3, 3);
    r('#2a1a0e', doorX - 9, y - 18, 18, 12);
    drawPixelText(c, '?', doorX - 3, y - 16, 2, '#ffd27a');
  }

  // --- the roof sign, with its S fallen onto the shingles
  const sc = 2;
  const word1 = 'MYSTERY', word2 = 'HACK';
  const sw = textWidth(`${word1}  ${word2}`, sc) + 16;
  const sx = Math.round(doorX - gw / 2 - sw + 30), sy = roofTop - 26;
  r('#2a1a0e', sx + 10, sy + 24, 4, 16);
  r('#2a1a0e', sx + sw - 14, sy + 24, 4, 16);
  r('#2a1a0e', sx - 2, sy - 2, sw + 4, 28);
  r('#5a3a20', sx, sy, sw, 24);
  r('#6b4428', sx, sy, sw, 2);
  drawPixelText(c, word1, sx + 8, sy + 7, sc, '#f2e3b3');
  const gapX = sx + 8 + textWidth(`${word1} `, sc) + 2;
  drawPixelText(c, word2, gapX + 4 * sc + 2, sy + 7, sc, '#f2e3b3');
  // the S, lying on its side on the roof
  const sG = '011100010001110';
  const fx = gapX - 2, fy = roofTop + 26;
  r('#2a1a0e', fx - 2, fy - 2, 14, 10);
  r('#5a3a20', fx - 1, fy - 1, 12, 8);
  for (let i = 0; i < 15; i++) if (sG[i] === '1') r('#f2e3b3', fx + Math.floor(i / 3) * 2, fy + (2 - (i % 3)) * 2, 2, 2);

  tex.refresh();
  return { key, w: W, h: H };
}
