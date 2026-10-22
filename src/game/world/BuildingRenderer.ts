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
 * The Mystery Shack as the show draws it: a tall, steep A-frame whose roof
 * almost reaches the ground, a lower gift-shop wing to the east, a lean-to to
 * the west, the big yellow MYSTERY SHACK sign on the roof with its S fallen
 * over, and the question-mark weathervane.
 */
export function bakeShack(scene: Phaser.Scene, b: BuildingDef, key: string): { key: string; w: number; h: number } {
  const over = 6;
  const W = b.w * TILE + over * 2;
  const doorX = b.door ? (b.door.x - b.x) * TILE + over + TILE / 2 : W / 2;
  const aHalf = 128;                       // half width of the A-frame at its eaves
  const aPeak = Math.round((b.roofHeight ?? 3) * TILE + (b.wallHeight ?? 4) * TILE) + 20;
  const H = aPeak + 40;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, W, H)!;
  const c = tex.getContext();
  c.imageSmoothingEnabled = false;
  const r = (col: string, x: number, y: number, w: number, h: number) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const base = H;
  const peakY = base - aPeak;
  const P = { boardA: '#5a3820', boardB: '#4e301b', boardHi: '#73492a', gap: '#22130a', roofA: '#3b2f25', roofB: '#45372a', roofLine: '#1e160f', moss: '#4f5a28', mossB: '#5f6a2e' };

  /** vertical board siding inside a clip region */
  const boards = (x0: number, y0: number, w: number, h: number, clip?: (x: number, y: number) => boolean) => {
    for (let x = x0; x < x0 + w; x += 2) {
      const plank = Math.floor((x - x0) / 10);
      const col = plank % 2 ? P.boardA : P.boardB;
      for (let y = y0; y < y0 + h; y += 2) {
        if (clip && !clip(x, y)) continue;
        r(col, x, y, 2, 2);
        if ((x - x0) % 10 === 0) r(P.gap, x, y, 1, 2);
        else if ((x - x0) % 10 === 2) r(P.boardHi, x, y, 1, 2);
        if (h32(x >> 1, y >> 3) < 0.012) r('#2e1b0e', x, y, 2, 2);
      }
    }
  };
  /** shingle rows between two x bounds per row */
  const shingles = (y0: number, y1: number, span: (y: number) => [number, number] | null) => {
    for (let y = y0; y < y1; y += 6) {
      const sp = span(y);
      if (!sp) continue;
      const row = (y - y0) / 6;
      for (let x = Math.round(sp[0]); x < sp[1]; x += 2) {
        r(h32(x >> 3, row) < 0.5 ? P.roofA : P.roofB, x, y, 2, 6);
        if (((x + row * 5) % 12) === 0) r(P.roofLine, x, y, 1, 6);
        if (h32(x >> 2, row * 3) < 0.13) r(h32(x, y) < 0.5 ? P.moss : P.mossB, x, y + 1, 2, 3);
      }
      r(P.roofLine, sp[0], y + 5, sp[1] - sp[0], 1);
    }
  };

  // ---------------------------------------------------- east wing (gift shop)
  const eX0 = doorX + aHalf - 20, eX1 = W - over, eWall = 92, eRoof = 54;
  const eTop = base - eWall;
  shingles(eTop - eRoof, eTop + 6, (y) => {
    const t = (y - (eTop - eRoof)) / eRoof;
    return [eX0, eX1 - (1 - Math.min(1, t)) * 30];
  });
  boards(eX0, eTop, eX1 - eX0, eWall);
  r('rgba(0,0,0,0.38)', eX0, eTop, eX1 - eX0, 8);
  // shop window and the "GIFT SHOP" board
  const swx = eX0 + 44, swy = eTop + 22;
  r('#1e140c', swx - 3, swy - 3, 46, 34);
  r('#ffc861', swx, swy, 40, 28);
  r('#ffe6a0', swx + 3, swy + 3, 12, 10);
  r('#1e140c', swx + 19, swy, 2, 28);
  r('#7a2a20', swx, swy, 6, 28);
  // ---------------------------------------------------- west lean-to
  const wX1 = doorX - aHalf + 20, wX0 = over + 8, wWall = 64;
  const wTop = base - wWall;
  shingles(wTop - 30, wTop + 6, (y) => [wX0 + (1 - (y - (wTop - 30)) / 30) * 20, wX1]);
  boards(wX0, wTop, wX1 - wX0, wWall);
  r('rgba(0,0,0,0.38)', wX0, wTop, wX1 - wX0, 6);
  r('#1e140c', wX0 + 22, wTop + 18, 26, 24);
  r('#e9b45a', wX0 + 25, wTop + 21, 20, 18);
  r('#1e140c', wX0 + 34, wTop + 21, 2, 18);

  // ---------------------------------------------------- the A-frame
  const aSide = (y: number) => ((y - peakY) / (base - 18 - peakY)) * aHalf; // half width at y
  // roof slopes: thick shingled bands along both sides
  shingles(peakY, base - 12, (y) => [doorX - aSide(y) - 22, doorX + aSide(y) + 22]);
  // front face, inset from the roof edges
  const face = (x: number, y: number) => y > peakY + 30 && Math.abs(x - doorX) <= aSide(y) - 18;
  boards(doorX - aHalf, peakY, aHalf * 2, base - peakY, face);
  // bargeboards
  for (let y = peakY; y < base - 10; y += 2) {
    const hw = aSide(y) + 22;
    for (const s of [-1, 1]) {
      const x = doorX + s * hw;
      r('#2a1d12', x - (s > 0 ? 6 : 2), y, 8, 3);
      r('#4a3420', x - (s > 0 ? 6 : 2), y, 8, 1);
    }
  }
  r('#2a1d12', doorX - 4, peakY - 10, 8, 14); // ridge cap
  // attic window: tall, warm, with its cross
  const awx = doorX - 15, awy = peakY + 88;
  r('#1a110a', awx - 4, awy - 4, 38, 46);
  r('#ffc861', awx, awy, 30, 38);
  r('#ffe6a0', awx + 3, awy + 3, 10, 12);
  r('#1a110a', awx + 14, awy, 2, 38);
  r('#1a110a', awx, awy + 18, 30, 2);
  r('#3a2414', awx - 6, awy + 42, 42, 4);
  // second floor windows on the face
  for (const s of [-1, 1]) {
    const x = doorX + s * 52 - 13, y = base - 150;
    r('#1a110a', x - 3, y - 3, 32, 34);
    r('#ffc861', x, y, 26, 28);
    r('#ffe6a0', x + 2, y + 2, 9, 9);
    r('#1a110a', x + 12, y, 2, 28);
    r('#1a110a', x, y + 13, 26, 2);
    r('#7a2a20', s < 0 ? x : x + 21, y, 5, 28);
  }
  // porch roof across the A-frame front, on two posts
  const pTop = base - 78, pw = aHalf * 2 - 40;
  for (let y = pTop; y < pTop + 14; y += 2) r(((y - pTop) / 2) % 2 ? P.roofB : P.roofA, doorX - pw / 2 - (y - pTop) / 2, y, pw + (y - pTop), 2);
  r(P.roofLine, doorX - pw / 2 - 7, pTop + 14, pw + 14, 2);
  r('rgba(0,0,0,0.3)', doorX - pw / 2, pTop + 16, pw, 10);
  for (const s of [-1, 1]) {
    const x = doorX + s * (pw / 2 - 8) - 3;
    r('#3a2414', x, pTop + 16, 6, base - pTop - 24);
    r('#5c3a22', x + 1, pTop + 16, 2, base - pTop - 24);
  }
  for (let x = doorX - pw / 2 - 4; x < doorX + pw / 2 + 4; x += 4) {
    r(((x - doorX) / 4) % 2 ? '#7a5636' : '#6a4a2e', x, base - 8, 4, 8);
    r('#2a1a0e', x + 3, base - 8, 1, 8);
  }
  // ground-floor windows beside the door
  for (const s of [-1, 1]) {
    const x = doorX + s * 58 - 14, y = base - 56;
    r('#1a110a', x - 3, y - 3, 34, 32);
    r('#ffc861', x, y, 28, 26);
    r('#ffe6a0', x + 2, y + 2, 10, 9);
    r('#c98a3a', x, y + 20, 28, 6);
    r('#1a110a', x + 13, y, 2, 26);
  }
  // door with the "?" plaque
  if (b.door) {
    const dw = 28, dh = 50, x = doorX - dw / 2, y = base - 8 - dh;
    r('#1a110a', x - 4, y - 4, dw + 8, dh + 4);
    r('#3a2414', x, y, dw, dh);
    for (let i = 4; i < dw; i += 7) r('#2a180c', x + i, y + 2, 1, dh - 4);
    r('#d9b45a', x + dw - 7, y + dh / 2, 3, 3);
  }

  // ---------------------------------------------------- the sign
  const sc = 3;
  const l1 = 'MYSTERY', l2 = 'HACK';
  const sw = textWidth(l1, sc) + 28, sh = 2 * 5 * sc + 30;
  const sx = Math.round(Math.min(W - sw - 10, doorX + 52)), sy = Math.round(peakY + 40);
  // posts down onto the east roof
  for (const px of [sx + 24, sx + sw - 30]) {
    r('#2a1a0e', px, sy + sh - 2, 6, eTop - eRoof + 12 - (sy + sh) + 2 > 0 ? eTop - eRoof + 12 - (sy + sh) : 24);
  }
  r('#2a1a0e', sx - 3, sy - 3, sw + 6, sh + 6);
  r('#8f6a1c', sx, sy, sw, sh);
  r('#e6c149', sx + 3, sy + 3, sw - 6, sh - 6);
  r('#f5d870', sx + 3, sy + 3, sw - 6, 3);
  for (let i = 0; i < 7; i++) r('rgba(120,80,20,0.25)', sx + 8 + h32(i, 3) * (sw - 20), sy + 6 + h32(i, 9) * (sh - 12), 6, 2);
  drawPixelText(c, l1, sx + 14, sy + 10, sc, '#4a2610');
  // second line: an empty gap where the S used to be, then HACK
  const l2x = sx + 14 + 4 * sc;
  drawPixelText(c, l2, l2x, sy + 10 + 6 * sc, sc, '#4a2610');
  // the fallen S, lying crooked on the east roof below the sign
  const fx = sx + sw - 10, fy = eTop - eRoof + 18;
  r('#2a1a0e', fx - 3, fy - 3, 30, 22);
  r('#e6c149', fx, fy, 24, 16);
  const sG = '011100010001110';
  for (let i = 0; i < 15; i++) if (sG[i] === '1') r('#4a2610', fx + 3 + Math.floor(i / 3) * 4, fy + 2 + (2 - (i % 3)) * 4, 4, 4);
  // question-mark weathervane on the east wing
  const vx = W - over - 40, vy = eTop - eRoof - 54;
  r('#1a110a', vx, vy + 20, 3, 40);
  drawPixelText(c, '?', vx - 5, vy, 3, '#1a110a');

  tex.refresh();
  return { key, w: W, h: H };
}

/**
 * A house of Euclydia as the catalogue's reference paints them: a steep
 * triangle of lavender roof planes, a cream gable framed in gold, a pointed
 * door, a triangular window and a diamond sigil; banners on poles at the side.
 * `windows` lists banner columns (tile x); `sign` set to "tall" makes it taller.
 */
export function bakeEuclid(scene: Phaser.Scene, b: BuildingDef, key: string): { key: string; w: number; h: number } {
  const over = 6;
  const W = b.w * TILE + over * 2;
  const tall = b.sign === 'tall';
  const roofH = Math.round((b.roofHeight ?? (tall ? 5.2 : 4.2)) * TILE);
  const plinth = 10;
  const H = roofH + plinth + 30;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, W, H)!;
  const c = tex.getContext();
  c.imageSmoothingEnabled = false;
  const r = (col: string, x: number, y: number, w: number, h: number) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const base = H;
  const cx = b.door ? (b.door.x - b.x) * TILE + over + TILE / 2 : W / 2;
  const half = Math.min(cx - 2, W - cx - 2);
  const top = base - plinth - roofH;
  const C = { roofA: '#9a8cc6', roofB: '#8a7cb8', roofDark: '#6c5f9a', line: '#3b3360', gable: '#efdcae', gableShade: '#d9c393', gold: '#d6a63a', goldHi: '#f2cf6a', door: '#3e2a24', glow: '#ffe08a', stone: '#c8b896', stoneDark: '#a39274' };
  const halfAt = (y: number) => ((y - top) / (base - plinth - top)) * half;

  // banners on poles behind the house edges
  for (const bt of b.windows ?? []) {
    const px = (bt - b.x) * TILE + over + TILE / 2;
    r('#2c2540', px - 1, top + 20, 3, base - top - 20);
    r(C.gold, px - 2, top + 16, 5, 5);
    r('#5b3f8c', px + 2, top + 26, 16, 34);
    for (let i = 0; i < 6; i++) r('#5b3f8c', px + 2 + i, top + 60, 16 - i * 2 > 0 ? 8 - i : 0, i);
    r(C.goldHi, px + 8, top + 36, 4, 4);
    r(C.gold, px + 7, top + 37, 6, 2);
    r('#4a3275', px + 2, top + 26, 2, 34);
  }
  // stone plinth
  r(C.stoneDark, cx - half - 4, base - plinth, half * 2 + 8, plinth);
  r(C.stone, cx - half - 4, base - plinth, half * 2 + 8, 3);
  for (let x = cx - half; x < cx + half; x += 14) r(C.stoneDark, x, base - plinth + 3, 1, plinth - 3);
  // roof planes: shingle courses following the slope
  for (let y = top; y < base - plinth; y++) {
    const hw = halfAt(y);
    const row = Math.floor((y - top) / 5);
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? cx - hw - 3 : cx, x1 = s < 0 ? cx : cx + hw + 3;
      r(s < 0 ? C.roofA : C.roofB, x0, y, x1 - x0, 1);
      if ((y - top) % 5 === 4) r(C.roofDark, x0, y, x1 - x0, 1);
      for (let x = Math.floor(x0) + ((row * 7) % 12); x < x1; x += 12) if ((y - top) % 5 !== 4) r(C.roofDark, x, y, 1, 1);
    }
    r(C.line, cx - hw - 4, y, 2, 1);
    r(C.line, cx + hw + 2, y, 2, 1);
  }
  // cream gable inset with gold frame
  const inset = 16;
  const gTop = top + 34;
  for (let y = gTop; y < base - plinth; y++) {
    const hw = halfAt(y) - inset;
    if (hw <= 0) continue;
    r(C.gold, cx - hw - 3, y, hw * 2 + 6, 1);
    r(C.gable, cx - hw, y, hw * 2, 1);
    if (h32(Math.floor(y / 6), 3) < 0.5) r(C.gableShade, cx - hw, y, 3, 1);
  }
  // timber lines on the gable
  for (let y = gTop + 30; y < base - plinth; y += 22) {
    const hw = halfAt(y) - inset;
    if (hw > 6) r(C.gableShade, cx - hw, y, hw * 2, 2);
  }
  // diamond sigil near the apex
  const dy = gTop + 22;
  for (let i = 0; i < 7; i++) r(i % 2 ? C.goldHi : C.gold, cx - i, dy - 7 + i, i * 2 + 1, 1);
  for (let i = 0; i < 7; i++) r(C.gold, cx - (6 - i), dy + i, (6 - i) * 2 + 1, 1);
  r(C.line, cx - 1, dy - 1, 3, 3);
  // triangular window above the door, lit from inside
  const wy = base - plinth - 74;
  for (let i = 0; i < 16; i++) {
    r(C.line, cx - i - 2, wy + i, i * 2 + 4, 1);
    if (i > 1) r(i < 6 ? '#fff4c4' : C.glow, cx - i + 1, wy + i, i * 2 - 2, 1);
  }
  r(C.line, cx - 18, wy + 16, 36, 2);
  // pointed door
  if (b.door) {
    const dw = 22, dh = 36, x = cx - dw / 2, y = base - plinth - dh;
    for (let i = 0; i < dh; i++) {
      const hw = i < 10 ? (i / 10) * (dw / 2) : dw / 2;
      r(C.gold, cx - hw - 2, y + i, hw * 2 + 4, 1);
      r(C.door, cx - hw, y + i, hw * 2, 1);
    }
    r('#2c1d18', cx - 1, y + 6, 2, dh - 6);
    r(C.goldHi, x + dw - 6, y + dh / 2 + 2, 2, 2);
    r(C.stone, x - 6, base - plinth, dw + 12, 3);
  }
  // small side windows low on the gable
  for (const s of [-1, 1]) {
    const x = cx + s * 30 - 5, y = base - plinth - 30;
    if (halfAt(y) - inset < 40) continue;
    r(C.line, x - 2, y - 2, 14, 16);
    r(C.glow, x, y, 10, 12);
    r(C.line, x + 4, y, 2, 12);
  }
  tex.refresh();
  return { key, w: W, h: H };
}
