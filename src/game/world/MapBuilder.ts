import Phaser from 'phaser';
import { check } from '../../core/conditions';
import { Grid, TILE } from '../../core/grid';
import { applyVariants, buildingRects, footRect } from '../../core/mapgeom';
import type { GameState } from '../../core/state';
import { objKey } from '../../core/state';
import type { BuildingDef, ExitDef, InteractableDef, MapDef, TriggerDef } from '../../core/types';
import { missingAssets, propKey } from '../assets';
import { PROPS } from '../data';
import { bakeBuilding, bakeShack } from './BuildingRenderer';
import { TerrainRenderer, THEMES } from './TerrainRenderer';

export const DEPTH = {
  terrain: -100000,
  ground: -90000, // flat props, plates, rugs
  markers: -80000,
  foreground: 1000000,
  overlay: 2000000,
};

export interface FadeProp {
  img: Phaser.GameObjects.Image;
  baseY: number;
  bounds: Phaser.Geom.Rectangle;
  alpha: number;
}

export interface IObj {
  def: InteractableDef;
  key: string;
  x: number; // feet / pivot in px
  y: number;
  sprite: Phaser.GameObjects.Image | null;
  overlay: Phaser.GameObjects.Image | null;
  solidId: string | null;
  state: string;
  revealed: boolean;
}

export interface BuiltMap {
  def: MapDef;
  grid: Grid;
  fades: FadeProp[];
  objects: Map<string, IObj>;
  exits: ExitDef[];
  triggers: TriggerDef[];
  buildings: { def: BuildingDef; img: Phaser.GameObjects.Image }[];
  glints: Phaser.GameObjects.Image[];
  destroyables: Phaser.GameObjects.GameObject[];
}

export const DEFAULT_STATE: Partial<Record<InteractableDef['kind'], string>> = {
  door: 'closed', chest: 'closed', pickup: 'present', switch: 'off', repair: 'broken', ring: '0',
  glyph: 'inactive', rift: 'closed', sequence: 'idle', push: 'idle', portal: 'closed', plate: 'up',
};

export const DEFAULT_PROP: Partial<Record<InteractableDef['kind'], string>> = {
  chest: 'interiors/crate', push: 'interiors/crate', glyph: 'rifts/sigil_plate', ring: 'rifts/ring',
  plate: 'temporal/pad', rift: 'rifts/ground_rift', grapple: 'nature/lamp_post', switch: 'interiors/control_console',
};
/** Ring puzzle symbols are catalogue pieces: triangle, eye, spiral, square. */
export const RING_SYMBOLS = ['rifts/triangle_platform', 'rifts/eye_sigil', 'rifts/spiral_stone', 'rifts/square_platform'];

/** Grade tint of the area being shown (props and interactables). */
let currentGrade = 0xffffff;

export class MapBuilder {
  constructor(private scene: Phaser.Scene, private state: GameState) {}

  build(def: MapDef): BuiltMap {
    const s = this.state;
    const grid = new Grid(applyVariants(def, s));
    const out: BuiltMap = { def, grid, fades: [], objects: new Map(), exits: [], triggers: [], buildings: [], glints: [], destroyables: [] };
    const terrainKey = new TerrainRenderer(this.scene, grid, def.theme, def.ambient?.grade).bake(`terrain:${def.id}`);
    const terrain = this.scene.add.image(0, 0, terrainKey).setOrigin(0, 0).setDepth(DEPTH.terrain);
    out.destroyables.push(terrain);

    this.bridges(grid, out);

    for (const b of def.buildings ?? []) {
      if (!check(b.if, s, def.id)) continue;
      const baked = (b.style === 'shack' ? bakeShack : bakeBuilding)(this.scene, b, `building:${def.id}:${b.id}`);
      const baseY = (b.y + b.h) * TILE;
      const img = this.scene.add.image(b.x * TILE - 6, baseY, baked.key).setOrigin(0, 1).setDepth(baseY);
      out.buildings.push({ def: b, img });
      out.destroyables.push(img);
      out.fades.push({ img, baseY, bounds: new Phaser.Geom.Rectangle(img.x, baseY - baked.h, baked.w, baked.h), alpha: 1 });
      for (const r of buildingRects(b)) grid.addRect(r);
    }

    // props share the terrain's colour grade (multiply), characters stay untouched for readability
    const gradeHex = def.ambient?.grade?.mul ?? THEMES[def.theme]?.grade.mul;
    const grade = gradeHex ? Phaser.Display.Color.HexStringToColor(gradeHex).color : 0;
    currentGrade = grade || 0xffffff;
    for (const b of out.buildings) if (grade) b.img.setTint(grade);
    (def.props ?? []).forEach((p, i) => {
      if (!check(p.if, s, def.id)) return;
      const px = p.x * TILE, py = p.y * TILE;
      const img = this.propImage(p.prop, px, py);
      const scale = p.scale ?? 1;
      img.setScale(scale).setFlipX(!!p.flip);
      out.destroyables.push(img);
      const info = PROPS[p.prop] ?? {};
      if (p.layer === 'foreground') {
        img.setDepth(DEPTH.foreground + py).setTint(0x1b2a22);
        out.fades.push({ img, baseY: Infinity, bounds: img.getBounds(), alpha: 1 });
        return;
      }
      if (info.flat || p.layer === 'ground') {
        if (grade) img.setTint(grade);
        img.setDepth(DEPTH.ground + py);
        return;
      }
      img.setDepth(py);
      if (grade) img.setTint(grade);
      const foot = p.solid === false ? null : footRect(p.prop, px, py, scale);
      if (foot) grid.addRect({ id: `prop:${p.id ?? i}`, ...foot, jumpable: !!info.jump });
      if (info.fade) out.fades.push({ img, baseY: py, bounds: img.getBounds(), alpha: 1 });
    });

    for (const d of def.interactables ?? []) {
      if (!check(d.if, s, def.id)) continue;
      out.objects.set(d.id, this.createObject(def, d, grid, out));
    }
    out.exits = def.exits;
    out.triggers = def.triggers ?? [];

    return out;
  }

  propImage(prop: string, x: number, y: number): Phaser.GameObjects.Image {
    let key = prop.startsWith('@') ? prop.slice(1) : propKey(prop);
    if (!this.scene.textures.exists(key)) {
      // development placeholder: clearly marked so it is never mistaken for final art
      missingAssets.push(`textura ${key}`);
      key = 'missing';
    }
    return this.scene.add.image(x, y, key).setOrigin(0.5, 1);
  }

  createObject(def: MapDef, d: InteractableDef, grid: Grid, out: BuiltMap): IObj {
    const s = this.state;
    const key = objKey(def.id, d.id);
    const stored = s.objects[key];
    const pos = s.objectPos[key];
    const x = (pos?.x ?? d.x) * TILE, y = (pos?.y ?? d.y) * TILE;
    const state = stored ?? DEFAULT_STATE[d.kind] ?? 'idle';
    const propId = d.prop ?? DEFAULT_PROP[d.kind];
    let sprite: Phaser.GameObjects.Image | null = null;
    if (propId) {
      sprite = this.propImage(propId, x, y);
      const info = PROPS[propId] ?? {};
      sprite.setDepth(info.flat || d.kind === 'plate' || d.kind === 'glyph' ? DEPTH.ground + y : y);
      out.destroyables.push(sprite);
    }
    let overlay: Phaser.GameObjects.Image | null = null;
    if (d.kind === 'ring') {
      overlay = this.scene.add.image(x, y - 34, `sym:${state}`).setDepth(y + 1).setOrigin(0.5, 1);
      this.scene.tweens.add({ targets: overlay, y: y - 38, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      out.destroyables.push(overlay);
    }
    const o: IObj = { def: d, key, x, y, sprite, overlay, solidId: null, state, revealed: !d.hidden || !!s.flags[`revealed:${key}`] };
    if (d.kind === 'push' && state === 'filled') {
      // a block pushed into a void becomes floor
      grid.setCode(Math.floor(x / TILE), Math.floor((y - 4) / TILE), 'k');
      sprite?.setDepth(DEPTH.ground + y).setTint(0x6a6070);
      this.refreshObject({ def: d, key, x, y, sprite, overlay: null, solidId: null, state, revealed: true });
      return { def: d, key, x, y, sprite, overlay: null, solidId: null, state, revealed: true };
    }
    const solid = d.solid ?? (d.kind === 'push' || (d.kind === 'door' && state !== 'open'));
    if (solid) {
      const foot = propId && !propId.startsWith('@') ? footRect(propId, x, y) : null;
      let r = d.kind === 'push' ? { x: x - 15, y: y - 22, w: 30, h: 22 } : foot ?? { x: x - 14, y: y - 12, w: 28, h: 12 };
      if (d.kind === 'door') {
        // a closed door always seals its whole tile, whatever the art's footprint
        const tx = Math.floor(x / TILE) * TILE, ty = Math.floor((y - 1) / TILE) * TILE;
        const x0 = Math.min(r.x, tx), y0 = Math.min(r.y, ty);
        r = { x: x0, y: y0, w: Math.max(r.x + r.w, tx + TILE) - x0, h: Math.max(r.y + r.h, ty + TILE) - y0 };
      }
      o.solidId = `obj:${d.id}`;
      grid.addRect({ id: o.solidId, ...r, dynamic: d.kind === 'push' });
    }
    this.refreshObject(o);
    return o;
  }

  /** Visual state of an interactable. */
  refreshObject(o: IObj): void {
    const { def, state } = o;
    const visible = o.revealed;
    if (o.sprite) {
      o.sprite.setVisible(visible && !(def.kind === 'pickup' && state === 'taken'));
      o.sprite.setTint(currentGrade);
      if (def.kind === 'chest' && state === 'open') o.sprite.setTint(0x8a7a6a);
      if (def.kind === 'repair' && state === 'broken') o.sprite.setTint(0x6a6a7a);
      if (def.kind === 'glyph' && state === 'active') o.sprite.setTint(0xffe27a);
      if (def.kind === 'plate' && state === 'down') o.sprite.setTint(0x9dffb0);
      if (def.kind === 'rift' && state === 'open') o.sprite.setTint(0xc8a0ff);
      if (def.kind === 'switch') o.sprite.setTint(state === 'on' ? 0xffffff : 0x8a8a9a);
      if (def.kind === 'door') {
        o.sprite.setAlpha(state === 'open' ? 0.25 : 1);
      }
    }
    if (o.overlay) {
      o.overlay.setVisible(visible && !(def.kind === 'examine' && state === 'read'));
      if (def.kind === 'ring') o.overlay.setTexture(`sym:${state}`);
    }
  }

  private bridges(grid: Grid, out: BuiltMap): void {
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        if (!grid.tile(x, y).bridge) continue;
        const axis = grid.bridgeAxis(x, y);
        // rails only on the outer sides of multi-tile wide bridges
        const a = axis === 'h' ? !grid.tile(x, y - 1).bridge : !grid.tile(x - 1, y).bridge;
        const b = axis === 'h' ? !grid.tile(x, y + 1).bridge : !grid.tile(x + 1, y).bridge;
        const key = `bridge_${axis}${a ? 1 : 0}${b ? 1 : 0}`;
        const img = this.scene.add.image(x * TILE, y * TILE, key).setOrigin(0, 0);
        img.setDepth((y + 1) * TILE);
        out.destroyables.push(img);
      }
    }
  }
}
