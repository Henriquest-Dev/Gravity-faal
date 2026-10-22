import Phaser from 'phaser';
import type { Dir } from '../core/types';
import { CHARACTERS, ENEMIES, MAPS, PROPS, type SheetRef } from './data';

export const ASSET_ROOT = 'assets/';

interface RowMetric { visible: { x: number; y: number; w: number; h: number }; pivot: { x: number; y: number } }
export interface SheetMeta {
  file: string; cell: number; cols: number; rows: number; rowNames: string[]; rowKind: string;
  fps: number; loop: boolean | null; loopByRow?: Record<string, boolean>; perspective?: string | null;
  metrics: (RowMetric | null)[];
}
export interface Manifest {
  characters: Record<string, Record<string, SheetMeta>>;
  sheets: Record<string, SheetMeta>;
  props: Record<string, { file: string; w: number; h: number; variants?: Record<string, { file: string; w: number; h: number }> }>;
  textures: Record<string, { file: string }>;
  environments: Record<string, { file: string; arc: number }>;
  references: Record<string, { file: string }>;
}

let manifest: Manifest | null = null;
export const missingAssets: string[] = [];

export function setManifest(m: Manifest): void {
  manifest = m;
}
export function getManifest(): Manifest {
  if (!manifest) throw new Error('Manifest not loaded');
  return manifest;
}

/** Texture key of a sheet path like "characters/dipper/walk" or "protag_idle". */
export function sheetKey(path: string): string {
  return `sheet:${path}`;
}
export function propKey(id: string): string {
  return `prop:${id}`;
}
export function texKey(id: string): string {
  return `tex:${id}`;
}

export function sheetMeta(path: string): SheetMeta {
  const m = getManifest();
  if (path.startsWith('characters/')) {
    const [, id, kind] = path.split('/');
    const meta = m.characters[id]?.[kind];
    if (!meta) throw new Error(`Missing sheet ${path} in manifest`);
    return meta;
  }
  const meta = m.sheets[path];
  if (!meta) throw new Error(`Missing sheet ${path} in manifest`);
  return meta;
}

function queueSheet(load: Phaser.Loader.LoaderPlugin, textures: Phaser.Textures.TextureManager, path: string): void {
  const key = sheetKey(path);
  if (textures.exists(key)) return;
  const meta = sheetMeta(path);
  load.spritesheet(key, ASSET_ROOT + meta.file, { frameWidth: meta.cell, frameHeight: meta.cell });
}

/** Sheets every scene may need: playable characters, shared state sheets, effects. */
export function queueGlobal(scene: Phaser.Scene): void {
  const m = getManifest();
  for (const [id, kinds] of Object.entries(m.characters)) {
    if (!CHARACTERS[id]?.playable && id !== 'bill') continue;
    for (const kind of Object.keys(kinds)) queueSheet(scene.load, scene.textures, `characters/${id}/${kind}`);
  }
  for (const s of ['protag_idle', 'protag_hurt', 'protag_jump', 'protag_dodge', 'protag_climb', 'protag_swim', 'effects']) {
    queueSheet(scene.load, scene.textures, s);
  }
  for (const [id, t] of Object.entries(m.textures)) {
    if (!scene.textures.exists(texKey(id))) scene.load.image(texKey(id), ASSET_ROOT + t.file);
  }
  // props used as item icons or interactables everywhere
  for (const p of ['nature/lamp_post', 'interiors/crate', 'nature/bench', 'interiors/door']) queueProp(scene, p);
}

export function queueProp(scene: Phaser.Scene, id: string): void {
  const key = propKey(id);
  if (scene.textures.exists(key)) return;
  const meta = getManifest().props[id];
  if (!meta) {
    missingAssets.push(`prop ${id} (sem entrada no manifest)`);
    return;
  }
  const div = PROPS[id]?.div ?? 1;
  const file = div > 1 ? meta.variants?.[String(div)]?.file : meta.file;
  if (!file) {
    missingAssets.push(`prop ${id} variante 1/${div}`);
    return;
  }
  scene.load.image(key, ASSET_ROOT + file);
}

/** Everything a map needs beyond the global set. Returns the list of keys for unloading later. */
export function queueMap(scene: Phaser.Scene, mapId: string): string[] {
  const map = MAPS[mapId];
  const keys: string[] = [];
  const props = new Set<string>();
  for (const p of map.props ?? []) props.add(p.prop);
  for (const i of map.interactables ?? []) if (i.prop) props.add(i.prop);
  for (const p of props) {
    queueProp(scene, p);
    keys.push(propKey(p));
  }
  const sheets = new Set<string>();
  for (const n of map.npcs ?? []) for (const s of characterSheets(n.character)) sheets.add(s);
  for (const e of map.enemies ?? []) {
    const t = ENEMIES[e.type];
    if (!t) continue;
    sheets.add(t.move.sheet);
    sheets.add(t.attack.sheet);
  }
  for (const s of sheets) {
    queueSheet(scene.load, scene.textures, s);
    keys.push(sheetKey(s));
  }
  const env = map.reference ? getManifest().environments[map.reference] : null;
  if (env && !scene.textures.exists(`env:${map.reference}`)) scene.load.image(`env:${map.reference}`, ASSET_ROOT + env.file);
  return keys;
}

export function characterSheets(id: string): string[] {
  const c = CHARACTERS[id];
  if (!c) return [];
  const out: string[] = [];
  for (const k of ['walk', 'run', 'ability'] as const) if (c[k]) out.push(c[k]!);
  for (const k of ['idle', 'hurt', 'jump', 'dodge', 'climb', 'swim', 'single'] as const) if (c[k]) out.push(c[k]!.sheet);
  return out;
}

// ---------------------------------------------------------------- animations
/** Animation key naming: `${char}:${state}:${dir}` for dir sheets, `${char}:${state}` for single rows. */
export function animKey(char: string, state: string, dir?: Dir): string {
  return dir ? `${char}:${state}:${dir}` : `${char}:${state}`;
}

function ensureAnim(scene: Phaser.Scene, key: string, sheet: string, row: number, fps: number, repeat: number, frames?: number[]): void {
  if (scene.anims.exists(key)) return;
  const tex = sheetKey(sheet);
  if (!scene.textures.exists(tex)) return;
  const meta = sheetMeta(sheet);
  const list = (frames ?? [0, 1, 2, 3, 4, 5, 6, 7]).map((f) => ({ key: tex, frame: row * meta.cols + f }));
  scene.anims.create({ key, frames: list, frameRate: fps, repeat });
}

function rowLoops(meta: SheetMeta, row: number): boolean {
  if (meta.loopByRow) return !!meta.loopByRow[meta.rowNames[row]];
  return meta.loop !== false;
}

/** Creates (idempotently) every animation for a character whose sheets are loaded. */
export function buildCharacterAnims(scene: Phaser.Scene, id: string): void {
  const c = CHARACTERS[id];
  if (!c) return;
  const dirs: Dir[] = ['south', 'west', 'east', 'north'];
  for (const kind of ['walk', 'run', 'ability'] as const) {
    const path = c[kind];
    if (!path || !scene.textures.exists(sheetKey(path))) continue;
    const meta = sheetMeta(path);
    dirs.forEach((d, row) => {
      ensureAnim(scene, animKey(id, kind, d), path, row, meta.fps, kind === 'ability' ? 0 : -1);
      // idle per direction: first walk frame held (contact pose)
      if (kind === 'walk') ensureAnim(scene, animKey(id, 'stand', d), path, row, 1, -1, [0]);
    });
  }
  for (const kind of ['idle', 'hurt', 'jump', 'dodge', 'climb', 'swim', 'single'] as const) {
    const ref = c[kind] as SheetRef | undefined;
    if (!ref || !scene.textures.exists(sheetKey(ref.sheet))) continue;
    const meta = sheetMeta(ref.sheet);
    const repeat = kind === 'idle' || kind === 'climb' || kind === 'swim' || kind === 'single' ? -1 : 0;
    ensureAnim(scene, animKey(id, kind), ref.sheet, ref.row, kind === 'idle' ? 5 : meta.fps, repeat);
  }
}

export function buildEnemyAnims(scene: Phaser.Scene, type: string): void {
  const t = ENEMIES[type];
  if (!t) return;
  for (const [state, src] of [['move', t.move], ['attack', t.attack]] as const) {
    if (!scene.textures.exists(sheetKey(src.sheet))) continue;
    const meta = sheetMeta(src.sheet);
    if (src.dirs) {
      (['south', 'west', 'east', 'north'] as Dir[]).forEach((d, row) =>
        ensureAnim(scene, animKey(type, state, d), src.sheet, row, meta.fps, state === 'move' ? -1 : 0));
    } else {
      ensureAnim(scene, animKey(type, state), src.sheet, src.row ?? 0, meta.fps, state === 'move' ? -1 : 0);
    }
  }
  if (type === 'time_baby') {
    const meta = sheetMeta('time_baby');
    meta.rowNames.forEach((name, row) => ensureAnim(scene, `time_baby:${name}`, 'time_baby', row, 8, rowLoops(meta, row) ? -1 : 0));
  }
}

export function buildEffectAnims(scene: Phaser.Scene): void {
  const meta = sheetMeta('effects');
  meta.rowNames.forEach((name, row) => ensureAnim(scene, `fx:${name}`, 'effects', row, name === 'run_dust' ? 18 : 16, 0));
}

/** Pivot (feet) for a sheet in cell pixels, from the manifest metrics. */
export function sheetPivot(path: string): { x: number; y: number; cell: number } {
  const meta = sheetMeta(path);
  const m = meta.metrics.find((r) => r) ?? null;
  return { x: m?.pivot.x ?? meta.cell / 2, y: m?.pivot.y ?? meta.cell, cell: meta.cell };
}

export function propInfo(id: string) {
  return PROPS[id] ?? {};
}

/** Remove per-area textures not needed by the next map (keeps globals). */
export function unloadUnused(scene: Phaser.Scene, previous: string[], next: string[]): void {
  const keep = new Set(next);
  for (const k of previous) {
    if (keep.has(k)) continue;
    if (k.startsWith('sheet:') && (k.includes('characters/dipper') || k.includes('characters/mabel') || k.includes('protag_') || k.includes('characters/bill'))) continue;
    if (!scene.textures.exists(k)) continue;
    // animations referencing the texture must go first
    const anims = (scene.anims as unknown as { anims: Phaser.Structs.Map<string, Phaser.Animations.Animation> }).anims;
    for (const a of anims.values()) if (a.frames.some((f) => f.textureKey === k)) scene.anims.remove(a.key);
    scene.textures.remove(k);
  }
}
