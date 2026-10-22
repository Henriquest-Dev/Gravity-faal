import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check } from '../src/core/conditions';
import { LEGEND, TILE, type Grid } from '../src/core/grid';
import { staticGrid } from '../src/core/mapgeom';
import { createState, type GameState } from '../src/core/state';
import type { Condition, Effect, MapDef } from '../src/core/types';
import { ABILITIES, CHARACTERS, DIALOGUES, ENEMIES, ITEMS, MAPS, QUESTS, RULES } from '../src/game/data';

const manifest = JSON.parse(readFileSync('public/assets/metadata/manifest.json', 'utf8')) as { props: Record<string, unknown>; environments: Record<string, unknown> };

/** World states worth checking: every flag a variant or exit condition depends on, both ways. */
function statesFor(def: MapDef): GameState[] {
  const base = createState(def.arc);
  const flags = new Set<string>();
  const walk = (c: unknown) => {
    if (!c || typeof c !== 'object') return;
    const o = c as Record<string, unknown>;
    if (typeof o.flag === 'string') flags.add(o.flag);
    for (const v of Object.values(o)) if (typeof v === 'object') walk(v);
  };
  for (const v of def.variants ?? []) walk(v.when);
  const out = [base];
  for (const f of flags) {
    const s = createState(def.arc);
    s.flags[f] = true;
    out.push(s);
  }
  return out;
}

/**
 * Tile reachability with every ability: walking, swimming, ladders, one-tile
 * jumps over pits, rift pairs and grapple posts. Doors and push blocks are
 * treated as solvable (their requirements are checked separately).
 */
function reachable(def: MapDef, grid: Grid, from: { x: number; y: number }): Set<number> {
  const W = grid.w;
  const key = (x: number, y: number) => y * W + x;
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < grid.w && y < grid.h && (grid.pathable(x, y, true) || isOpenable(def, x, y));
  const seen = new Set<number>();
  const q: [number, number][] = [];
  const push = (x: number, y: number) => {
    const k = key(x, y);
    if (seen.has(k) || !ok(x, y)) return;
    seen.add(k);
    q.push([x, y]);
  };
  push(from.x, from.y);
  const rifts = (def.interactables ?? []).filter((i) => i.kind === 'rift');
  const posts = (def.interactables ?? []).filter((i) => i.kind === 'grapple' && i.landing);
  for (let guard = 0; guard < 6; guard++) {
    while (q.length) {
      const [x, y] = q.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        push(x + dx, y + dy);
        // jump across exactly one pit tile
        if (grid.tile(x + dx, y + dy).pit) push(x + dx * 2, y + dy * 2);
      }
    }
    // special links can only be used from reached tiles
    let added = false;
    for (const r of rifts) {
      const partner = rifts.find((p) => p.id === r.pair);
      if (!partner) continue;
      if (near(seen, W, r.x, r.y, 1.6)) {
        const n = seen.size;
        push(Math.floor(partner.x), Math.floor(partner.y));
        push(Math.floor(partner.x), Math.floor(partner.y + 0.6));
        added ||= seen.size > n;
      }
    }
    for (const p of posts) {
      const range = (ABILITIES.grapple.range ?? 200) / TILE;
      for (const k of [...seen]) {
        const tx = k % W, ty = Math.floor(k / W);
        if (Math.hypot(tx + 0.5 - p.x, ty + 0.5 - p.y) > range) continue;
        if (!grid.lineOfSight(tx * TILE + 16, ty * TILE + 16, p.x * TILE, p.y * TILE - 8)) continue;
        const n = seen.size;
        push(Math.floor(p.landing!.x), Math.floor(p.landing!.y - 0.01));
        added ||= seen.size > n;
        break;
      }
    }
    if (!added) break;
  }
  return seen;
}

function isOpenable(def: MapDef, x: number, y: number): boolean {
  return (def.interactables ?? []).some((i) => (i.kind === 'door' || i.kind === 'push') && Math.floor(i.x) === x && Math.floor(i.y - 0.05) === y);
}

function near(seen: Set<number>, W: number, x: number, y: number, r: number): boolean {
  for (let ty = Math.floor(y - r); ty <= Math.ceil(y + r); ty++) {
    for (let tx = Math.floor(x - r); tx <= Math.ceil(x + r); tx++) {
      if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) <= r + 0.5 && seen.has(ty * W + tx)) return true;
    }
  }
  return false;
}

const allEffects: Effect[] = [];
const allConditions: Condition[] = [];
function collect(o: unknown, parentKey = ''): void {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    for (const v of o) collect(v, parentKey);
    return;
  }
  const r = o as Record<string, unknown>;
  if (['effects', 'onDone', 'onFail', 'onComplete', 'onEnter', 'offEffects', 'onSolve', 'use'].includes(parentKey)) allEffects.push(r as Effect);
  if (['if', 'requires', 'complete', 'when', 'failWhen'].includes(parentKey)) allConditions.push(r as Condition);
  for (const [k, v] of Object.entries(r)) collect(v, k);
}
collect(Object.values(MAPS));
collect(Object.values(DIALOGUES));
collect(Object.values(QUESTS));
collect(RULES.endings);
collect(RULES.arc2Setup);
collect(Object.values(ITEMS));

describe('map data', () => {
  it('has the sixteen areas', () => {
    expect(Object.keys(MAPS).sort()).toEqual([
      'bill_house', 'euclydia_plaza', 'euclydia_rupture', 'forest_lake_cave', 'mcgucket_workshop', 'nightmare_realm',
      'observatory', 'portal_bunker', 'shack_exterior', 'shack_interior', 'time_archive', 'time_baby_arena',
      'time_city', 'timeline_crossing', 'town_center', 'town_invaded',
    ]);
  });

  for (const def of Object.values(MAPS)) {
    describe(def.id, () => {
      it('terrain is rectangular and uses known tiles', () => {
        expect(def.terrain.length).toBe(def.height);
        for (const row of def.terrain) {
          expect(row.length).toBe(def.width);
          for (const ch of row) expect(LEGEND[ch], `tile "${ch}"`).toBeTruthy();
        }
        expect(def.width * TILE).toBeLessThanOrEqual(4096); // single canvas texture limit
      });

      it('references existing props, characters, enemies, dialogues and maps', () => {
        for (const p of def.props ?? []) expect(manifest.props[p.prop], p.prop).toBeTruthy();
        for (const i of def.interactables ?? []) {
          if (i.prop && !i.prop.startsWith('@')) expect(manifest.props[i.prop], i.prop).toBeTruthy();
          if (i.item) expect(ITEMS[i.item], i.item).toBeTruthy();
          if (i.kind === 'npcProxy') expect(DIALOGUES[i.text ?? ''], `${i.id} -> ${i.text}`).toBeTruthy();
          if (i.pair) expect((def.interactables ?? []).some((o) => o.id === i.pair), `${i.id} pair`).toBe(true);
        }
        for (const n of def.npcs ?? []) {
          expect(CHARACTERS[n.character], n.character).toBeTruthy();
          expect(DIALOGUES[n.dialogue], `${n.id} -> ${n.dialogue}`).toBeTruthy();
        }
        for (const e of def.enemies ?? []) {
          expect(ENEMIES[e.type], e.type).toBeTruthy();
          if (e.dialogue) expect(DIALOGUES[e.dialogue], e.dialogue).toBeTruthy();
        }
        for (const e of def.exits) {
          expect(MAPS[e.to], `${def.id}.${e.id} -> ${e.to}`).toBeTruthy();
          expect(MAPS[e.to].spawns[e.spawn], `${e.to} spawn ${e.spawn}`).toBeTruthy();
        }
        if (def.reference) expect(manifest.environments[def.reference]).toBeTruthy();
      });

      it('spawns are standable and every exit, NPC and interactable is reachable', () => {
        for (const s of statesFor(def)) {
          const grid = staticGrid(def, s);
          const start = def.spawns.default ?? Object.values(def.spawns)[0];
          const reach = reachable(def, grid, { x: Math.floor(start.x), y: Math.floor(start.y - 0.2) });
          for (const [name, sp] of Object.entries(def.spawns)) {
            // spawns may be on the far side of a temporal variant; they must at least be standable or recoverable nearby
            const spot = grid.findStandable(sp.x * TILE, sp.y * TILE, 2);
            expect(spot, `${def.id} spawn ${name}`).not.toBeNull();
          }
          for (const e of def.exits) {
            if (!check(e.if, s, def.id)) continue;
            let any = false;
            for (let y = Math.floor(e.y); y < Math.ceil(e.y + e.h); y++) for (let x = Math.floor(e.x); x < Math.ceil(e.x + e.w); x++) {
              if (reach.has(y * grid.w + x) || near(reach, grid.w, x + 0.5, y + 0.5, 1)) any = true;
            }
            if (def.id === 'time_city' && ((e.id === 'to_archive' && !s.flags.time_past) || (e.id === 'to_arena' && s.flags.time_past))) continue;
            expect(any, `${def.id}: exit ${e.id} unreachable`).toBe(true);
          }
          for (const i of def.interactables ?? []) {
            if (!check(i.if, s, def.id)) continue;
            const r = i.kind === 'grapple' ? (ABILITIES.grapple.range ?? 200) / TILE : 1.6;
            expect(near(reach, grid.w, i.x, i.y - 0.3, r), `${def.id}: ${i.id} unreachable`).toBe(true);
          }
          for (const n of def.npcs ?? []) {
            if (!check(n.if, s, def.id)) continue;
            if (def.id === 'town_invaded' && n.id === 'soos_trapped') continue; // behind a door the test opens via isOpenable
            expect(near(reach, grid.w, n.x, n.y - 0.3, 1.8), `${def.id}: NPC ${n.id} unreachable`).toBe(true);
          }
        }
      });
    });
  }

  it('every area is connected to the arc starting points', () => {
    const graph = new Map<string, Set<string>>();
    const link = (a: string, b: string) => { if (!graph.has(a)) graph.set(a, new Set()); graph.get(a)!.add(b); };
    for (const def of Object.values(MAPS)) {
      for (const e of def.exits) link(def.id, e.to);
      for (const i of def.interactables ?? []) for (const eff of i.effects ?? []) if ('teleport' in eff) link(def.id, eff.teleport.map);
    }
    for (const d of Object.values(DIALOGUES)) for (const n of Object.values(d.nodes)) {
      for (const eff of [...(n.effects ?? []), ...(n.choices ?? []).flatMap((c) => c.effects ?? [])]) if ('teleport' in eff) link('*', eff.teleport.map);
    }
    const seen = new Set(['euclydia_plaza', 'shack_exterior']);
    const queue = [...seen];
    while (queue.length) {
      const m = queue.shift()!;
      for (const n of graph.get(m) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
    expect([...seen].sort()).toEqual(Object.keys(MAPS).sort());
  });
});

describe('content references', () => {
  it('dialogue nodes and entries point to existing nodes', () => {
    for (const d of Object.values(DIALOGUES)) {
      for (const e of d.entries) expect(d.nodes[e.start], `${d.id} entry ${e.start}`).toBeTruthy();
      for (const n of Object.values(d.nodes)) {
        if (n.next) expect(d.nodes[n.next], `${d.id}.${n.id} next`).toBeTruthy();
        for (const c of n.choices ?? []) if (c.next) expect(d.nodes[c.next], `${d.id}.${n.id} choice -> ${c.next}`).toBeTruthy();
      }
    }
  });

  it('effects reference known items, abilities, quests and journal entries', () => {
    for (const e of allEffects) {
      if ('give' in e) expect(ITEMS[e.give], `give ${e.give}`).toBeTruthy();
      if ('take' in e) expect(ITEMS[e.take], `take ${e.take}`).toBeTruthy();
      if ('unlock' in e) expect(ABILITIES[e.unlock], `unlock ${e.unlock}`).toBeTruthy();
      if ('questStart' in e) expect(QUESTS[e.questStart], `quest ${e.questStart}`).toBeTruthy();
      if ('journal' in e) expect(RULES.journal[e.journal], `journal ${e.journal}`).toBeTruthy();
      if ('teleport' in e) expect(MAPS[e.teleport.map]?.spawns[e.teleport.spawn], `teleport ${e.teleport.map}/${e.teleport.spawn}`).toBeTruthy();
    }
  });

  it('every flag, item and ability a condition needs can be produced somewhere (no impossible requirement)', () => {
    const flags = new Set<string>(), items = new Set<string>(), abilities = new Set<string>(), objects = new Set<string>();
    for (const e of allEffects) {
      if ('setFlag' in e && e.value !== false) flags.add(e.setFlag);
      if ('give' in e) items.add(e.give);
      if ('unlock' in e) abilities.add(e.unlock);
      if ('setObject' in e) objects.add(e.setObject.split('/').pop()!);
    }
    for (const def of Object.values(MAPS)) for (const i of def.interactables ?? []) {
      if (i.item) items.add(i.item);
      if (i.group) flags.add(`${i.group}_solved`);
      if (i.kind === 'door') objects.add(i.id);
      if (i.hidden) flags.add(`revealed:${def.id}/${i.id}`);
    }
    // flags produced by the engine itself
    for (const f of ['bill_ally', 'bill_ambiguous', 'bill_threat', 'game_complete', 'time_past']) flags.add(f);
    const deliberatelyImpossible = new Set(['never']);
    const missing: string[] = [];
    const walk = (c: Condition) => {
      if ('all' in c) c.all.forEach(walk);
      else if ('any' in c) c.any.forEach(walk);
      else if ('not' in c) return;
      else if ('flag' in c) { if (!flags.has(c.flag) && !deliberatelyImpossible.has(c.flag) && !c.flag.startsWith('pacified:')) missing.push(`flag ${c.flag}`); }
      else if ('item' in c) { if (!items.has(c.item)) missing.push(`item ${c.item}`); }
      else if ('ability' in c) { if (!abilities.has(c.ability)) missing.push(`ability ${c.ability}`); }
      else if ('object' in c) { if (!objects.has(c.object.split('/').pop()!)) missing.push(`object ${c.object}`); }
    };
    allConditions.forEach(walk);
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('reachability check is meaningful', () => {
  it('the cave beyond the ravine needs the grapple: without posts it is unreachable', () => {
    const def = { ...MAPS.forest_lake_cave, interactables: (MAPS.forest_lake_cave.interactables ?? []).filter((i) => i.kind !== 'grapple') };
    const grid = staticGrid(def, createState(2));
    const reach = reachable(def, grid, { x: 24, y: 3 });
    expect(reach.has(15 * grid.w + 38)).toBe(false);
    const full = reachable(MAPS.forest_lake_cave, staticGrid(MAPS.forest_lake_cave, createState(2)), { x: 24, y: 3 });
    expect(full.has(15 * grid.w + 38)).toBe(true);
  });

  it('the nightmare heart is closed without the rune door (one-tile jumps alone do not reach it)', () => {
    const def = { ...MAPS.nightmare_realm, interactables: (MAPS.nightmare_realm.interactables ?? []).filter((i) => i.kind !== 'door') };
    const grid = staticGrid(def, createState(1));
    const door = MAPS.nightmare_realm.interactables!.find((i) => i.id === 'void_door')!;
    grid.addRect({ id: 'door', x: Math.floor(door.x) * TILE - 16, y: Math.floor(door.y - 0.05) * TILE, w: 64, h: TILE });
    const reach = reachable(def, grid, { x: 22, y: 29 });
    expect(reach.has(5 * grid.w + 22)).toBe(false);
  });
});
