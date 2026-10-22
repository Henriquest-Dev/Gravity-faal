// Pure map geometry shared by the renderer and the automated map validation.
import propsJson from '../data/props.json';
import { check } from './conditions';
import { Grid, TILE, type SolidRect } from './grid';
import type { GameState } from './state';
import type { BuildingDef, MapDef } from './types';

interface PropInfo { foot?: [number, number]; jump?: boolean; div?: number; flat?: boolean }
const PROPS = propsJson as unknown as Record<string, PropInfo>;

export function applyVariants(def: MapDef, s: GameState): string[] {
  const rows = [...def.terrain];
  for (const v of def.variants ?? []) {
    if (!check(v.when, s, def.id)) continue;
    for (const p of v.patches ?? []) {
      p.rows.forEach((row, j) => {
        const y = p.y + j;
        if (y < 0 || y >= rows.length) return;
        const chars = [...rows[y]];
        [...row].forEach((c, i) => { if (c !== ' ' && p.x + i < chars.length) chars[p.x + i] = c; });
        rows[y] = chars.join('');
      });
    }
  }
  return rows;
}

/** Collision footprint of a catalogue prop, in world px, from its bottom-centre pivot. */
export function footRect(propId: string, x: number, y: number, scale = 1): { x: number; y: number; w: number; h: number } | null {
  const info = PROPS[propId];
  if (!info?.foot) return null;
  const k = scale / (info.div ?? 1);
  const w = info.foot[0] * k, h = info.foot[1] * k;
  return { x: x - w / 2, y: y - h, w, h };
}

/** Solid footprint of a composed building, leaving a notch for its door. */
export function buildingRects(b: BuildingDef): SolidRect[] {
  const id = `bld:${b.id}`;
  if (!b.door) return [{ id, x: b.x * TILE, y: b.y * TILE, w: b.w * TILE, h: b.h * TILE }];
  const dx = b.door.x;
  const out: SolidRect[] = [];
  if (dx > b.x) out.push({ id: `${id}:l`, x: b.x * TILE, y: b.y * TILE, w: (dx - b.x) * TILE, h: b.h * TILE });
  if (dx + 1 < b.x + b.w) out.push({ id: `${id}:r`, x: (dx + 1) * TILE, y: b.y * TILE, w: (b.x + b.w - dx - 1) * TILE, h: b.h * TILE });
  out.push({ id: `${id}:back`, x: dx * TILE, y: b.y * TILE, w: TILE, h: (b.h - 1) * TILE });
  return out;
}

/** Grid with terrain variants and every static solid (buildings, props) for a given world state. */
export function staticGrid(def: MapDef, s: GameState): Grid {
  const grid = new Grid(applyVariants(def, s));
  for (const b of def.buildings ?? []) if (check(b.if, s, def.id)) for (const r of buildingRects(b)) grid.addRect(r);
  (def.props ?? []).forEach((p, i) => {
    if (!check(p.if, s, def.id) || p.layer === 'foreground' || p.layer === 'ground' || p.solid === false) return;
    if (PROPS[p.prop]?.flat) return;
    const r = footRect(p.prop, p.x * TILE, p.y * TILE, p.scale ?? 1);
    if (r) grid.addRect({ id: `prop:${p.id ?? i}`, ...r, jumpable: !!PROPS[p.prop]?.jump });
  });
  return grid;
}
