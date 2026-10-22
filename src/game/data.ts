// Central registry of JSON game data, bundled by Vite (works offline and inside the APK).
import abilitiesJson from '../data/abilities.json';
import charactersJson from '../data/characters.json';
import enemiesJson from '../data/enemies.json';
import endingsJson from '../data/endings.json';
import itemsJson from '../data/items.json';
import journalJson from '../data/journal.json';
import propsJson from '../data/props.json';
import questsJson from '../data/quests.json';
import type { RuleData } from '../core/rules';
import type { AbilityDef, DialogueDef, EndingRules, ItemDef, MapDef, QuestDef } from '../core/types';

const mapModules = import.meta.glob('../data/maps/*.json', { eager: true, import: 'default' });
const dialogueModules = import.meta.glob('../data/dialogues/*.json', { eager: true, import: 'default' });

export const MAPS: Record<string, MapDef> = {};
for (const m of Object.values(mapModules) as MapDef[]) MAPS[m.id] = m;

export const DIALOGUES: Record<string, DialogueDef> = {};
for (const file of Object.values(dialogueModules) as DialogueDef[][]) for (const d of file) DIALOGUES[d.id] = d;

export interface SheetRef { sheet: string; row: number; facing: 'south' | 'west' | 'east' | 'north' }
export interface CharacterDef {
  name: string;
  playable?: boolean;
  provisional?: boolean;
  walkSpeed?: number;
  runSpeed?: number;
  walk?: string;
  run?: string;
  ability?: string;
  idle?: SheetRef;
  hurt?: SheetRef;
  jump?: SheetRef;
  dodge?: SheetRef;
  climb?: SheetRef;
  swim?: SheetRef;
  single?: SheetRef;
}
export const CHARACTERS = Object.fromEntries(Object.entries(charactersJson).filter(([k]) => !k.startsWith('_'))) as Record<string, CharacterDef>;

export interface AttackDef {
  id: string;
  shape: 'circle' | 'projectile' | 'lines' | 'dash';
  radius?: number; offset?: number; width?: number; length?: number; count?: number;
  windup: number; active: number; recover: number; damage: number; range: number; cooldown: number;
  speed?: number; atTarget?: boolean; spread?: number; radial?: number; detain?: boolean;
}
export interface EnemyType {
  name: string;
  behavior: 'brute' | 'caster' | 'guardian' | 'lock' | 'lunger' | 'warden' | 'turret' | 'boss';
  hp: number; speed: number; aggro: number; keepAway?: number;
  body: [number, number]; hurt: [number, number];
  move: { sheet: string; dirs?: boolean; row?: number };
  attack: { sheet: string; dirs?: boolean; row?: number };
  attacks: AttackDef[];
  shield?: { frontArc: number; openAfterPattern: number };
  lockCycle?: { closed: number; open: number };
  phases?: { hpAbove: number; attacks: string[] }[];
  opportunity?: number;
  negotiate?: unknown;
  calm?: unknown;
}
export const ENEMIES = Object.fromEntries(Object.entries(enemiesJson).filter(([k]) => !k.startsWith('_'))) as Record<string, EnemyType>;

export interface PropInfo { foot?: [number, number]; jump?: boolean; fade?: boolean; flat?: boolean; div?: number }
export const PROPS = Object.fromEntries(Object.entries(propsJson).filter(([k]) => !k.startsWith('_'))) as Record<string, PropInfo>;

export const ITEMS = itemsJson as Record<string, ItemDef>;
export const ABILITIES = abilitiesJson as Record<string, AbilityDef>;
export const QUESTS: Record<string, QuestDef> = Object.fromEntries((questsJson as QuestDef[]).map((q) => [q.id, q]));

export const RULES: RuleData = {
  quests: QUESTS,
  endings: endingsJson.endings as unknown as { arc1: EndingRules; arc2: EndingRules },
  arc2Setup: endingsJson.arc2Setup as unknown as RuleData['arc2Setup'],
  journal: journalJson as Record<string, string>,
  items: ITEMS,
};
