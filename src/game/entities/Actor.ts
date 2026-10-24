import Phaser from 'phaser';
import type { Body, Grid } from '../../core/grid';
import { TILE } from '../../core/grid';
import { canEnter, type ActorStateName } from '../../core/motion';
import type { Dir } from '../../core/types';
import { animKey, sheetKey, sheetPivot } from '../assets';
import { CHARACTERS, type SheetRef } from '../data';

export const BRIDGE_DEPTH = 40; // depth offset for actors standing on a bridge deck

/**
 * Something standing on the ground: feet position + elevation (z) kept apart
 * from the drawn sprite. The shadow stays on the ground while the sprite rises.
 */
/** Catalogue rows that are talking gestures rather than idle loops. */
const GESTURE_SHEETS = /^(cast_|euclydia_adults|time_agents|protag_)/;

export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  body: Body;
  z = 0;
  vz = 0;
  dir: Dir = 'south';
  state: ActorStateName = 'idle';
  /** gesture rows (talking poses) only play while this character is speaking; otherwise it stands still */
  gesturing = false;
  stateTime = 0;
  stateDuration = 0; // 0 = until changed
  hp = 6;
  maxHp = 6;
  invuln = 0;
  speedNow = 0;
  visualOffsetY = 0;
  hurtSize: [number, number] = [26, 52];
  private currentAnim = '';
  private stepAcc = 0;

  constructor(
    readonly scene: Phaser.Scene,
    public charId: string,
    x: number, y: number,
    opts: { hw?: number; hh?: number; canSwim?: boolean; level?: number } = {},
  ) {
    this.body = { x, y, level: opts.level ?? 0, hw: opts.hw ?? 7, hh: opts.hh ?? 4, canSwim: opts.canSwim ?? false };
    this.shadow = scene.add.image(x, y, 'shadow').setOrigin(0.5, 0.5);
    this.sprite = scene.add.sprite(x, y, '__DEFAULT');
    this.setCharacter(charId);
  }

  get x(): number { return this.body.x; }
  get y(): number { return this.body.y; }
  get tileX(): number { return Math.floor(this.body.x / TILE); }
  get tileY(): number { return Math.floor((this.body.y - this.body.hh) / TILE); }

  setCharacter(id: string): void {
    this.charId = id;
    const c = CHARACTERS[id];
    const base = c?.walk ?? c?.single?.sheet ?? c?.idle?.sheet;
    if (base && this.scene.textures.exists(sheetKey(base))) {
      const p = sheetPivot(base);
      this.sprite.setTexture(sheetKey(base), 0);
      this.sprite.setOrigin(p.x / p.cell, p.y / p.cell);
    }
    this.currentAnim = '';
    this.playFor(true);
  }

  enter(next: ActorStateName, duration = 0): boolean {
    const finished = this.stateDuration > 0 && this.stateTime >= this.stateDuration;
    if (!canEnter(this.state, next, finished)) return false;
    if (this.state !== next) this.stateTime = 0;
    this.state = next;
    this.stateDuration = duration;
    return true;
  }

  /** Force a state regardless of priority (map transitions, scripted scenes, recovery). */
  force(next: ActorStateName, duration = 0): void {
    this.state = next;
    this.stateTime = 0;
    this.stateDuration = duration;
  }

  get stateFinished(): boolean {
    return this.stateDuration > 0 && this.stateTime >= this.stateDuration;
  }

  moveBy(grid: Grid, dx: number, dy: number): { blockedX: boolean; blockedY: boolean } {
    const ptx = this.tileX, pty = this.tileY;
    const r = grid.move(this.body, dx, dy);
    const moved = Math.hypot(r.x - this.body.x, r.y - this.body.y);
    this.body.x = r.x;
    this.body.y = r.y;
    this.body.level = grid.updateLevel(this.body, ptx, pty);
    this.stepAcc += moved;
    return { blockedX: r.blockedX, blockedY: r.blockedY };
  }

  /** Returns true when a footstep should sound (every ~stride px). */
  takeStep(stride: number): boolean {
    if (this.stepAcc >= stride) {
      this.stepAcc = 0;
      return true;
    }
    return false;
  }

  private sheetRef(kind: keyof typeof CHARACTERS[string]): SheetRef | undefined {
    return CHARACTERS[this.charId]?.[kind] as SheetRef | undefined;
  }

  /** Picks the animation for the current state and direction, never borrowing another character's frames. */
  playFor(force = false): void {
    const id = this.charId;
    const c = CHARACTERS[id];
    if (!c) return;
    let key = '';
    let flip = false;
    const dirKey = (state: string) => animKey(id, state, this.dir);
    const single = (kind: 'idle' | 'hurt' | 'jump' | 'dodge' | 'climb' | 'swim' | 'single') => {
      const ref = this.sheetRef(kind);
      if (!ref || !this.scene.anims.exists(animKey(id, kind))) return false;
      key = animKey(id, kind);
      // side-view rows face east: west mirrors them; other directions keep the last horizontal side
      if (ref.facing === 'east') flip = this.dir === 'west' || ((this.dir === 'north' || this.dir === 'south') && this.sprite.flipX);
      else if (ref.facing === 'west') flip = this.dir === 'east';
      return true;
    };
    switch (this.state) {
      case 'walk': key = dirKey('walk'); break;
      case 'run': key = this.scene.anims.exists(dirKey('run')) ? dirKey('run') : dirKey('walk'); break;
      case 'ability': key = this.scene.anims.exists(dirKey('ability')) ? dirKey('ability') : dirKey('stand'); break;
      case 'swim': if (!single('swim')) key = dirKey('walk'); break;
      case 'climb': if (!single('climb')) key = animKey(id, 'stand', 'north'); break;
      case 'jump': if (!single('jump')) key = dirKey('stand'); break;
      case 'dodge': if (!single('dodge')) key = dirKey('walk'); break;
      case 'hurt': case 'downed': if (!single('hurt')) key = dirKey('stand'); break;
      default:
        if (this.gesturing && single('idle')) break;
        key = dirKey('stand');
    }
    if (!this.scene.anims.exists(key)) {
      if (!single('single')) return;
      if (c.single?.facing === 'east') flip = this.dir === 'west';
      else if (c.single?.facing === 'south') flip = this.dir === 'west';
    }
    this.sprite.setFlipX(flip);
    // a character drawn only in a gesture row holds its first pose when not speaking
    const still = !this.gesturing && (this.state === 'idle' || this.state === 'dialogue') && key === animKey(id, 'single') && GESTURE_SHEETS.test(c.single?.sheet ?? '');
    const token = still ? `${key}|still` : key;
    if (force || token !== this.currentAnim) {
      this.currentAnim = token;
      this.sprite.play(key, true);
      if (still) this.sprite.anims.pause();
    }
  }

  update(dt: number): void {
    this.stateTime += dt;
    if (this.invuln > 0) this.invuln -= dt;
  }

  sync(): void {
    const { x, y, level } = this.body;
    this.sprite.setPosition(Math.round(x), Math.round(y - this.z + this.visualOffsetY));
    this.sprite.setDepth(y + level * BRIDGE_DEPTH + 0.5);
    const s = Math.max(0.5, 1 - this.z / 80);
    this.shadow.setPosition(Math.round(x), Math.round(y - 1));
    this.shadow.setScale(s * (this.body.hw / 7), s);
    this.shadow.setDepth(y + level * BRIDGE_DEPTH - 0.5);
    this.shadow.setVisible(this.state !== 'swim' && this.sprite.visible);
    // flicker while invulnerable after damage
    this.sprite.setAlpha(this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0 ? 0.45 : 1);
  }

  /** Vulnerable box above the feet (world px). */
  hurtbox(): Phaser.Geom.Rectangle {
    const [w, h] = this.hurtSize;
    return new Phaser.Geom.Rectangle(this.body.x - w / 2, this.body.y - this.z - h, w, h);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
