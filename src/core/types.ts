// Shared data contracts. Everything under src/data is validated against these shapes.

export type Dir = 'south' | 'west' | 'east' | 'north';
export const DIRS: Dir[] = ['south', 'west', 'east', 'north'];

export type VarName = 'empathy' | 'ambition' | 'trust' | 'reality' | 'timeDebt';
export const VAR_NAMES: VarName[] = ['empathy', 'ambition', 'trust', 'reality', 'timeDebt'];

export type EventList = 'helped' | 'promisesKept' | 'promisesBroken' | 'repaired' | 'deals' | 'portals' | 'rescued' | 'sacrificed';
export const EVENT_LISTS: EventList[] = ['helped', 'promisesKept', 'promisesBroken', 'repaired', 'deals', 'portals', 'rescued', 'sacrificed'];

export type Arc1Ending = 'repair' | 'exile' | 'ascension';
export type Arc2Ending = 'balance' | 'costly' | 'rupture';

// ---------------------------------------------------------------- conditions
export type Condition =
  | { flag: string }
  | { not: Condition }
  | { all: Condition[] }
  | { any: Condition[] }
  | { var: VarName; gte?: number; lte?: number; gt?: number; lt?: number }
  | { item: string; count?: number }
  | { quest: string; state: QuestState | QuestState[]; step?: string }
  | { ability: string }
  | { arc1: Arc1Ending | Arc1Ending[] }
  | { arc: 1 | 2 }
  | { character: string }
  | { event: EventList; value?: string; countGte?: number }
  | { object: string; state: string }
  | { npc: string; state: string }
  | { defeated: string }
  | { visited: string };

// ------------------------------------------------------------------- effects
export type Effect =
  | { setFlag: string; value?: boolean }
  | { var: VarName; add: number }
  | { give: string; count?: number }
  | { take: string; count?: number }
  | { unlock: string }
  | { questStart: string }
  | { questComplete: string }
  | { questFail: string }
  | { journal: string }
  | { record: EventList; value: string }
  | { heal: number }
  | { restoreEnergy: number }
  | { setObject: string; state: string }
  | { setNpc: string; state: string }
  | { teleport: { map: string; spawn: string } }
  | { evaluateEnding: 1 | 2 }
  | { startArc2: true }
  | { party: string[] }
  | { toast: string }
  | { cutscene: string }
  | { clock: number }
  | { checkpoint: true };

// ------------------------------------------------------------------- quests
export type QuestState = 'inactive' | 'active' | 'done' | 'failed';

export interface QuestStep {
  id: string;
  text: string;
  hint: string;
  complete: Condition;
  onComplete?: Effect[];
}

export interface QuestDef {
  id: string;
  arc: 1 | 2;
  title: string;
  summary: string;
  main: boolean;
  steps: QuestStep[];
  failWhen?: Condition;
  onFail?: Effect[];
  onDone?: Effect[];
  reward?: string;
}

// ----------------------------------------------------------------- dialogue
export interface DialogueChoice {
  text: string;
  if?: Condition;
  effects?: Effect[];
  next?: string; // node id; omitted closes dialogue
  tag?: string; // shown to the player (e.g. "Empatia")
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  /** portrait expression: neutral, happy, surprised, scared, thinking, angry, sad, smug */
  mood?: string;
  effects?: Effect[];
  choices?: DialogueChoice[];
  next?: string;
}

export interface DialogueEntry {
  // first matching entry is used when talking to the NPC
  if?: Condition;
  start: string;
  once?: string; // flag set after it was shown once
}

export interface DialogueDef {
  id: string;
  entries: DialogueEntry[];
  nodes: Record<string, DialogueNode>;
}

// --------------------------------------------------------------------- maps
export interface PropPlacement {
  id?: string;
  prop: string; // props key, e.g. "nature/pine"
  x: number; // tile units, pivot (bottom centre)
  y: number;
  scale?: number;
  flip?: boolean;
  layer?: 'world' | 'ground' | 'foreground';
  if?: Condition;
  solid?: boolean; // override catalogue footprint
}

export interface BuildingDef {
  id: string;
  x: number; y: number; w: number; h: number; // footprint in tiles (front wall row = y+h-1)
  style: 'shack' | 'cabin' | 'shop' | 'bunker' | 'workshop' | 'euclid' | 'temporal' | 'stone';
  wallHeight?: number; // tiles of facade drawn above footprint
  roofHeight?: number;
  door?: { x: number; exit?: string; locked?: string };
  windows?: number[];
  sign?: string;
  if?: Condition;
}

export interface ExitDef {
  id: string;
  x: number; y: number; w: number; h: number;
  to: string; spawn: string;
  if?: Condition; // exit exists only when true (e.g. leads elsewhere after an event)
  requires?: Condition;
  lockedText?: string;
  kind?: 'edge' | 'door' | 'portal' | 'stairs';
}

export interface SpawnDef { x: number; y: number; dir?: Dir; level?: number }

export interface NpcDef {
  id: string;
  character: string;
  x: number; y: number;
  dir?: Dir;
  dialogue: string;
  wander?: number; // radius in tiles
  if?: Condition;
}

export interface EnemyDef {
  id: string;
  type: string;
  x: number; y: number;
  if?: Condition;
  leash?: number;
  dialogue?: string; // talking (E) to it may resolve the encounter without combat
}

export type InteractKind =
  | 'examine' | 'door' | 'switch' | 'pickup' | 'chest' | 'push' | 'repair' | 'portal'
  | 'save' | 'rift' | 'grapple' | 'glyph' | 'plate' | 'ring' | 'sequence' | 'npcProxy';

export interface InteractableDef {
  id: string;
  kind: InteractKind;
  x: number; y: number;
  prop?: string;
  label?: string;
  text?: string; // examine text / locked hint
  if?: Condition; // exists only when true
  requires?: Condition; // can be used only when true
  requiresText?: string; // explains how to progress
  effects?: Effect[]; // applied on success
  offEffects?: Effect[]; // switches: applied when turned off
  onSolve?: Effect[]; // puzzle groups: applied once when the whole group is solved
  states?: string[]; // ordered states; default ["closed","open"] etc.
  hidden?: boolean; // revealed by perception / flashlight
  reveal?: 'perceive' | 'flashlight';
  pair?: string; // rift / portal partner id
  landing?: { x: number; y: number }; // grapple landing tile
  solid?: boolean;
  item?: string;
  group?: string; // puzzle group
  value?: number; // ring target, sequence order...
  facing?: boolean; // must face the target
  character?: string; // only this character can use it
}

export interface TriggerDef {
  id: string;
  x: number; y: number; w: number; h: number;
  if?: Condition;
  once?: boolean;
  effects?: Effect[];
  dialogue?: string;
  hazard?: 'fire' | 'void' | 'rift';
}

export interface MapVariant {
  when: Condition;
  patches?: { x: number; y: number; rows: string[] }[];
}

export interface MapDef {
  id: string;
  name: string;
  arc: 1 | 2;
  theme: string;
  music: string;
  width: number;
  height: number;
  reference?: string;
  ambient?: {
    tint?: string; strange?: boolean; motes?: string; darkness?: number;
    night?: number;
    /** keep the map's light regardless of the time of day */
    fixedTime?: boolean; nightColor?: string; fog?: number; fogColor?: string; vignette?: number; eyes?: number; playerLight?: number;
    grade?: { sat: number; mul: string };
    lights?: { x: number; y: number; r?: number; color?: string; intensity?: number; flicker?: number }[];
  };
  terrain: string[];
  variants?: MapVariant[];
  props?: PropPlacement[];
  buildings?: BuildingDef[];
  spawns: Record<string, SpawnDef>;
  exits: ExitDef[];
  npcs?: NpcDef[];
  enemies?: EnemyDef[];
  interactables?: InteractableDef[];
  triggers?: TriggerDef[];
  checkpoints?: { id: string; x: number; y: number }[];
  onEnter?: Effect[];
}

// -------------------------------------------------------------------- items
export interface ItemDef {
  id: string;
  name: string;
  description: string;
  key?: boolean; // indispensable, cannot be consumed
  icon?: string; // props key used as icon
  use?: Effect[];
}

export interface AbilityDef {
  id: string;
  name: string;
  owner: string; // character id
  description: string;
  energy: number;
  cooldown: number;
  range?: number;
}

export interface EndingOutcome {
  id: string;
  title: string;
  text: string;
  base?: number;
  weights?: Partial<Record<VarName, number>>;
  points?: { when: Condition; points: number; reason: string }[];
  requires?: Condition;
}

export interface EndingRules {
  arc: 1 | 2;
  outcomes: EndingOutcome[];
  tieBreak: string[];
  variations?: { when: Condition; text: string }[];
}

// --------------------------------------------------------------- cutscenes
/** Tile coordinates, or an actor reference (player, companion, npc:<id> or a spawned id). */
export type CsPoint = [number, number] | string;

export type CutsceneStep =
  | { wait: number }
  | { fade: 'out' | 'in'; ms?: number }
  | { card: string; sub?: string; lines?: string[]; ms?: number }
  | { say: string; text: string; mood?: string; as?: string }
  | { dialogue: string }
  | { camera: CsPoint; ms?: number; zoom?: number }
  | { shake: number; ms?: number }
  | { flash: string; ms?: number }
  | { spawn: string; char: string; at: [number, number]; dir?: Dir; alpha?: number }
  | { move: string; to: [number, number]; speed?: number; run?: boolean; async?: boolean }
  | { face: string; dir: Dir | string }
  | { anim: string; state: string; ms?: number }
  | { remove: string }
  | { alpha: string; to: number; ms?: number; async?: boolean }
  | { sfx: string }
  | { music: string }
  | { glow: [number, number]; r?: number; color?: string; ms?: number }
  | { effects: Effect[] }
  | { clock: number; ms?: number };

export interface CutsceneDef {
  id: string;
  /** plays only when this holds */
  if?: Condition;
  /** default true: a cutscene plays once per save (flag cs:<id>) */
  once?: boolean;
  steps: CutsceneStep[];
}
