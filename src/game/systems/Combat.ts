import Phaser from 'phaser';
import type { Grid } from '../../core/grid';
import { DEPTH } from '../world/MapBuilder';

export type Team = 'player' | 'enemy';

export interface Target {
  id: string;
  team: Team;
  x: number; y: number; // feet
  z: number;
  radius: number; // half width of the body on the ground
  vulnerable(): boolean;
  hit(damage: number, fromX: number, fromY: number, source: string): void;
  detain?(): void;
}

/** A damaging area. The telegraph drawn on the ground IS the damage geometry. */
export interface Hazard {
  shape: 'circle' | 'line';
  x: number; y: number; r: number; // circle centre/radius, or line start + half width
  x2: number; y2: number; // line end
  windup: number; active: number; t: number;
  damage: number; team: Team; source: string; detain?: boolean;
  hit: Set<string>;
  gfx: Phaser.GameObjects.Graphics | null;
  color: number;
  follow?: () => { x: number; y: number; x2?: number; y2?: number } | null;
}

interface Projectile {
  img: Phaser.GameObjects.Image;
  x: number; y: number; vx: number; vy: number; r: number;
  life: number; damage: number; team: Team; source: string; active: boolean; height: number;
}

export class Combat {
  hazards: Hazard[] = [];
  private projectiles: Projectile[] = [];
  private gfxPool: Phaser.GameObjects.Graphics[] = [];
  onImpact: ((x: number, y: number) => void) | null = null;
  onTelegraph: (() => void) | null = null;

  constructor(private scene: Phaser.Scene, private grid: () => Grid, private targets: () => Target[]) {}

  private gfx(): Phaser.GameObjects.Graphics {
    const g = this.gfxPool.pop() ?? this.scene.add.graphics();
    g.setVisible(true).clear();
    return g;
  }

  circle(x: number, y: number, r: number, windup: number, active: number, damage: number, team: Team, source: string, opts: Partial<Hazard> = {}): Hazard {
    return this.add({ shape: 'circle', x, y, r, x2: x, y2: y, windup, active, damage, team, source, ...opts });
  }

  line(x: number, y: number, x2: number, y2: number, halfWidth: number, windup: number, active: number, damage: number, team: Team, source: string, opts: Partial<Hazard> = {}): Hazard {
    return this.add({ shape: 'line', x, y, r: halfWidth, x2, y2, windup, active, damage, team, source, ...opts });
  }

  private add(h: Omit<Hazard, 't' | 'hit' | 'gfx' | 'color'> & Partial<Hazard>): Hazard {
    const hz: Hazard = { t: 0, hit: new Set(), gfx: null, color: h.team === 'enemy' ? 0xff5a3a : 0x7af0ff, ...h } as Hazard;
    // player attacks are instant and drawn by sprites; enemy attacks are always telegraphed
    if (hz.team === 'enemy') {
      hz.gfx = this.gfx();
      this.onTelegraph?.();
    }
    this.hazards.push(hz);
    return hz;
  }

  projectile(x: number, y: number, angle: number, speed: number, r: number, range: number, damage: number, team: Team, source: string, tint: number): void {
    let p = this.projectiles.find((q) => !q.active);
    if (!p) {
      if (this.projectiles.length >= 64) return;
      p = { img: this.scene.add.image(0, 0, 'px'), x: 0, y: 0, vx: 0, vy: 0, r: 0, life: 0, damage: 0, team, source, active: false, height: 18 };
      this.projectiles.push(p);
    }
    Object.assign(p, { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, life: range / speed, damage, team, source, active: true });
    p.img.setVisible(true).setTint(tint).setScale(r / 1.5).setAlpha(1);
  }

  static inHazard(h: Hazard, x: number, y: number, radius: number): boolean {
    if (h.shape === 'circle') return Math.hypot(x - h.x, y - h.y) <= h.r + radius;
    const dx = h.x2 - h.x, dy = h.y2 - h.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - h.x) * dx + (y - h.y) * dy) / len2));
    return Math.hypot(x - (h.x + dx * t), y - (h.y + dy * t)) <= h.r + radius;
  }

  update(dt: number): void {
    const targets = this.targets();
    for (const h of this.hazards) {
      h.t += dt;
      if (h.follow) {
        const f = h.follow();
        if (f) {
          h.x = f.x; h.y = f.y;
          if (f.x2 !== undefined) { h.x2 = f.x2; h.y2 = f.y2!; }
        }
      }
      const activeNow = h.t >= h.windup && h.t < h.windup + h.active;
      if (activeNow) {
        for (const tg of targets) {
          if (tg.team === h.team || h.hit.has(tg.id) || !tg.vulnerable()) continue;
          if (tg.z > 28) continue; // high in a jump clears ground attacks
          if (Combat.inHazard(h, tg.x, tg.y, tg.radius)) {
            h.hit.add(tg.id);
            if (h.detain && tg.detain) tg.detain();
            else if (h.damage > 0) tg.hit(h.damage, h.x, h.y, h.source);
          }
        }
      }
      if (h.gfx) this.draw(h);
    }
    this.hazards = this.hazards.filter((h) => {
      const alive = h.t < h.windup + h.active;
      if (!alive && h.gfx) {
        h.gfx.clear().setVisible(false);
        this.gfxPool.push(h.gfx);
        h.gfx = null;
      }
      return alive;
    });

    const grid = this.grid();
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const tile = grid.tileAtPx(p.x, p.y);
      // walls and cliffs stop projectiles; water and pits do not
      const blocked = (tile.wall || tile.cliff || (tile.solid && !tile.blocker)) && !tile.climb;
      let done = p.life <= 0 || blocked;
      if (!done) {
        for (const tg of targets) {
          if (tg.team === p.team || !tg.vulnerable() || tg.z > 28) continue;
          if (Math.hypot(tg.x - p.x, tg.y - p.y) <= p.r + tg.radius + 4) {
            tg.hit(p.damage, p.x, p.y, p.source);
            done = true;
            break;
          }
        }
      }
      if (done) {
        p.active = false;
        p.img.setVisible(false);
        if (blocked || p.life > 0) this.onImpact?.(p.x, p.y - p.height);
        continue;
      }
      p.img.setPosition(p.x, p.y - p.height).setDepth(p.y + 1);
    }
  }

  private draw(h: Hazard): void {
    const g = h.gfx!;
    g.clear();
    g.setDepth(DEPTH.ground + 50);
    const wind = Math.min(1, h.t / Math.max(0.001, h.windup));
    const active = h.t >= h.windup;
    const fillA = active ? 0.55 : 0.08 + wind * 0.25;
    g.fillStyle(h.color, fillA);
    g.lineStyle(2, h.color, active ? 1 : 0.85);
    if (h.shape === 'circle') {
      g.strokeCircle(h.x, h.y, h.r);
      g.fillCircle(h.x, h.y, active ? h.r : h.r * wind);
    } else {
      const a = Math.atan2(h.y2 - h.y, h.x2 - h.x);
      const nx = -Math.sin(a) * h.r, ny = Math.cos(a) * h.r;
      const pts = [
        new Phaser.Math.Vector2(h.x + nx, h.y + ny), new Phaser.Math.Vector2(h.x2 + nx, h.y2 + ny),
        new Phaser.Math.Vector2(h.x2 - nx, h.y2 - ny), new Phaser.Math.Vector2(h.x - nx, h.y - ny),
      ];
      g.strokePoints(pts, true);
      const len = active ? 1 : wind;
      const fx = h.x + (h.x2 - h.x) * len, fy = h.y + (h.y2 - h.y) * len;
      g.fillPoints([pts[0], new Phaser.Math.Vector2(fx + nx, fy + ny), new Phaser.Math.Vector2(fx - nx, fy - ny), pts[3]], true);
    }
  }

  clearTeam(team: Team): void {
    for (const h of this.hazards) if (h.team === team) h.t = h.windup + h.active;
    for (const p of this.projectiles) if (p.team === team && p.active) { p.active = false; p.img.setVisible(false); }
  }

  clearAll(): void {
    for (const h of this.hazards) {
      if (!h.gfx) continue;
      h.gfx.clear().setVisible(false);
      this.gfxPool.push(h.gfx);
      h.gfx = null;
    }
    this.hazards = [];
    for (const p of this.projectiles) { p.active = false; p.img.setVisible(false); }
  }

  get activeProjectiles(): number {
    return this.projectiles.filter((p) => p.active).length;
  }

  destroy(): void {
    for (const p of this.projectiles) p.img.destroy();
    for (const h of this.hazards) h.gfx?.destroy();
    for (const g of this.gfxPool) g.destroy();
    this.projectiles = [];
    this.hazards = [];
    this.gfxPool = [];
  }
}
