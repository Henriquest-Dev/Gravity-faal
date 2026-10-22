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
