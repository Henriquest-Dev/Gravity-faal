import Phaser from 'phaser';
import type { Grid, TileDef } from '../../core/grid';
import { TILE } from '../../core/grid';
import { texKey } from '../assets';

/**
 * Bakes the ground of a map into one canvas texture, composed tile by tile from
 * the 32x32 catalogue textures (drawn at 2x so their pixels match the sprites).
 * The catalogue has no autotile set, so transitions are generated here: jagged
 * material edges, water banks with foam, wall and cliff faces, pit drops.
 */

export interface Theme {
  wall: string; wallTop: string; wallTint: string;
  cliff: string; cliffTop: string;
  blocker: string; deepTint: string; voidGlow?: string;
}

export const THEMES: Record<string, Theme> = {
  forest: { wall: 'wood_floor', wallTop: '#2b2018', wallTint: 'rgba(30,15,5,0.35)', cliff: 'rock_dark', cliffTop: 'grass_dark', blocker: 'grass_dark', deepTint: 'rgba(5,40,60,0.45)' },
  town: { wall: 'brick', wallTop: '#3a2420', wallTint: 'rgba(30,10,5,0.25)', cliff: 'rock_dark', cliffTop: 'grass_dark', blocker: 'grass_dark', deepTint: 'rgba(5,40,60,0.45)' },
  interior: { wall: 'wood_floor', wallTop: '#24170f', wallTint: 'rgba(40,20,8,0.45)', cliff: 'rock_dark', cliffTop: 'dirt_dark', blocker: 'rock_dark', deepTint: 'rgba(5,40,60,0.45)' },
  cave: { wall: 'rock_dark', wallTop: '#120f0d', wallTint: 'rgba(0,0,0,0.25)', cliff: 'rock_dark', cliffTop: 'dirt_dark', blocker: 'rock_dark', deepTint: 'rgba(0,30,50,0.55)' },
  bunker: { wall: 'metal_plate', wallTop: '#161b1f', wallTint: 'rgba(0,10,20,0.35)', cliff: 'rock_dark', cliffTop: 'dirt_dark', blocker: 'rock_dark', deepTint: 'rgba(0,30,50,0.5)' },
  workshop: { wall: 'brick', wallTop: '#2a1a14', wallTint: 'rgba(30,10,5,0.35)', cliff: 'rock_dark', cliffTop: 'dirt_dark', blocker: 'dirt_dark', deepTint: 'rgba(30,40,20,0.5)' },
  euclid: { wall: 'euclid_lavender', wallTop: '#3b3360', wallTint: 'rgba(20,10,40,0.2)', cliff: 'stone_beige', cliffTop: 'grass', blocker: 'grass', deepTint: 'rgba(0,50,70,0.4)' },
  rupture: { wall: 'stone_cracked', wallTop: '#231c26', wallTint: 'rgba(20,0,30,0.3)', cliff: 'stone_cracked', cliffTop: 'void', blocker: 'void', deepTint: 'rgba(0,40,60,0.5)', voidGlow: 'rgba(140,80,255,0.35)' },
  nightmare: { wall: 'nightmare_cracked', wallTop: '#1a1030', wallTint: 'rgba(10,0,30,0.3)', cliff: 'nightmare_cracked', cliffTop: 'void', blocker: 'void', deepTint: 'rgba(30,0,60,0.5)', voidGlow: 'rgba(170,90,255,0.45)' },
  temporal: { wall: 'metal_teal', wallTop: '#0f2526', wallTint: 'rgba(0,20,20,0.3)', cliff: 'metal_teal', cliffTop: 'void', blocker: 'void', deepTint: 'rgba(0,40,60,0.5)', voidGlow: 'rgba(90,230,255,0.35)' },
};

function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class TerrainRenderer {
  private ctx!: CanvasRenderingContext2D;
  private imgs = new Map<string, CanvasImageSource>();
  private theme: Theme;

  constructor(private scene: Phaser.Scene, private grid: Grid, themeName: string) {
    this.theme = THEMES[themeName] ?? THEMES.forest;
  }

  private img(name: string): CanvasImageSource {
    let i = this.imgs.get(name);
    if (!i) {
      const key = texKey(name);
      if (!this.scene.textures.exists(key)) throw new Error(`Textura em falta: ${name}`);
      i = this.scene.textures.get(key).getSourceImage() as CanvasImageSource;
      this.imgs.set(name, i);
    }
    return i;
  }

  /** Draw a region of a material at 2x scale, aligned to world coordinates so tiles join seamlessly. */
  private mat(name: string, dx: number, dy: number, w: number, h: number): void {
    const src = this.img(name);
    // world pixel -> texture pixel (2 world px per texture px, 64 px period)
    const sx = ((dx % 64) + 64) % 64 / 2, sy = ((dy % 64) + 64) % 64 / 2;
    const sw = Math.min(w / 2, 32 - sx), sh = Math.min(h / 2, 32 - sy);
    this.ctx.drawImage(src, sx, sy, sw, sh, dx, dy, sw * 2, sh * 2);
    if (sw * 2 < w) this.mat(name, dx + sw * 2, dy, w - sw * 2, h);
    if (sh * 2 < h) this.mat(name, dx, dy + sh * 2, Math.min(w, sw * 2), h - sh * 2);
  }

  private fill(color: string, x: number, y: number, w: number, h: number): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  bake(key: string): string {
    const g = this.grid;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const tex = this.scene.textures.createCanvas(key, g.pxW, g.pxH)!;
    this.ctx = tex.getContext();
    this.ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) this.base(x, y);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) this.edges(x, y);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) this.structures(x, y);
    tex.refresh();
    return key;
  }

  private isGround(t: TileDef): boolean {
    return !t.solid && !t.water && !t.pit && !t.climb && !t.bridge;
  }

  private faceDepth(x: number, y: number, pred: (t: TileDef) => boolean): number {
    // how many tiles until the column leaves the structure going south
    let d = 0;
    while (d < 4 && pred(this.grid.tile(x, y + d + 1))) d++;
    return d;
  }

  private base(x: number, y: number): void {
    const t = this.grid.tile(x, y);
    const px = x * TILE, py = y * TILE;
    if (t.water || t.bridge) {
      this.mat('water', px, py, TILE, TILE);
      if (t.water === 'deep' || t.bridge) this.fill(this.theme.deepTint, px, py, TILE, TILE);
      else this.fill('rgba(255,255,255,0.10)', px, py, TILE, TILE);
      return;
    }
    if (t.pit) {
      this.mat('void', px, py, TILE, TILE);
      return;
    }
    if (t.blocker) {
      this.mat(this.theme.blocker, px, py, TILE, TILE);
      this.fill('rgba(0,0,0,0.25)', px, py, TILE, TILE);
      return;
    }
    if (t.wall || t.cliff) return; // drawn in structures pass
    this.mat(t.texture, px, py, TILE, TILE);
    // subtle per-tile value variation breaks visible repetition
    const v = hash(x, y, 3);
    if (v < 0.25) this.fill('rgba(0,0,0,0.06)', px, py, TILE, TILE);
    else if (v > 0.85) this.fill('rgba(255,255,220,0.05)', px, py, TILE, TILE);
    if (t.rubble) this.rubble(px, py, x, y);
  }

  private edges(x: number, y: number): void {
    const g = this.grid;
    const t = g.tile(x, y);
    const px = x * TILE, py = y * TILE;
    const sides: [number, number, 'n' | 's' | 'w' | 'e'][] = [[0, -1, 'n'], [0, 1, 's'], [-1, 0, 'w'], [1, 0, 'e']];
    if (this.isGround(t) || t.blocker) {
      for (const [dx, dy, side] of sides) {
        const n = g.tile(x + dx, y + dy);
        if (!this.isGround(n) || n.texture === t.texture || n.priority <= t.priority) continue;
        this.jagged(n.texture, px, py, side, x, y, 4, 10);
      }
      return;
    }
    if (t.water || t.bridge) {
      for (const [dx, dy, side] of sides) {
        const n = g.tile(x + dx, y + dy);
        if (n.water || n.bridge) {
          // deep/shallow boundary: dithered lighter band on the deep side
          if ((t.water === 'deep' || t.bridge) && n.water === 'shallow') this.dither(px, py, side, 'rgba(160,240,240,0.18)');
          continue;
        }
        if (n.solid && !n.blocker) {
          this.band(px, py, side, 4, 'rgba(0,0,0,0.35)');
          continue;
        }
        const land = n.blocker ? this.theme.blocker : n.pit ? 'void' : n.texture;
        this.jagged(land, px, py, side, x, y, 4, 8);
        this.band(px, py, side, 2, 'rgba(40,25,10,0.45)', 6);
        this.foam(px, py, side, x, y);
      }
      return;
    }
    if (t.pit) {
      const n = g.tile(x, y - 1);
      if (!n.pit) {
        // ground edge drops into the void: earthy face fading into darkness
        this.mat('dirt_dark', px, py, TILE, 10);
        this.fill('rgba(0,0,0,0.35)', px, py + 6, TILE, 4);
        this.fill('rgba(0,0,0,0.25)', px, py + 10, TILE, 8);
      }
      for (const [dx, dy, side] of sides) {
        if (side === 'n') continue;
        const m = g.tile(x + dx, y + dy);
        if (!m.pit) this.band(px, py, side, 2, 'rgba(0,0,0,0.6)');
      }
      if (this.theme.voidGlow && hash(x, y, 9) < 0.08) this.fill(this.theme.voidGlow, px + 10 + Math.floor(hash(x, y, 1) * 6) * 2, py + 14, 2, 2);
    }
  }

  private structures(x: number, y: number): void {
    const g = this.grid;
    const t = g.tile(x, y);
    const px = x * TILE, py = y * TILE;
    if (t.wall) {
      const depth = this.faceDepth(x, y, (n) => !!n.wall);
      if (depth < 2) {
        // wall face (two tiles tall), shaded towards the floor
        this.mat(this.theme.wall, px, py, TILE, TILE);
        this.fill(this.theme.wallTint, px, py, TILE, TILE);
        if (depth === 1) this.fill('rgba(255,255,255,0.06)', px, py, TILE, 3);
        if (depth === 0) {
          this.fill('rgba(0,0,0,0.25)', px, py + 20, TILE, 12);
          this.fill('rgba(0,0,0,0.5)', px, py + 28, TILE, 4);
        }
        if (!g.tile(x - 1, y).wall) this.fill('rgba(0,0,0,0.35)', px, py, 2, TILE);
        if (!g.tile(x + 1, y).wall) this.fill('rgba(0,0,0,0.35)', px + TILE - 2, py, 2, TILE);
      } else {
        this.fill(this.theme.wallTop, px, py, TILE, TILE);
        const rim = 'rgba(255,255,255,0.10)';
        if (!g.tile(x, y - 1).wall) this.fill(rim, px, py, TILE, 2);
        if (!g.tile(x - 1, y).wall) this.fill(rim, px, py, 2, TILE);
        if (!g.tile(x + 1, y).wall) this.fill(rim, px + TILE - 2, py, 2, TILE);
      }
    } else if (t.cliff) {
      const isCliff = (n: TileDef) => !!n.cliff;
      const depth = this.faceDepth(x, y, isCliff);
      if (depth < 2) {
        this.mat(this.theme.cliff, px, py, TILE, TILE);
        // horizontal strata
        for (let s = 6; s < TILE; s += 10) this.fill('rgba(0,0,0,0.22)', px, py + s + (hash(x, y, s) < 0.5 ? 0 : 2), TILE, 2);
        if (depth === 1 && !isCliff(g.tile(x, y - 1))) this.lip(px, py, x, y);
        if (depth === 1 && isCliff(g.tile(x, y - 1))) this.fill('rgba(255,255,255,0.05)', px, py, TILE, 2);
        if (depth === 0) this.fill('rgba(0,0,0,0.3)', px, py + 24, TILE, 8);
        if (!isCliff(g.tile(x - 1, y))) this.fill('rgba(0,0,0,0.3)', px, py, 3, TILE);
        if (!isCliff(g.tile(x + 1, y))) this.fill('rgba(0,0,0,0.3)', px + TILE - 3, py, 3, TILE);
      } else {
        this.mat(this.theme.cliffTop, px, py, TILE, TILE);
        this.fill('rgba(0,0,0,0.18)', px, py, TILE, TILE);
        if (!isCliff(g.tile(x, y - 1))) this.lip(px, py, x, y);
      }
      if (t.climb) this.ladder(px, py);
    }
    // contact shadow on ground just below a face
    if (!t.wall && !t.cliff) {
      const above = g.tile(x, y - 1);
      if (above.wall || (above.cliff && !above.climb)) this.fill('rgba(0,0,0,0.28)', px, py, TILE, 4);
    }
  }

  private lip(px: number, py: number, x: number, y: number): void {
    this.mat(this.theme.cliffTop, px, py, TILE, 6);
    for (let i = 0; i < TILE; i += 2) if (hash(x * 32 + i, y, 5) < 0.5) this.mat(this.theme.cliffTop, px + i, py + 6, 2, 2);
    this.fill('rgba(255,255,255,0.08)', px, py, TILE, 2);
  }

  private ladder(px: number, py: number): void {
    this.fill('#5a3a1c', px + 7, py, 3, TILE);
    this.fill('#5a3a1c', px + 22, py, 3, TILE);
    for (let r = 3; r < TILE; r += 7) {
      this.fill('#a0703f', px + 7, py + r, 18, 3);
      this.fill('#3a2410', px + 7, py + r + 3, 18, 1);
    }
  }

  private rubble(px: number, py: number, x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      const rx = px + 2 + Math.floor(hash(x, y, i) * 10) * 2, ry = py + 4 + Math.floor(hash(x, y, i + 9) * 8) * 2;
      const w = 8 + Math.floor(hash(x, y, i + 3) * 4) * 2, h = 6 + Math.floor(hash(x, y, i + 5) * 3) * 2;
      this.fill('#2e2622', rx, ry + 2, w, h);
      this.fill('#6e625a', rx, ry, w, h - 2);
      this.fill('#8f8378', rx + 2, ry, w - 4, 2);
    }
  }

  /** Neighbour material creeping into this tile with an irregular 2px-stepped edge. */
  private jagged(material: string, px: number, py: number, side: 'n' | 's' | 'w' | 'e', x: number, y: number, min: number, max: number): void {
    for (let i = 0; i < TILE; i += 2) {
      const r = hash(side === 'n' || side === 's' ? x * 32 + i : y * 32 + i, side === 'n' || side === 's' ? y * 2 + (side === 'n' ? 0 : 1) : x * 2 + (side === 'w' ? 0 : 1), 7);
      // smooth the noise by averaging with the neighbour column
      const r2 = hash(side === 'n' || side === 's' ? x * 32 + i + 2 : y * 32 + i + 2, side === 'n' || side === 's' ? y * 2 + (side === 'n' ? 0 : 1) : x * 2 + (side === 'w' ? 0 : 1), 7);
      const d = Math.round((min + ((r + r2) / 2) * (max - min)) / 2) * 2;
      if (side === 'n') this.mat(material, px + i, py, 2, d);
      else if (side === 's') this.mat(material, px + i, py + TILE - d, 2, d);
      else if (side === 'w') this.mat(material, px, py + i, d, 2);
      else this.mat(material, px + TILE - d, py + i, d, 2);
    }
  }

  private band(px: number, py: number, side: string, w: number, color: string, inset = 0): void {
    if (side === 'n') this.fill(color, px, py + inset, TILE, w);
    else if (side === 's') this.fill(color, px, py + TILE - inset - w, TILE, w);
    else if (side === 'w') this.fill(color, px + inset, py, w, TILE);
    else this.fill(color, px + TILE - inset - w, py, w, TILE);
  }

  private dither(px: number, py: number, side: string, color: string): void {
    for (let i = 0; i < TILE; i += 4) {
      for (let j = 0; j < 8; j += 2) {
        if ((i / 2 + j / 2) % 2) continue;
        if (side === 'n') this.fill(color, px + i, py + j, 2, 2);
        else if (side === 's') this.fill(color, px + i, py + TILE - 2 - j, 2, 2);
        else if (side === 'w') this.fill(color, px + j, py + i, 2, 2);
        else this.fill(color, px + TILE - 2 - j, py + i, 2, 2);
      }
    }
  }

  private foam(px: number, py: number, side: string, x: number, y: number): void {
    for (let i = 0; i < TILE; i += 2) {
      if (hash(x * 32 + i, y, side.charCodeAt(0)) > 0.45) continue;
      const c = 'rgba(230,255,250,0.75)';
      if (side === 'n') this.fill(c, px + i, py + 9, 2, 2);
      else if (side === 's') this.fill(c, px + i, py + TILE - 11, 2, 2);
      else if (side === 'w') this.fill(c, px + 9, py + i, 2, 2);
      else this.fill(c, px + TILE - 11, py + i, 2, 2);
    }
  }
}
