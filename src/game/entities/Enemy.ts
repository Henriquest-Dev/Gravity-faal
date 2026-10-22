import Phaser from 'phaser';
import type { Grid } from '../../core/grid';
import { TILE } from '../../core/grid';
import { facingFor } from '../../core/motion';
import { findPath, tileCenter } from '../../core/path';
import type { Dir, EnemyDef } from '../../core/types';
import { animKey, sheetKey, sheetPivot } from '../assets';
import { ENEMIES, type AttackDef, type EnemyType } from '../data';
import type { Combat, Target } from '../systems/Combat';
import type { Fx } from '../systems/Fx';

type AiState = 'idle' | 'chase' | 'windup' | 'active' | 'recover' | 'stunned' | 'calm' | 'dead';

export interface EnemyHost {
  grid: Grid;
  combat: Combat;
  fx: Fx;
  playerPos(): { x: number; y: number; z: number; level: number };
  onDefeated(e: Enemy): void;
  playSfx(name: string): void;
}

const SCALE: Record<string, number> = { time_baby: 1 };

export class Enemy implements Target {
  readonly type: EnemyType;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly team = 'enemy' as const;
  body: { x: number; y: number; level: number; hw: number; hh: number; canSwim: boolean };
  hp: number;
  dir: Dir = 'south';
  ai: AiState = 'idle';
  t = 0;
  cooldown = 1;
  invuln = 0;
  stun = 0;
  exposed = 0; // journal scan / flashlight: weak point visible
  open = 0; // lock and guardian vulnerability window
  attack: AttackDef | null = null;
  lockClosed = true;
  phase = 0;
  homeX: number;
  homeY: number;
  path: { x: number; y: number }[] = [];
  repath = 0;
  z = 0;
  knock = { x: 0, y: 0, t: 0 };
  private anim = '';
  private attackIndex = 0;

  constructor(readonly scene: Phaser.Scene, readonly def: EnemyDef, private host: EnemyHost) {
    this.type = ENEMIES[def.type];
    const x = def.x * TILE, y = def.y * TILE;
    this.homeX = x;
    this.homeY = y;
    this.hp = this.type.hp;
    this.body = { x, y, level: 0, hw: this.type.body[0] / 2, hh: this.type.body[1] / 2, canSwim: false };
    this.shadow = scene.add.image(x, y, 'shadow').setScale(this.type.body[0] / 22, 1.4);
    const sheet = this.type.move.sheet;
    const p = sheetPivot(sheet);
    this.sprite = scene.add.sprite(x, y, sheetKey(sheet), 0).setOrigin(p.x / p.cell, p.y / p.cell).setScale(SCALE[def.type] ?? 1);
    if (def.type === 'shard') this.sprite.setTint(0xd0a0ff);
    this.playMove();
  }

  get id(): string { return this.def.id; }
  get x(): number { return this.body.x; }
  get y(): number { return this.body.y; }
  get radius(): number { return this.body.hw; }
  get alive(): boolean { return this.ai !== 'dead' && this.ai !== 'calm'; }

  vulnerable(): boolean {
    if (!this.alive || this.invuln > 0) return false;
    if (this.type.behavior === 'lock') return !this.lockClosed;
    if (this.type.behavior === 'boss') return this.ai === 'recover' || this.ai === 'stunned';
    return true;
  }

  /** Called by combat when a player attack overlaps. Shield logic lives here. */
  hit(damage: number, fromX: number, fromY: number): void {
    if (!this.vulnerable()) return;
    if (this.type.behavior === 'guardian' && this.open <= 0) {
      // frontal shield: attacks from the facing side are deflected
      const a = Math.atan2(fromY - this.y, fromX - this.x);
      const face = { south: Math.PI / 2, north: -Math.PI / 2, east: 0, west: Math.PI }[this.dir];
      const diff = Math.abs(Phaser.Math.Angle.Wrap(a - face));
      if (diff < (this.type.shield?.frontArc ?? 1.2)) {
        this.host.fx.text(this.x, this.y - 70, 'bloqueado', '#9ad0ff');
        this.host.playSfx('deny');
        return;
      }
    }
    const dmg = this.exposed > 0 ? damage * 2 : damage;
    this.hp -= dmg;
    this.invuln = 0.25;
    this.host.fx.anim('impact', this.x, this.y - 30, this.y + 2);
    this.host.fx.text(this.x, this.y - 64, `-${dmg}`, '#ffd0a0');
    this.host.playSfx('hit');
    const d = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    if (this.type.behavior !== 'boss' && this.type.behavior !== 'turret') this.knock = { x: ((this.x - fromX) / d) * 140, y: ((this.y - fromY) / d) * 140, t: 0.12 };
    if (this.hp <= 0) this.defeat();
  }

  defeat(): void {
    if (this.type.behavior === 'warden') {
      // agents are knocked out, never killed: they recover later
      this.ai = 'stunned';
      this.stun = 8;
      this.hp = this.type.hp;
      this.host.fx.text(this.x, this.y - 64, 'atordoado', '#9ad0ff');
      return;
    }
    this.ai = 'dead';
    this.host.combat.clearTeam('enemy');
    this.host.fx.anim('impact', this.x, this.y - 30, this.y + 2, 1.5);
    this.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 0, duration: 500, onComplete: () => this.setVisible(false) });
    this.host.onDefeated(this);
  }

  pacify(): void {
    this.ai = 'calm';
    this.sprite.setTint(0xc8f0ff);
    this.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 0, duration: 1200, delay: 600, onComplete: () => this.setVisible(false) });
    this.host.onDefeated(this);
  }

  stunFor(t: number): void {
    if (!this.alive || this.type.behavior === 'boss') return;
    this.stun = Math.max(this.stun, t);
    this.ai = 'stunned';
    this.host.fx.anim('stasis', this.x, this.y - 30, this.y + 2, 0.7);
  }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
  }

  private playMove(): void {
    const k = this.type.move.dirs ? animKey(this.def.type, 'move', this.dir) : animKey(this.def.type, 'move');
    if (this.def.type === 'time_baby') return this.playKey(this.ai === 'recover' ? 'time_baby:recover' : 'time_baby:levitate');
    this.playKey(k);
    if (!this.type.move.dirs) this.sprite.setFlipX(this.dir === 'west');
  }

  private playAttack(): void {
    if (this.def.type === 'time_baby') return this.playKey('time_baby:time_power');
    const k = this.type.attack.dirs ? animKey(this.def.type, 'attack', this.dir) : animKey(this.def.type, 'attack');
    this.playKey(k);
  }

  private playKey(k: string): void {
    if (k === this.anim || !this.scene.anims.exists(k)) return;
    this.anim = k;
    this.sprite.play(k);
  }

  update(dt: number, wake: boolean): void {
    if (!this.alive) return;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.exposed > 0) this.exposed -= dt;
    if (this.open > 0) this.open -= dt;
    const p = this.host.playerPos();
    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    if (!wake && this.ai === 'idle') return this.sync();
    this.t += dt;
    this.cooldown -= dt;

    if (this.knock.t > 0) {
      this.knock.t -= dt;
      this.move(this.knock.x * dt, this.knock.y * dt);
    }

    if (this.type.behavior === 'lock' && this.ai !== 'stunned') {
      const cyc = this.type.lockCycle!;
      if (this.open > 0) this.lockClosed = false;
      else {
        const period = cyc.closed + cyc.open;
        this.lockClosed = (this.t % period) < cyc.closed;
      }
      this.sprite.setTint(this.lockClosed ? 0x7a9aff : 0xffffff);
    }
    if (this.type.behavior === 'guardian') this.sprite.setTint(this.open > 0 ? 0xffffff : 0xb0c8ff);

    switch (this.ai) {
      case 'stunned':
        this.stun -= dt;
        this.sprite.setTint(0x9ad0ff);
        if (this.stun <= 0) {
          this.sprite.clearTint();
          this.ai = 'chase';
        }
        break;
      case 'idle':
        if (dist < this.type.aggro && this.host.grid.lineOfSight(this.x, this.y - 8, p.x, p.y - 8)) this.ai = 'chase';
        this.playMove();
        break;
      case 'chase': this.chase(dt, p, dist); break;
      case 'windup':
        if (this.t >= (this.attack?.windup ?? 0)) {
          this.ai = 'active';
          this.t = 0;
          this.release(p);
        }
        break;
      case 'active':
        if (this.attack?.shape === 'dash') {
          const v = this.dashDir;
          this.move(v.x * ((this.attack.length ?? 100) / Math.max(0.05, this.attack.active)) * dt, v.y * ((this.attack.length ?? 100) / Math.max(0.05, this.attack.active)) * dt);
        }
        if (this.t >= (this.attack?.active ?? 0)) {
          this.ai = 'recover';
          this.t = 0;
          if (this.type.behavior === 'guardian') this.open = this.type.shield?.openAfterPattern ?? 2;
          if (this.def.type === 'time_baby') this.host.fx.text(this.x, this.y - 170, 'oportunidade!', '#7af0ff');
          this.playMove();
        }
        break;
      case 'recover': {
        const rec = this.def.type === 'time_baby' ? (this.type.opportunity ?? 2) : (this.attack?.recover ?? 0.8);
        if (this.t >= rec) {
          this.ai = 'chase';
          this.t = 0;
          this.cooldown = this.attack?.cooldown ?? 1;
          this.playMove();
        }
        break;
      }
    }
    this.sync();
  }

  private dashDir = { x: 0, y: 1 };

  private chase(dt: number, p: { x: number; y: number; level: number }, dist: number): void {
    const t = this.type;
    if (dist > t.aggro * 1.8 && t.behavior !== 'boss') {
      // lost the player: walk home
      this.walkTowards(this.homeX, this.homeY, dt, t.speed * 0.6);
      if (Math.hypot(this.homeX - this.x, this.homeY - this.y) < 8) this.ai = 'idle';
      return;
    }
    const attacks = this.availableAttacks();
    const ready = this.cooldown <= 0 ? attacks.find((a) => dist <= a.range && (a.shape === 'circle' && !a.atTarget ? true : this.host.grid.lineOfSight(this.x, this.y - 8, p.x, p.y - 8))) : undefined;
    if (ready && p.level === 0) {
      this.startAttack(ready, p);
      return;
    }
    if (t.speed <= 0) return;
    let goalX = p.x, goalY = p.y;
    if (t.keepAway && dist < t.keepAway) {
      goalX = this.x - (p.x - this.x);
      goalY = this.y - (p.y - this.y);
    } else if (dist < (attacks[0]?.range ?? 40) * 0.7) {
      this.face(p.x - this.x, p.y - this.y);
      this.playMove();
      return;
    }
    this.walkTowards(goalX, goalY, dt, t.speed);
  }

  private availableAttacks(): AttackDef[] {
    const t = this.type;
    if (!t.phases) return t.attacks;
    const ratio = this.hp / t.hp;
    const ph = t.phases.find((x) => ratio > x.hpAbove) ?? t.phases[t.phases.length - 1];
    const idx = t.phases.indexOf(ph);
    if (idx !== this.phase) {
      this.phase = idx;
      this.host.fx.text(this.x, this.y - 180, `Fase ${idx + 1}`, '#ffe066');
    }
    // rotate through the phase's attacks so patterns are readable
    const list = ph.attacks.map((id) => t.attacks.find((a) => a.id === id)!).filter(Boolean);
    const a = list[this.attackIndex % list.length];
    return a ? [a] : list;
  }

  private walkTowards(gx: number, gy: number, dt: number, speed: number): void {
    const grid = this.host.grid;
    let tx = gx, ty = gy;
    if (!grid.lineOfSight(this.x, this.y - 6, gx, gy - 6) || this.path.length) {
      this.repath -= dt;
      if (this.repath <= 0) {
        this.repath = 0.6;
        const goal = { x: Math.floor(gx / TILE), y: Math.floor((gy - 4) / TILE) };
        this.path = findPath(grid, Math.floor(this.x / TILE), Math.floor((this.y - 4) / TILE), goal.x, goal.y, { maxNodes: 1500 }) ?? [];
      }
      const next = this.path[0];
      if (next) {
        const c = tileCenter(next);
        tx = c.x;
        ty = c.y;
        if (Math.hypot(c.x - this.x, c.y - this.y) < 6) this.path.shift();
      }
    }
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return;
    this.face(dx, dy);
    this.move((dx / d) * speed * dt, (dy / d) * speed * dt);
    this.playMove();
  }

  private face(dx: number, dy: number): void {
    this.dir = facingFor(dx, dy, this.dir);
  }

  private move(dx: number, dy: number): void {
    const r = this.host.grid.move(this.body, dx, dy);
    this.body.x = r.x;
    this.body.y = r.y;
  }

  private startAttack(a: AttackDef, p: { x: number; y: number }): void {
    this.attack = a;
    this.attackIndex++;
    this.ai = 'windup';
    this.t = 0;
    this.face(p.x - this.x, p.y - this.y);
    this.playAttack();
    const c = this.host.combat;
    const src = this.def.type;
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    if (a.shape === 'circle') {
      const count = a.count ?? 1;
      for (let i = 0; i < count; i++) {
        let cx: number, cy: number;
        if (a.atTarget) {
          const spread = i === 0 ? 0 : 50;
          cx = p.x + Math.cos(i * 2.1) * spread;
          cy = p.y + Math.sin(i * 2.1) * spread;
        } else {
          cx = this.x + Math.cos(ang) * (a.offset ?? 0);
          cy = this.y + Math.sin(ang) * (a.offset ?? 0);
        }
        c.circle(cx, cy, a.radius ?? 30, a.windup, a.active, a.damage, 'enemy', src, { detain: a.detain });
      }
    } else if (a.shape === 'lines') {
      const n = a.count ?? 1;
      const len = a.length ?? 200;
      for (let i = 0; i < n; i++) {
        // parallel lanes centred on the target, alternating orientation per pattern
        const horizontal = (this.attackIndex + i) % 2 === 0;
        const off = (i - (n - 1) / 2) * 70;
        if (horizontal) c.line(p.x - len / 2, p.y + off, p.x + len / 2, p.y + off, (a.width ?? 20) / 2, a.windup, a.active, a.damage, 'enemy', src);
        else c.line(p.x + off, p.y - len / 2, p.x + off, p.y + len / 2, (a.width ?? 20) / 2, a.windup, a.active, a.damage, 'enemy', src);
      }
    } else if (a.shape === 'dash') {
      const len = a.length ?? 100;
      this.dashDir = { x: Math.cos(ang), y: Math.sin(ang) };
      const self = this;
      c.line(this.x, this.y, this.x + this.dashDir.x * len, this.y + this.dashDir.y * len, (a.width ?? 26) / 2, a.windup, a.active, a.damage, 'enemy', src, {
        // during the dash the damaging area follows the body along the telegraphed lane
        follow: () => (self.ai === 'active' ? { x: self.x, y: self.y, x2: self.x + self.dashDir.x * 10, y2: self.y + self.dashDir.y * 10 } : null),
      });
    } else if (a.shape === 'projectile') {
      // telegraph: thin lane showing where the shot will travel
      const n = a.radial ?? a.spread ?? 1;
      for (let i = 0; i < Math.min(n, 3); i++) {
        const aa = a.radial ? ang + (i * Math.PI * 2) / n : ang + (i - (n - 1) / 2) * 0.25;
        c.line(this.x, this.y, this.x + Math.cos(aa) * 60, this.y + Math.sin(aa) * 60, 2, a.windup, 0.01, 0, 'enemy', src);
      }
    }
  }

  private release(p: { x: number; y: number }): void {
    const a = this.attack;
    if (!a || a.shape !== 'projectile') return;
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    const tint = this.def.type === 'pyronica' ? 0xff6a8a : this.def.type === 'time_baby' ? 0x7af0ff : 0xffd84a;
    const n = a.radial ?? a.spread ?? 1;
    for (let i = 0; i < n; i++) {
      const aa = a.radial ? ang + (i * Math.PI * 2) / n : ang + (i - (n - 1) / 2) * 0.25;
      this.host.combat.projectile(this.x, this.y - 2, aa, a.speed ?? 140, a.radius ?? 6, a.range, a.damage, 'enemy', this.def.type, tint);
    }
    this.host.playSfx('bolt');
  }

  sync(): void {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y - this.z - (this.def.type === 'time_baby' ? 24 + Math.sin(this.t * 2) * 6 : 0)));
    this.sprite.setDepth(this.y + 0.5);
    this.shadow.setPosition(this.x, this.y - 1).setDepth(this.y - 0.5);
    if (this.invuln > 0) this.sprite.setAlpha(Math.floor(this.invuln * 20) % 2 ? 0.5 : 1);
    else if (this.alive) this.sprite.setAlpha(1);
  }

  hurtbox(): Phaser.Geom.Rectangle {
    const [w, h] = this.type.hurt;
    return new Phaser.Geom.Rectangle(this.x - w / 2, this.y - h, w, h);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
