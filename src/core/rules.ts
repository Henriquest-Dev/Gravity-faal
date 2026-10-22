import { check } from './conditions';
import type { GameState } from './state';
import { addItem, addJournal, objKey, record, removeItem } from './state';
import type { Arc1Ending, Arc2Ending, Condition, Effect, EndingRules, QuestDef } from './types';

export interface Arc2Setup {
  effects: Effect[];
  journal: string;
}

export interface RuleData {
  quests: Record<string, QuestDef>;
  endings: { arc1: EndingRules; arc2: EndingRules };
  arc2Setup: Record<Arc1Ending, Arc2Setup>;
  journal: Record<string, string>;
  items: Record<string, { name: string; key?: boolean }>;
}

/** Side effects the engine must perform after pure state changes. */
export type Signal =
  | { type: 'teleport'; map: string; spawn: string }
  | { type: 'toast'; text: string }
  | { type: 'questStarted'; id: string }
  | { type: 'questStep'; id: string; step: number }
  | { type: 'questDone'; id: string }
  | { type: 'questFailed'; id: string }
  | { type: 'ending'; arc: 1 | 2; id: string }
  | { type: 'arc2' }
  | { type: 'checkpoint' }
  | { type: 'unlock'; ability: string }
  | { type: 'item'; id: string; count: number }
  | { type: 'objectChanged'; key: string; state: string }
  | { type: 'party' };

export function applyEffects(s: GameState, effects: Effect[] | undefined, data: RuleData, mapId = s.mapId): Signal[] {
  const out: Signal[] = [];
  if (!effects) return out;
  for (const e of effects) applyOne(s, e, data, mapId, out);
  out.push(...updateQuests(s, data));
  return out;
}

function applyOne(s: GameState, e: Effect, data: RuleData, mapId: string, out: Signal[]): void {
  if ('setFlag' in e) s.flags[e.setFlag] = e.value ?? true;
  else if ('var' in e) s.vars[e.var] = clampVar(e.var, (s.vars[e.var] ?? 0) + e.add);
  else if ('give' in e) {
    addItem(s, e.give, e.count ?? 1);
    out.push({ type: 'item', id: e.give, count: e.count ?? 1 });
  } else if ('take' in e) {
    const item = data.items[e.take];
    // indispensable items are never consumed by effects: prevents soft-locks
    if (!item?.key) removeItem(s, e.take, e.count ?? 1);
  } else if ('unlock' in e) {
    if (!s.abilities.includes(e.unlock)) {
      s.abilities.push(e.unlock);
      out.push({ type: 'unlock', ability: e.unlock });
    }
  } else if ('questStart' in e) {
    const q = s.quests[e.questStart];
    if (!q || q.state === 'inactive') {
      s.quests[e.questStart] = { state: 'active', step: 0 };
      out.push({ type: 'questStarted', id: e.questStart });
    }
  } else if ('questComplete' in e) {
    completeQuest(s, e.questComplete, data, out);
  } else if ('questFail' in e) {
    const q = s.quests[e.questFail];
    if (q && q.state === 'active') {
      q.state = 'failed';
      out.push({ type: 'questFailed', id: e.questFail });
      const def = data.quests[e.questFail];
      if (def?.onFail) for (const f of def.onFail) applyOne(s, f, data, mapId, out);
    }
  } else if ('journal' in e) {
    const text = data.journal[e.journal] ?? e.journal;
    if (addJournal(s, e.journal, text)) out.push({ type: 'toast', text: 'Diário actualizado' });
  } else if ('record' in e) record(s, e.record, e.value);
  else if ('heal' in e) {
    const hp = s.hp[s.character] ?? s.maxHp;
    s.hp[s.character] = Math.min(s.maxHp, hp + e.heal);
  } else if ('restoreEnergy' in e) s.energy = Math.min(s.maxEnergy, s.energy + e.restoreEnergy);
  else if ('setObject' in e) {
    const key = e.setObject.includes('/') ? e.setObject : objKey(mapId, e.setObject);
    s.objects[key] = e.state;
    out.push({ type: 'objectChanged', key, state: e.state });
  } else if ('setNpc' in e) s.npcs[e.setNpc] = e.state;
  else if ('teleport' in e) out.push({ type: 'teleport', map: e.teleport.map, spawn: e.teleport.spawn });
  else if ('evaluateEnding' in e) {
    if (e.evaluateEnding === 1) {
      const r = evaluateEnding(data.endings.arc1, s);
      s.arc1Ending = r.id as Arc1Ending;
      out.push({ type: 'ending', arc: 1, id: r.id });
    } else {
      const r = evaluateEnding(data.endings.arc2, s);
      s.arc2Ending = r.id as Arc2Ending;
      out.push({ type: 'ending', arc: 2, id: r.id });
    }
  } else if ('startArc2' in e) {
    startArc2(s, data);
    out.push({ type: 'arc2' });
  } else if ('party' in e) {
    s.party = [...e.party];
    for (const c of s.party) if (s.hp[c] === undefined) s.hp[c] = s.maxHp;
    if (!s.party.includes(s.character)) s.character = s.party[0];
    out.push({ type: 'party' });
  } else if ('toast' in e) out.push({ type: 'toast', text: e.toast });
  else if ('checkpoint' in e) out.push({ type: 'checkpoint' });
}

const VAR_LIMITS = { min: -20, max: 20 };
function clampVar(name: string, v: number): number {
  if (name === 'reality') return Math.max(0, Math.min(20, v));
  if (name === 'timeDebt') return Math.max(0, Math.min(20, v));
  return Math.max(VAR_LIMITS.min, Math.min(VAR_LIMITS.max, v));
}

function completeQuest(s: GameState, id: string, data: RuleData, out: Signal[]): void {
  const q = s.quests[id] ?? { state: 'inactive', step: 0 };
  if (q.state === 'done' || q.state === 'failed') return;
  const def = data.quests[id];
  q.state = 'done';
  q.step = def ? def.steps.length : q.step;
  s.quests[id] = q;
  out.push({ type: 'questDone', id });
  if (def?.onDone) for (const e of def.onDone) applyOne(s, e, data, s.mapId, out);
}

/**
 * Advance active quests whose current step condition holds. Loops until stable so
 * that chained steps complete in one call; bounded to avoid infinite loops on bad data.
 */
export function updateQuests(s: GameState, data: RuleData): Signal[] {
  const out: Signal[] = [];
  for (let guard = 0; guard < 64; guard++) {
    let changed = false;
    for (const [id, q] of Object.entries(s.quests)) {
      if (q.state !== 'active') continue;
      const def = data.quests[id];
      if (!def) continue;
      if (def.failWhen && check(def.failWhen, s)) {
        q.state = 'failed';
        out.push({ type: 'questFailed', id });
        if (def.onFail) for (const e of def.onFail) applyOne(s, e, data, s.mapId, out);
        changed = true;
        continue;
      }
      const step = def.steps[q.step];
      if (!step) {
        completeQuest(s, id, data, out);
        changed = true;
        continue;
      }
      if (check(step.complete, s)) {
        q.step += 1;
        if (step.onComplete) for (const e of step.onComplete) applyOne(s, e, data, s.mapId, out);
        if (q.step >= def.steps.length) completeQuest(s, id, data, out);
        else out.push({ type: 'questStep', id, step: q.step });
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

export interface EndingScore {
  id: string;
  score: number;
  eligible: boolean;
  reasons: string[];
}

export function scoreEndings(rules: EndingRules, s: GameState): EndingScore[] {
  return rules.outcomes.map((o) => {
    let score = o.base ?? 0;
    const reasons: string[] = [];
    if (o.weights) {
      for (const [k, w] of Object.entries(o.weights)) {
        const v = s.vars[k as keyof typeof s.vars] ?? 0;
        score += v * (w ?? 0);
      }
    }
    for (const p of o.points ?? []) {
      if (check(p.when, s)) {
        score += p.points;
        reasons.push(p.reason);
      }
    }
    const eligible = check(o.requires as Condition | undefined, s);
    return { id: o.id, score: Math.round(score * 100) / 100, eligible, reasons };
  });
}

/** Deterministic: highest score among eligible outcomes, ties resolved by tieBreak order. */
export function evaluateEnding(rules: EndingRules, s: GameState): EndingScore {
  const scores = scoreEndings(rules, s);
  const eligible = scores.filter((x) => x.eligible);
  const pool = eligible.length ? eligible : scores;
  pool.sort((a, b) => b.score - a.score || rules.tieBreak.indexOf(a.id) - rules.tieBreak.indexOf(b.id));
  return pool[0];
}

export function endingVariations(rules: EndingRules, s: GameState): string[] {
  return (rules.variations ?? []).filter((v) => check(v.when, s)).map((v) => v.text);
}

export function startArc2(s: GameState, data: RuleData): void {
  const ending = s.arc1Ending ?? 'exile';
  s.arc = 2;
  s.mapId = 'shack_exterior';
  s.party = ['dipper', 'mabel'];
  s.character = 'dipper';
  s.pos = { x: -1, y: -1, level: 0, dir: 'south' };
  s.safe = { mapId: 'shack_exterior', x: -1, y: -1, level: 0 };
  s.hp = { dipper: s.maxHp, mabel: s.maxHp };
  s.energy = s.maxEnergy;
  // Bill's abilities stay recorded in flags, the twins start without powers
  for (const a of s.abilities) s.flags[`arc1_ability_${a}`] = true;
  s.abilities = [];
  s.inventory = {};
  s.flags[`arc1_${ending}`] = true;
  const setup = data.arc2Setup[ending];
  const out: Signal[] = [];
  for (const e of setup.effects) applyOne(s, e, data, s.mapId, out);
  addJournal(s, `arc2_intro_${ending}`, setup.journal);
}
