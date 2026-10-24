import type { Arc1Ending, Arc2Ending, Dir, EventList, QuestState, VarName } from './types';
import { EVENT_LISTS } from './types';

export interface QuestProgress {
  state: QuestState;
  step: number;
}

export interface JournalEntry {
  id: string;
  text: string;
  at: number; // play time in seconds
}

export interface GameState {
  version: number;
  arc: 1 | 2;
  mapId: string;
  character: string;
  party: string[];
  pos: { x: number; y: number; level: number; dir: Dir };
  safe: { mapId: string; x: number; y: number; level: number };
  hp: Record<string, number>;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  abilities: string[];
  selectedAbility: Record<string, string>;
  inventory: Record<string, number>;
  flags: Record<string, boolean>;
  vars: Record<VarName, number>;
  events: Record<EventList, string[]>;
  quests: Record<string, QuestProgress>;
  objects: Record<string, string>; // "mapId/objectId" -> state
  objectPos: Record<string, { x: number; y: number }>; // pushed blocks
  npcs: Record<string, string>;
  defeated: string[];
  visited: string[];
  explored: Record<string, number[]>; // mapId -> explored chunk indices
  journal: JournalEntry[];
  arc1Ending: Arc1Ending | null;
  arc2Ending: Arc2Ending | null;
  playTime: number;
  deaths: number;
  /** minutes of the day (see daytime.ts) */
  clock: number;
}

export const SAVE_VERSION = 4;

export function createState(arc: 1 | 2 = 1): GameState {
  const events = {} as Record<EventList, string[]>;
  for (const k of EVENT_LISTS) events[k] = [];
  const s: GameState = {
    version: SAVE_VERSION,
    arc,
    mapId: arc === 1 ? 'euclydia_plaza' : 'shack_exterior',
    character: arc === 1 ? 'bill_child' : 'dipper',
    party: arc === 1 ? ['bill_child'] : ['dipper', 'mabel'],
    pos: { x: -1, y: -1, level: 0, dir: 'south' },
    safe: { mapId: arc === 1 ? 'euclydia_plaza' : 'shack_exterior', x: -1, y: -1, level: 0 },
    hp: {},
    maxHp: 6,
    energy: 10,
    maxEnergy: 10,
    abilities: [],
    selectedAbility: {},
    inventory: {},
    flags: {},
    vars: { empathy: 0, ambition: 0, trust: 0, reality: 10, timeDebt: 0 },
    events,
    quests: {},
    objects: {},
    objectPos: {},
    npcs: {},
    defeated: [],
    visited: [],
    explored: {},
    journal: [],
    arc1Ending: null,
    arc2Ending: null,
    playTime: 0,
    deaths: 0,
    // Euclydia's story opens in the morning sun; the twins arrive at dusk
    clock: arc === 1 ? 600 : 1140,
  };
  for (const c of s.party) s.hp[c] = s.maxHp;
  return s;
}

export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}

export function objKey(mapId: string, id: string): string {
  return `${mapId}/${id}`;
}

export function addItem(s: GameState, id: string, n = 1): void {
  s.inventory[id] = (s.inventory[id] ?? 0) + n;
}

export function removeItem(s: GameState, id: string, n = 1): boolean {
  const have = s.inventory[id] ?? 0;
  if (have < n) return false;
  const left = have - n;
  if (left <= 0) delete s.inventory[id];
  else s.inventory[id] = left;
  return true;
}

export function record(s: GameState, list: EventList, value: string): void {
  if (!s.events[list].includes(value)) s.events[list].push(value);
}

export function addJournal(s: GameState, id: string, text: string): boolean {
  if (s.journal.some((j) => j.id === id)) return false;
  s.journal.push({ id, text, at: Math.round(s.playTime) });
  return true;
}
