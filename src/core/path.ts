import type { Grid } from './grid';
import { TILE } from './grid';

/** 8-way A* over tiles; diagonal moves only when both orthogonal neighbours are free (no corner cutting). */
export function findPath(
  grid: Grid,
  sx: number, sy: number, gx: number, gy: number,
  opts: { canSwim?: boolean; maxNodes?: number } = {},
): { x: number; y: number }[] | null {
  const W = grid.w, H = grid.h;
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && grid.pathable(x, y, opts.canSwim);
  if (!ok(gx, gy)) return null;
  const start = sy * W + sx, goal = gy * W + gx;
  if (start === goal) return [];
  const g = new Map<number, number>([[start, 0]]);
  const came = new Map<number, number>();
  const open: { k: number; f: number }[] = [{ k: start, f: 0 }];
  const closed = new Set<number>();
  const h = (k: number) => {
    const x = k % W, y = (k / W) | 0;
    const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  const max = opts.maxNodes ?? 4000;
  while (open.length && closed.size < max) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const { k } = open.splice(bi, 1)[0];
    if (k === goal) {
      const out: { x: number; y: number }[] = [];
      let c = k;
      while (c !== start) {
        out.push({ x: c % W, y: (c / W) | 0 });
        c = came.get(c)!;
      }
      return out.reverse();
    }
    if (closed.has(k)) continue;
    closed.add(k);
    const x = k % W, y = (k / W) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!ok(nx, ny)) continue;
        if (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy))) continue;
        const nk = ny * W + nx;
        if (closed.has(nk)) continue;
        const ng = g.get(k)! + (dx && dy ? 1.414 : 1);
        if (ng < (g.get(nk) ?? Infinity)) {
          g.set(nk, ng);
          came.set(nk, k);
          open.push({ k: nk, f: ng + h(nk) });
        }
      }
    }
  }
  return null;
}

export function tileCenter(t: { x: number; y: number }): { x: number; y: number } {
  return { x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE - 6 };
}
