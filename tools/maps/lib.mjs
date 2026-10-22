// Small painting toolkit used by the map authoring scripts. Paths, rivers and
// collision layouts are placed deliberately; the seeded RNG only varies decoration.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Canvas {
  constructor(w, h, fill = '.') {
    this.w = w;
    this.h = h;
    this.g = Array.from({ length: h }, () => Array(w).fill(fill));
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.g[y][x] : 'x'; }
  set(x, y, c) { if (this.in(x, y)) this.g[y][x] = c; return this; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); return this; }
  frame(x, y, w, h, c, t = 1) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (i < x + t || i >= x + w - t || j < y + t || j >= y + h - t) this.set(i, j, c);
    }
    return this;
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
      const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.set(i, j, c);
    }
    return this;
  }
  /** Thick polyline; points in tile coords. `only` restricts which codes can be overwritten. */
  path(points, width, c, only = null) {
    for (let k = 0; k < points.length - 1; k++) {
      const [x0, y0] = points[k], [x1, y1] = points[k + 1];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1;
      for (let s = 0; s <= n; s++) {
        const x = x0 + ((x1 - x0) * s) / n, y = y0 + ((y1 - y0) * s) / n;
        const r = (width - 1) / 2;
        for (let j = Math.round(y - r); j <= Math.round(y + r); j++) for (let i = Math.round(x - r); i <= Math.round(x + r); i++) {
          if (!only || only.includes(this.get(i, j))) this.set(i, j, c);
        }
      }
    }
    return this;
  }
  /** River: deep core with shallow banks. */
  river(points, width, shallow = 1) {
    this.path(points, width + shallow * 2, '~');
    if (width > 0) this.path(points, width, '=');
    return this;
  }
  replace(from, to, x = 0, y = 0, w = this.w, h = this.h) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.get(i, j) === from) this.set(i, j, to);
    return this;
  }
  /** Sprinkle a code over cells currently equal to `on` (decorative texture variation only). */
  speckle(on, c, density, seed, x = 0, y = 0, w = this.w, h = this.h) {
    const r = rng(seed);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.get(i, j) === on && r() < density) this.set(i, j, c);
    return this;
  }
  rows() { return this.g.map((r) => r.join('')); }
  stamp(x, y, rows) {
    rows.forEach((row, j) => [...row].forEach((c, i) => { if (c !== ' ') this.set(x + i, y + j, c); }));
    return this;
  }
}

/** Place props on every cell of `code` in a region, deterministic jitter. */
export function forest(canvas, code, props, seed, opts = {}) {
  const r = rng(seed);
  const out = [];
  const step = opts.step ?? 2;
  for (let y = 0; y < canvas.h; y += step) {
    for (let x = (y / step) % 2 ? 1 : 0; x < canvas.w; x += step) {
      if (canvas.get(x, y) !== code) continue;
      if (opts.skip && opts.skip(x, y)) continue;
      if (r() < (opts.gap ?? 0.12)) continue;
      out.push({ prop: props[Math.floor(r() * props.length)], x: x + 0.5 + (r() - 0.5) * 0.6, y: y + 1 + (r() - 0.5) * 0.3, flip: r() < 0.5 });
    }
  }
  return out;
}

/** Scatter decorative non-solid props on cells equal to `on`. */
export function decorate(canvas, on, props, count, seed, region = null) {
  const r = rng(seed);
  const out = [];
  let tries = 0;
  while (out.length < count && tries++ < count * 40) {
    const x = region ? region[0] + Math.floor(r() * region[2]) : Math.floor(r() * canvas.w);
    const y = region ? region[1] + Math.floor(r() * region[3]) : Math.floor(r() * canvas.h);
    if (canvas.get(x, y) !== on) continue;
    if (out.some((p) => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2)) continue;
    out.push({ prop: props[Math.floor(r() * props.length)], x: x + 0.5, y: y + 0.9, flip: r() < 0.5 });
  }
  return out;
}

/** Moves every placed thing of a map definition `n` rows down, prepending `fill` rows of terrain. */
export function shiftDown(def, n, fill = 'x') {
  def.terrain = [...Array.from({ length: n }, () => fill.repeat(def.width)), ...def.terrain];
  def.height += n;
  const mv = (o) => { if (o && typeof o.y === 'number') o.y += n; if (o?.landing) o.landing.y += n; };
  for (const k of ['buildings', 'props', 'npcs', 'enemies', 'interactables', 'triggers', 'checkpoints', 'exits']) for (const o of def[k] ?? []) mv(o);
  for (const o of Object.values(def.spawns ?? {})) mv(o);
  return def;
}
