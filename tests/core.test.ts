import { describe, expect, it } from 'vitest';
import { check } from '../src/core/conditions';
import { DialogueRunner } from '../src/core/dialogue';
import { Grid, TILE, type Body } from '../src/core/grid';
import { canEnter, facingFor, normalizeInput, animRate } from '../src/core/motion';
import { findPath } from '../src/core/path';
import { applyEffects, evaluateEnding, updateQuests } from '../src/core/rules';
import { checksum, parseSave, SaveError, SaveStore, serialize, validateState } from '../src/core/save';
import { createState, SAVE_VERSION } from '../src/core/state';
import type { DialogueDef } from '../src/core/types';
import { RULES } from '../src/game/data';

const body = (x: number, y: number, extra: Partial<Body> = {}): Body => ({ x, y, level: 0, hw: 7, hh: 4, canSwim: true, ...extra });

describe('grid movement and collision', () => {
  const rows = [
    '##########',
    '#........#',
    '#..~~==..#',
    '#..~~==..#',
    '#.v......#',
    '#..BB....#',
    '##########',
  ];

  it('walls block, and the transparent sprite margin never does (only the feet box collides)', () => {
    const g = new Grid(rows);
    const b = body(2 * TILE + 16, 2 * TILE - 2);
    const r = g.move(b, -200, 0);
    expect(r.blockedX).toBe(true);
    expect(r.x).toBeGreaterThanOrEqual(TILE + b.hw); // stopped by the wall column, feet box flush
    expect(r.x).toBeLessThan(TILE + b.hw + 1);
  });

  it('diagonal input is normalised: same speed in every direction', () => {
    const d = normalizeInput(1, 1);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 5);
    const s = normalizeInput(0, 1);
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1, 5);
    const analog = normalizeInput(0.3, 0);
    expect(analog.mag).toBeCloseTo(0.3, 5);
  });

  it('props block by their footprint rect; jumpable ones only while airborne', () => {
    const g = new Grid(['.........', '.........', '.........']);
    g.addRect({ id: 'log', x: 100, y: 40, w: 60, h: 12, jumpable: true });
    g.addRect({ id: 'trunk', x: 200, y: 40, w: 18, h: 12 });
    const walk = g.move(body(80, 50), 60, 0);
    expect(walk.blockedX).toBe(true);
    const jump = g.move(body(80, 50, { airborne: true }), 100, 0);
    expect(jump.blockedX).toBe(false);
    // a jump never passes through a solid trunk
    const jumpTrunk = g.move(body(180, 50, { airborne: true }), 60, 0);
    expect(jumpTrunk.blockedX).toBe(true);
  });

  it('pits block walking but not jumping; deep water needs swimming', () => {
    const g = new Grid(rows);
    expect(g.tileBlocks(2, 4, 0, false, true)).toBe(true);
    expect(g.tileBlocks(2, 4, 0, true, true)).toBe(false);
    expect(g.tileBlocks(5, 2, 0, false, false)).toBe(true);
    expect(g.tileBlocks(5, 2, 0, false, true)).toBe(false);
    expect(g.tileAtPx(3 * TILE + 5, 2 * TILE + 5).water).toBe('shallow');
  });

  it('bridges have two levels: walkers go over, swimmers go under, changes only at the heads', () => {
    const r = [
      '.........',
      '~~~~~~~~~',
      '===BB====',
      '~~~~~~~~~',
      '.........',
    ].map((x) => x.replace(/~/g, '=')); // pure deep water channel, bridge is vertical? make it horizontal below
    const g = new Grid([
      '.........',
      '..=====..',
      '..BBBBB..',
      '..=====..',
      '.........',
    ]);
    void r;
    expect(g.bridgeAxis(4, 2)).toBe('h');
    expect(g.isBridgeHead(1, 2)).toBe(true);
    // walker on the head steps onto the deck -> level 1
    const b = body(1 * TILE + 16, 3 * TILE - 2);
    const ptx = 1, pty = 2;
    b.x = 2 * TILE + 10;
    expect(g.updateLevel(b, ptx, pty)).toBe(1);
    // a swimmer arriving from the water stays below (level 0)
    const s = body(3 * TILE + 16, 3 * TILE - 2);
    expect(g.updateLevel(s, 3, 3)).toBe(0);
    // on the deck, stepping sideways into the water is blocked by the rails
    const deck = body(4 * TILE + 16, 3 * TILE - 6, { level: 1 });
    const side = g.move(deck, 0, 40);
    expect(side.blockedY).toBe(true);
  });

  it('ladders are walkable through cliffs; cliffs are not', () => {
    const g = new Grid(['....', 'CHCC', 'CHCC', '....']);
    expect(g.tileBlocks(1, 1, 0, false, false)).toBe(false);
    expect(g.tileBlocks(0, 1, 0, false, false)).toBe(true);
  });

  it('line of sight stops at walls, not at water or pits', () => {
    const g = new Grid(['.....', '..#..', '.....', '.v~..']);
    expect(g.lineOfSight(16, 48, 150, 48)).toBe(false);
    expect(g.lineOfSight(16, 112, 150, 112)).toBe(true);
  });

  it('findStandable recovers a safe point next to an invalid saved position', () => {
    const g = new Grid(['#####', '#...#', '#####']);
    const p = g.findStandable(16, 16);
    expect(p).not.toBeNull();
    expect(g.standable(p!.x, p!.y)).toBe(true);
  });

  it('A* paths avoid walls and do not cut corners', () => {
    const g = new Grid(['......', '.####.', '......']);
    const path = findPath(g, 0, 0, 0, 2)!;
    expect(path).not.toBeNull();
    for (const t of path) expect(g.tile(t.x, t.y).solid).toBeFalsy();
  });
});

describe('actor states and animation', () => {
  it('blocks incompatible combinations', () => {
    expect(canEnter('swim', 'jump', false)).toBe(false);
    expect(canEnter('climb', 'ability', false)).toBe(false);
    expect(canEnter('dialogue', 'ability', false)).toBe(false);
    expect(canEnter('downed', 'walk', true)).toBe(false);
    expect(canEnter('ability', 'hurt', false)).toBe(true);
    expect(canEnter('hurt', 'ability', false)).toBe(false);
    expect(canEnter('ability', 'walk', true)).toBe(true);
  });

  it('keeps a stable facing on diagonals (no flicker between rows)', () => {
    expect(facingFor(1, 1, 'east')).toBe('east');
    expect(facingFor(1, 1, 'south')).toBe('south');
    expect(facingFor(1, 0.95, 'north')).toBe('east');
    expect(facingFor(0, 0, 'west')).toBe('west');
    expect(facingFor(0.1, 1, 'east')).toBe('south');
  });

  it('animation rate follows ground speed', () => {
    expect(animRate(90, 90)).toBe(1);
    expect(animRate(45, 90)).toBe(0.5);
    expect(animRate(0, 90)).toBe(0.35);
  });
});

describe('rules: conditions, effects, quests, dialogue', () => {
  it('conditions combine', () => {
    const s = createState(1);
    s.flags.a = true;
    s.vars.trust = 3;
    s.inventory.key = 1;
    expect(check({ all: [{ flag: 'a' }, { var: 'trust', gte: 3 }, { item: 'key' }] }, s)).toBe(true);
    expect(check({ any: [{ flag: 'b' }, { not: { flag: 'a' } }] }, s)).toBe(false);
  });

  it('indispensable items are never consumed (no soft-lock)', () => {
    const s = createState(2);
    s.inventory.stabilizer = 1;
    applyEffects(s, [{ take: 'stabilizer' }], RULES);
    expect(s.inventory.stabilizer).toBe(1);
    s.inventory.medkit = 1;
    applyEffects(s, [{ take: 'medkit' }], RULES);
    expect(s.inventory.medkit).toBeUndefined();
  });

  it('quests advance step by step and complete', () => {
    const s = createState(1);
    applyEffects(s, [{ questStart: 'a1_q1' }], RULES);
    expect(s.quests.a1_q1).toEqual({ state: 'active', step: 0 });
    s.flags.talked_professor = true;
    updateQuests(s, RULES);
    expect(s.quests.a1_q1.step).toBe(1);
    Object.assign(s.flags, { fountain_examined: true, anomaly_1: true, anomaly_2: true, anomaly_3: true, merchant_resolved: true });
    const sig = updateQuests(s, RULES);
    expect(s.quests.a1_q1.state).toBe('done');
    expect(sig.some((x) => x.type === 'questDone')).toBe(true);
    expect(s.abilities).toContain('geometry');
  });

  it('dialogue choices respect conditions and apply effects', () => {
    const def: DialogueDef = {
      id: 't', entries: [{ start: 'a' }],
      nodes: {
        a: { id: 'a', speaker: 'X', text: 'hi', choices: [
          { text: 'locked', if: { flag: 'nope' }, next: 'b' },
          { text: 'ok', effects: [{ var: 'empathy', add: 2 }], next: 'b' },
        ] },
        b: { id: 'b', speaker: 'X', text: 'bye' },
      },
    };
    const s = createState(1);
    const r = new DialogueRunner(def, s, RULES);
    r.start();
    expect(r.visibleChoices().map((c) => c.text)).toEqual(['ok']);
    r.choose(0);
    expect(s.vars.empathy).toBe(2);
    expect(r.view?.text).toBe('bye');
    r.advance();
    expect(r.done).toBe(true);
  });

  it('every outcome of both arcs is reachable by its rules', () => {
    for (const [arc, ids] of [[1, ['repair', 'exile', 'ascension']], [2, ['balance', 'costly', 'rupture']]] as const) {
      const rules = arc === 1 ? RULES.endings.arc1 : RULES.endings.arc2;
      for (const id of ids) {
        const s = createState(arc);
        const o = rules.outcomes.find((x) => x.id === id)!;
        // push the outcome's own variables and satisfy its points
        for (const [k, w] of Object.entries(o.weights ?? {})) s.vars[k as keyof typeof s.vars] = (w ?? 0) > 0 ? 10 : 0;
        for (const p of o.points ?? []) if (p.points > 0 && 'flag' in p.when) s.flags[p.when.flag] = true;
        expect(evaluateEnding(rules, s).id, `${arc}:${id}`).toBe(id);
      }
    }
  });

  it('combat defeat is not a narrative ending', () => {
    const s = createState(1);
    s.deaths = 5;
    expect(s.arc1Ending).toBeNull();
  });
});

describe('save system', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
  };

  it('round-trips world state with version and checksum', () => {
    const st = mem();
    const store = new SaveStore(st);
    const s = createState(2);
    s.flags.machine_fixed = true;
    s.objects['observatory/terrace_gate'] = 'open';
    s.inventory.stabilizer = 1;
    s.npcs.soos = 'gone';
    s.pos = { x: 100, y: 200, level: 0, dir: 'west' };
    store.write(1, s, 'Teste');
    const back = store.read(1)!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.state.flags.machine_fixed).toBe(true);
    expect(back.state.objects['observatory/terrace_gate']).toBe('open');
    expect(back.state.pos).toEqual({ x: 100, y: 200, level: 0, dir: 'west' });
  });

  it('rejects corrupted files with an identifiable error', () => {
    const file = serialize(createState(1), 'x');
    const text = JSON.stringify(file).replace('"empathy":0', '"empathy":9');
    expect(() => parseSave(text)).toThrow(SaveError);
    expect(() => parseSave('{oops')).toThrow(/JSON/);
    expect(() => parseSave('{"format":"other"}')).toThrow(/Formato/);
  });

  it('migrates old versions and fills missing fields', () => {
    const old = JSON.parse(JSON.stringify(createState(1))) as Record<string, unknown>;
    old.version = 1;
    delete old.objectPos;
    delete old.explored;
    delete old.selectedAbility;
    const s = validateState(old);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.objectPos).toEqual({});
    expect(s.explored).toEqual({});
  });

  it('export and import between slots, list reports corrupt slots without throwing', () => {
    const st = mem();
    const store = new SaveStore(st);
    store.write(1, createState(1), 'A');
    const text = store.exportText(1);
    store.importText(2, text);
    expect(store.read(2)?.summary.mapName).toBe('A');
    st.setItem(store.key(3), '{"format":"gravity-falls-save","state":{"arc":7}}');
    const list = store.list();
    expect(list[2].error).toBeTruthy();
    expect(checksum('abc')).toHaveLength(8);
  });

  it('invalid positions are flagged so the world falls back to a safe spawn', () => {
    const raw = JSON.parse(JSON.stringify(createState(1)));
    raw.pos = { x: 'nan', y: null, level: 0, dir: 'south' };
    const s = validateState(raw);
    expect(s.pos.x).toBe(-1);
  });
});
