import tilesJson from '../data/tiles.json';

export const TILE = 32;

export interface TileDef {
  code: string;
  name: string;
  texture: string;
  priority: number;
  surface: string;
  color: string;
  solid?: boolean;
  water?: 'shallow' | 'deep';
  pit?: boolean;
  climb?: boolean;
  bridge?: boolean;
  wall?: boolean;
  cliff?: boolean;
  blocker?: boolean;
  rubble?: boolean;
}

export const LEGEND: Record<string, TileDef> = Object.fromEntries(
  Object.entries((tilesJson as { legend: Record<string, Omit<TileDef, 'code'>> }).legend).map(([code, d]) => [code, { code, ...d }]),
);

export interface SolidRect {
  id: string;
  x: number; y: number; w: number; h: number;
  jumpable?: boolean; // low obstacle a jump clears
  level?: number; // only blocks actors on this level (undefined = level 0)
  dynamic?: boolean;
}

export interface Body {
  x: number; // feet centre
  y: number; // feet line
  level: number; // 0 ground, 1 bridge deck
  hw: number; // half width of the feet box
  hh: number; // half height of the feet box (box spans y-2hh .. y)
  airborne?: boolean;
  canSwim?: boolean;
  ignore?: string; // own dynamic rect id
}

export interface MoveResult {
  x: number;
  y: number;
  blockedX: boolean;
  blockedY: boolean;
}

/** Collision and terrain queries for one map. Pure: no rendering code. */
export class Grid {
  readonly w: number;
  readonly h: number;
  private codes: string[];
  private rects = new Map<string, SolidRect>();
  private buckets = new Map<number, Set<string>>();

  constructor(rows: string[]) {
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    this.codes = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = rows[y][x] ?? 'x';
        if (!LEGEND[c]) throw new Error(`Unknown tile code "${c}" at ${x},${y}`);
        this.codes.push(c);
      }
    }
  }

  get pxW(): number { return this.w * TILE; }
  get pxH(): number { return this.h * TILE; }

  code(tx: number, ty: number): string {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return 'x';
    return this.codes[ty * this.w + tx];
  }

  setCode(tx: number, ty: number, c: string): void {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    if (!LEGEND[c]) throw new Error(`Unknown tile code ${c}`);
    this.codes[ty * this.w + tx] = c;
  }

  tile(tx: number, ty: number): TileDef {
    return LEGEND[this.code(tx, ty)];
  }

  tileAtPx(x: number, y: number): TileDef {
    return this.tile(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  // ------------------------------------------------------------ solid rects
  private bucketKeys(r: SolidRect): number[] {
    const keys: number[] = [];
    const x0 = Math.floor(r.x / TILE), x1 = Math.floor((r.x + r.w - 0.01) / TILE);
    const y0 = Math.floor(r.y / TILE), y1 = Math.floor((r.y + r.h - 0.01) / TILE);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) keys.push(y * 4096 + x);
    return keys;
  }

  addRect(r: SolidRect): void {
    this.removeRect(r.id);
    this.rects.set(r.id, r);
    for (const k of this.bucketKeys(r)) {
      let b = this.buckets.get(k);
      if (!b) this.buckets.set(k, (b = new Set()));
      b.add(r.id);
    }
  }

  removeRect(id: string): void {
    const r = this.rects.get(id);
    if (!r) return;
    for (const k of this.bucketKeys(r)) this.buckets.get(k)?.delete(id);
    this.rects.delete(id);
  }

  moveRect(id: string, x: number, y: number): void {
    const r = this.rects.get(id);
    if (!r) return;
    this.addRect({ ...r, x, y });
  }

  getRect(id: string): SolidRect | undefined {
    return this.rects.get(id);
  }

  allRects(): IterableIterator<SolidRect> {
    return this.rects.values();
  }

  rectsNear(x0: number, y0: number, x1: number, y1: number): SolidRect[] {
    const seen = new Set<string>();
    const out: SolidRect[] = [];
    for (let ty = Math.floor(y0 / TILE); ty <= Math.floor(y1 / TILE); ty++) {
      for (let tx = Math.floor(x0 / TILE); tx <= Math.floor(x1 / TILE); tx++) {
        const b = this.buckets.get(ty * 4096 + tx);
        if (!b) continue;
        for (const id of b) {
          if (seen.has(id)) continue;
          seen.add(id);
          out.push(this.rects.get(id)!);
        }
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- bridges
  /** "h" if the bridge runs east-west, "v" north-south. */
  bridgeAxis(tx: number, ty: number): 'h' | 'v' {
    const horiz = this.tile(tx - 1, ty).bridge || this.tile(tx + 1, ty).bridge;
    const vert = this.tile(tx, ty - 1).bridge || this.tile(tx, ty + 1).bridge;
    if (horiz && !vert) return 'h';
    if (vert && !horiz) return 'v';
    // single tile bridge: axis goes towards dry land
    const dryH = !this.tile(tx - 1, ty).water || !this.tile(tx + 1, ty).water;
    return dryH ? 'h' : 'v';
  }

  /** A dry walkable tile touching a bridge end along the bridge axis. */
  isBridgeHead(tx: number, ty: number): boolean {
    const t = this.tile(tx, ty);
    if (t.bridge || t.water || t.solid || t.pit) return false;
    const n: [number, number, 'h' | 'v'][] = [[tx - 1, ty, 'h'], [tx + 1, ty, 'h'], [tx, ty - 1, 'v'], [tx, ty + 1, 'v']];
    return n.some(([x, y, ax]) => this.tile(x, y).bridge && this.bridgeAxis(x, y) === ax);
  }

  // ---------------------------------------------------------- walkability
  /** Tile-level test used for both bodies and pathfinding. */
  tileBlocks(tx: number, ty: number, level: number, airborne: boolean, canSwim: boolean): boolean {
    const t = this.tile(tx, ty);
    if (level >= 1) return !(t.bridge || this.isBridgeHead(tx, ty));
    if (t.climb) return false;
    if (t.solid) return true;
    if (t.pit) return !airborne;
    if (t.bridge) return !canSwim && !this.isBridgeHeadNeighbour(tx, ty);
    if (t.water === 'deep') return !canSwim;
    return false;
  }

  private isBridgeHeadNeighbour(tx: number, ty: number): boolean {
    const ax = this.bridgeAxis(tx, ty);
    return ax === 'h' ? this.isBridgeHead(tx - 1, ty) || this.isBridgeHead(tx + 1, ty) : this.isBridgeHead(tx, ty - 1) || this.isBridgeHead(tx, ty + 1);
  }

  boxBlocked(b: Body, x: number, y: number): boolean {
    const x0 = x - b.hw, x1 = x + b.hw - 0.01;
    const y0 = y - b.hh * 2, y1 = y - 0.01;
    if (x0 < 0 || y0 < 0 || x1 >= this.pxW || y1 >= this.pxH) return true;
    for (let ty = Math.floor(y0 / TILE); ty <= Math.floor(y1 / TILE); ty++) {
      for (let tx = Math.floor(x0 / TILE); tx <= Math.floor(x1 / TILE); tx++) {
        if (this.tileBlocks(tx, ty, b.level, !!b.airborne, b.canSwim !== false)) return true;
      }
    }
    for (const r of this.rectsNear(x0, y0, x1, y1)) {
      if (r.id === b.ignore) continue;
      if ((r.level ?? 0) !== b.level) continue;
      if (r.jumpable && b.airborne) continue;
      if (x0 < r.x + r.w && x1 > r.x && y0 < r.y + r.h && y1 > r.y) return true;
    }
    return false;
  }

  /**
   * Axis-separated movement with sub-steps (no tunnelling) and a small corner
   * nudge so the body slides around corners instead of snagging on them.
   */
  move(b: Body, dx: number, dy: number): MoveResult {
    let { x, y } = b;
    let blockedX = false, blockedY = false;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0 && !blockedX) {
        if (!this.boxBlocked(b, x + sx, y)) x += sx;
        else {
          const n = sy === 0 ? this.nudge(b, x + sx, y, 'y') : 0;
          if (n !== 0) { y += n; x += sx; } else { blockedX = true; x = this.contact(b, x, y, sx, 0).x; }
        }
      }
      if (sy !== 0 && !blockedY) {
        if (!this.boxBlocked(b, x, y + sy)) y += sy;
        else {
          const n = sx === 0 ? this.nudge(b, x, y + sy, 'x') : 0;
          if (n !== 0) { x += n; y += sy; } else { blockedY = true; y = this.contact(b, x, y, 0, sy).y; }
        }
      }
    }
    return { x, y, blockedX, blockedY };
  }

  /** Closes the remaining gap to an obstacle so bodies rest flush against it. */
  private contact(b: Body, x: number, y: number, dx: number, dy: number): { x: number; y: number } {
    let step = 0.5;
    for (let i = 0; i < 5; i++) {
      if (!this.boxBlocked(b, x + dx * step, y + dy * step)) { x += dx * step; y += dy * step; }
      step /= 2;
    }
    return { x, y };
  }

  private nudge(b: Body, x: number, y: number, axis: 'x' | 'y'): number {
    for (let d = 1; d <= 7; d++) {
      for (const s of [d, -d]) {
        const nx = axis === 'x' ? x + s : x;
        const ny = axis === 'y' ? y + s : y;
        if (!this.boxBlocked(b, nx, ny)) return Math.sign(s) * Math.min(1.5, Math.abs(s));
      }
    }
    return 0;
  }

  /** Bridge level transitions; call after each move with the previous feet tile. */
  updateLevel(b: Body, prevTx: number, prevTy: number): number {
    const tx = Math.floor(b.x / TILE), ty = Math.floor((b.y - b.hh) / TILE);
    const t = this.tile(tx, ty);
    if (b.level >= 1) {
      if (!t.bridge && !this.isBridgeHead(tx, ty)) return 0;
      if (!t.bridge) {
        // fully on the head: back to ground level
        const x0 = Math.floor((b.x - b.hw) / TILE), x1 = Math.floor((b.x + b.hw - 0.01) / TILE);
        const y0 = Math.floor((b.y - b.hh * 2) / TILE), y1 = Math.floor((b.y - 0.01) / TILE);
        let touching = false;
        for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) if (this.tile(xx, yy).bridge) touching = true;
        return touching ? 1 : 0;
      }
      return 1;
    }
    if (t.bridge && this.isBridgeHead(prevTx, prevTy)) return 1;
    return 0;
  }

  /** Line of sight between two points against solid tiles (walls, cliffs). */
  lineOfSight(x0: number, y0: number, x1: number, y1: number, blockWater = false): boolean {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist / 8);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const tile = this.tileAtPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      if ((tile.solid && !tile.blocker) || (tile.wall || tile.cliff) && !tile.climb) return false;
      if (blockWater && tile.water) return false;
    }
    return true;
  }

  /** Tile is free for a standing body of the given size (used for safe spawn checks). */
  standable(x: number, y: number, hw = 7, hh = 4, level = 0): boolean {
    const t = this.tileAtPx(x, y - hh);
    if (t.pit || (t.water === 'deep' && level === 0 && !t.bridge)) return false;
    return !this.boxBlocked({ x, y, level, hw, hh, canSwim: false }, x, y);
  }

  /** Nearest standable point by spiral search, or null. */
  findStandable(x: number, y: number, maxRadius = 12): { x: number; y: number } | null {
    if (this.standable(x, y)) return { x, y };
    const tx0 = Math.floor(x / TILE), ty0 = Math.floor(y / TILE);
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const cx = (tx0 + dx) * TILE + TILE / 2, cy = (ty0 + dy) * TILE + TILE - 4;
          if (this.standable(cx, cy)) return { x: cx, y: cy };
        }
      }
    }
    return null;
  }

  /** Coarse tile walkability for A*: tile passable and centre not inside a static rect. */
  pathable(tx: number, ty: number, canSwim = false): boolean {
    if (this.tileBlocks(tx, ty, 0, false, canSwim)) return false;
    const t = this.tile(tx, ty);
    if (t.pit) return false;
    if (!canSwim && (t.water === 'deep')) return false;
    const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
    for (const r of this.rectsNear(cx - 6, cy - 6, cx + 6, cy + 6)) {
      if (r.dynamic || (r.level ?? 0) !== 0) continue;
      if (cx + 5 > r.x && cx - 5 < r.x + r.w && cy + 5 > r.y && cy - 5 < r.y + r.h) return false;
    }
    return true;
  }
}
