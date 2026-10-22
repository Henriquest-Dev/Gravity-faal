import Phaser from 'phaser';
import { check } from '../../core/conditions';
import { Grid, TILE } from '../../core/grid';
import { applyVariants, buildingRects, footRect } from '../../core/mapgeom';
import type { GameState } from '../../core/state';
import { objKey } from '../../core/state';
import type { BuildingDef, ExitDef, InteractableDef, MapDef, TriggerDef } from '../../core/types';
import { missingAssets, propKey } from '../assets';
import { PROPS } from '../data';
import { bakeBuilding } from './BuildingRenderer';
import { TerrainRenderer } from './TerrainRenderer';

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
  plate: 'temporal/pad', rift: 'rifts/ground_rift', grapple: '@anchor', switch: '@lever_off', save: '@save',
};

export class MapBuilder {
  constructor(private scene: Phaser.Scene, private state: GameState) {}

  build(def: MapDef): BuiltMap {
    const s = this.state;
    const grid = new Grid(applyVariants(def, s));
    const out: BuiltMap = { def, grid, fades: [], objects: new Map(), exits: [], triggers: [], buildings: [], glints: [], destroyables: [] };
    const terrainKey = new TerrainRenderer(this.scene, grid, def.theme).bake(`terrain:${def.id}`);
    const terrain = this.scene.add.image(0, 0, terrainKey).setOrigin(0, 0).setDepth(DEPTH.terrain);
    out.destroyables.push(terrain);

    this.bridges(grid, out);

    for (const b of def.buildings ?? []) {
      if (!check(b.if, s, def.id)) continue;
      const baked = bakeBuilding(this.scene, b, `building:${def.id}:${b.id}`);
      const baseY = (b.y + b.h) * TILE;
      const img = this.scene.add.image(b.x * TILE - 6, baseY, baked.key).setOrigin(0, 1).setDepth(baseY);
      out.buildings.push({ def: b, img });
      out.destroyables.push(img);
      out.fades.push({ img, baseY, bounds: new Phaser.Geom.Rectangle(img.x, baseY - baked.h, baked.w, baked.h), alpha: 1 });
      for (const r of buildingRects(b)) grid.addRect(r);
    }

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
        img.setDepth(DEPTH.ground + py);
        return;
      }
      img.setDepth(py);
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
    this.exitMarkers(grid, out);
    this.waterGlints(grid, out);
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
    if (d.kind === 'examine' && !propId) {
      overlay = this.scene.add.image(x, y - 10, 'clue').setDepth(y);
      out.destroyables.push(overlay);
    }
    if (d.kind === 'ring') {
      overlay = this.scene.add.image(x, y - 18, `sym${state}`).setDepth(y + 1);
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
      o.sprite.clearTint();
      if (def.kind === 'chest' && state === 'open') o.sprite.setTint(0x8a7a6a);
      if (def.kind === 'repair' && state === 'broken') o.sprite.setTint(0x6a6a7a);
      if (def.kind === 'glyph' && state === 'active') o.sprite.setTint(0xffe27a);
      if (def.kind === 'plate' && state === 'down') o.sprite.setTint(0x9dffb0);
      if (def.kind === 'rift' && state === 'open') o.sprite.setTint(0xc8a0ff);
      if (def.kind === 'switch') o.sprite.setTexture(state === 'on' ? 'lever_on' : 'lever_off');
      if (def.kind === 'door') {
        o.sprite.setAlpha(state === 'open' ? 0.25 : 1);
      }
    }
    if (o.overlay) {
      o.overlay.setVisible(visible && !(def.kind === 'examine' && state === 'read'));
      if (def.kind === 'ring') o.overlay.setTexture(`sym${state}`);
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

  private exitMarkers(grid: Grid, out: BuiltMap): void {
    for (const e of out.exits) {
      if (e.kind === 'door' || !check(e.if, this.state, out.def.id)) continue;
      const cx = (e.x + e.w / 2) * TILE, cy = (e.y + e.h / 2) * TILE;
      let dir = 0;
      if (e.x + e.w >= grid.w) dir = 0;
      else if (e.x <= 0) dir = 180;
      else if (e.y <= 0) dir = -90;
      else if (e.y + e.h >= grid.h) dir = 90;
      else dir = -90;
      const m = this.scene.add.image(cx, cy, 'chevron').setDepth(DEPTH.markers).setAngle(dir).setAlpha(0.6);
      this.scene.tweens.add({ targets: m, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });
      out.destroyables.push(m);
    }
  }

  private waterGlints(grid: Grid, out: BuiltMap): void {
    let n = 0;
    for (let y = 0; y < grid.h && n < 36; y++) {
      for (let x = 0; x < grid.w && n < 36; x++) {
        const t = grid.tile(x, y);
        if (!t.water || ((x * 7 + y * 13) % 11) !== 0) continue;
        const g = this.scene.add.image(x * TILE + 8 + ((x * 5) % 16), y * TILE + 8 + ((y * 3) % 14), 'glint').setDepth(DEPTH.ground).setAlpha(0);
        this.scene.tweens.add({ targets: g, alpha: 0.9, duration: 700, yoyo: true, repeat: -1, delay: ((x * 131 + y * 71) % 2000), repeatDelay: 1200 + ((x * 37) % 1500) });
        out.glints.push(g);
        out.destroyables.push(g);
        n++;
      }
    }
  }
}
