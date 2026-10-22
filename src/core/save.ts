import type { GameState } from './state';
import { SAVE_VERSION, createState } from './state';
import { EVENT_LISTS, VAR_NAMES } from './types';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveFile {
  format: 'gravity-falls-save';
  version: number;
  savedAt: string;
  checksum: string;
  summary: { arc: number; mapName: string; character: string; playTime: number };
  state: GameState;
}

export const SLOT_COUNT = 3;
const PREFIX = 'gf.save.slot';

export class SaveError extends Error {}

/** FNV-1a 32-bit; detects truncated or hand-edited files, not tampering. */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function serialize(state: GameState, mapName: string): SaveFile {
  const body = JSON.stringify(state);
  return {
    format: 'gravity-falls-save',
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    checksum: checksum(body),
    summary: { arc: state.arc, mapName, character: state.character, playTime: Math.round(state.playTime) },
    state: JSON.parse(body) as GameState,
  };
}

type Migration = (s: Record<string, unknown>) => void;
// index = version being migrated FROM
const MIGRATIONS: Record<number, Migration> = {
  1: (s) => {
    if (!('objectPos' in s)) s.objectPos = {};
    s.version = 2;
  },
  2: (s) => {
    if (!('explored' in s)) s.explored = {};
    if (!('selectedAbility' in s)) s.selectedAbility = {};
    s.version = 3;
  },
};

export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let v = typeof raw.version === 'number' ? raw.version : 1;
  if (v > SAVE_VERSION) throw new SaveError(`Gravação de uma versão mais recente (${v}).`);
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new SaveError(`Sem migração a partir da versão ${v}.`);
    m(raw);
    v = raw.version as number;
  }
  return raw;
}

/** Validates shape and fills missing optional fields from defaults. Throws SaveError. */
export function validateState(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') throw new SaveError('Estado inválido.');
  const s = migrate({ ...(raw as Record<string, unknown>) });
  const base = createState((s.arc as 1 | 2) ?? 1) as unknown as Record<string, unknown>;
  const need = (k: string, type: string) => {
    const t = Array.isArray(s[k]) ? 'array' : typeof s[k];
    if (t !== type) throw new SaveError(`Campo "${k}" inválido (${t}).`);
  };
  need('arc', 'number');
  if (s.arc !== 1 && s.arc !== 2) throw new SaveError('Arco inválido.');
  need('mapId', 'string');
  need('character', 'string');
  need('party', 'array');
  need('pos', 'object');
  need('flags', 'object');
  need('vars', 'object');
  need('quests', 'object');
  need('inventory', 'object');
  need('abilities', 'array');
  const vars = s.vars as Record<string, unknown>;
  for (const v of VAR_NAMES) if (typeof vars[v] !== 'number' || !Number.isFinite(vars[v])) vars[v] = (base.vars as Record<string, number>)[v];
  const events = (s.events ?? {}) as Record<string, unknown>;
  for (const e of EVENT_LISTS) if (!Array.isArray(events[e])) events[e] = [];
  s.events = events;
  for (const [k, v] of Object.entries(base)) if (s[k] === undefined) s[k] = v;
  const pos = s.pos as Record<string, unknown>;
  for (const k of ['x', 'y', 'level']) if (typeof pos[k] !== 'number' || !Number.isFinite(pos[k])) pos[k] = -1;
  const party = s.party as string[];
  if (!party.length || !party.every((p) => typeof p === 'string')) throw new SaveError('Grupo inválido.');
  if (!party.includes(s.character as string)) s.character = party[0];
  return s as unknown as GameState;
}

export function parseSave(text: string): SaveFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError('O ficheiro não é JSON válido.');
  }
  const f = raw as Partial<SaveFile>;
  if (f?.format !== 'gravity-falls-save') throw new SaveError('Formato de gravação desconhecido.');
  if (!f.state) throw new SaveError('Gravação sem estado.');
  // checksum is computed on the state as written by its own version
  if (f.checksum && f.checksum !== checksum(JSON.stringify(f.state))) throw new SaveError('Gravação corrompida (checksum).');
  const state = validateState(f.state);
  return { ...(f as SaveFile), version: SAVE_VERSION, state };
}

export class SaveStore {
  constructor(private readonly storage: StorageLike) {}

  key(slot: number): string {
    return `${PREFIX}${slot}`;
  }

  read(slot: number): SaveFile | null {
    const text = this.storage.getItem(this.key(slot));
    if (!text) return null;
    return parseSave(text);
  }

  /** Never throws: corrupt slots are reported as errors in the list. */
  list(): ({ slot: number; file: SaveFile | null; error?: string })[] {
    const out = [];
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      try {
        out.push({ slot, file: this.read(slot) });
      } catch (e) {
        out.push({ slot, file: null, error: (e as Error).message });
      }
    }
    return out;
  }

  write(slot: number, state: GameState, mapName: string): SaveFile {
    const file = serialize(state, mapName);
    this.storage.setItem(this.key(slot), JSON.stringify(file));
    return file;
  }

  remove(slot: number): void {
    this.storage.removeItem(this.key(slot));
  }

  exportText(slot: number): string {
    const text = this.storage.getItem(this.key(slot));
    if (!text) throw new SaveError('Ranhura vazia.');
    parseSave(text);
    return text;
  }

  importText(slot: number, text: string): SaveFile {
    const file = parseSave(text);
    this.storage.setItem(this.key(slot), JSON.stringify(file));
    return file;
  }
}
