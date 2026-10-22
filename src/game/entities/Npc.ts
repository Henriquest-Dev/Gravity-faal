import Phaser from 'phaser';
import type { Grid } from '../../core/grid';
import { TILE } from '../../core/grid';
import { facingFor } from '../../core/motion';
import type { NpcDef } from '../../core/types';
import { CHARACTERS } from '../data';
import { Actor } from './Actor';

/**
 * Townsfolk: wander inside a radius around home, never through solids, stop
 * when the player is close (no constant overlap) and face whoever talks to them.
 */
export class Npc {
  readonly actor: Actor;
  private target: { x: number; y: number } | null = null;
  private wait = 1 + Math.random() * 2;
  private homeX: number;
  private homeY: number;
  talking = false;

  constructor(scene: Phaser.Scene, readonly def: NpcDef, private grid: Grid) {
    this.homeX = def.x * TILE;
    this.homeY = def.y * TILE;
    const big = def.character === 'bill' || CHARACTERS[def.character]?.single;
    this.actor = new Actor(scene, def.character, this.homeX, this.homeY, { hw: big ? 10 : 7, hh: 4 });
    this.actor.dir = def.dir ?? 'south';
    this.actor.playFor(true);
    grid.addRect(this.solid());
  }

  get id(): string { return this.def.id; }

  solid() {
    const b = this.actor.body;
    return { id: `npc:${this.def.id}`, x: b.x - b.hw, y: b.y - b.hh * 2, w: b.hw * 2, h: b.hh * 2, dynamic: true };
  }

  faceTowards(x: number, y: number): void {
    this.actor.dir = facingFor(x - this.actor.x, y - this.actor.y, this.actor.dir);
    this.actor.force('idle');
    this.actor.playFor();
  }

  update(dt: number, player: { x: number; y: number }): void {
    const a = this.actor;
    a.update(dt);
    // characters whose idle row is a gesture sequence only gesture while talking
    const gestures = /^cast_/.test(CHARACTERS[this.def.character]?.idle?.sheet ?? '');
    if (gestures && a.calm === this.talking) { a.calm = !this.talking; a.playFor(true); }
    const near = Math.hypot(player.x - a.x, player.y - a.y) < 44;
    const canWalk = !!CHARACTERS[this.def.character]?.walk || this.def.character === 'waddles';
    if (this.talking || near || !this.def.wander || !canWalk) {
      if (a.state !== 'idle') { a.force('idle'); a.playFor(); }
      a.sync();
      return;
    }
    if (!this.target) {
      this.wait -= dt;
      if (this.wait <= 0) {
        const r = this.def.wander * TILE;
        const tx = this.homeX + (Math.random() * 2 - 1) * r, ty = this.homeY + (Math.random() * 2 - 1) * r;
        if (this.grid.standable(tx, ty) && this.grid.lineOfSight(a.x, a.y - 4, tx, ty - 4, true)) this.target = { x: tx, y: ty };
        this.wait = 0.5;
      }
    } else {
      const dx = this.target.x - a.x, dy = this.target.y - a.y;
      const d = Math.hypot(dx, dy);
      const speed = CHARACTERS[this.def.character]?.walkSpeed ?? 50;
      if (d < 3) {
        this.target = null;
        this.wait = 2 + Math.random() * 4;
        a.force('idle');
      } else {
        // the NPC's own rect is ignored while it moves
        a.body.ignore = `npc:${this.def.id}`;
        const r = a.moveBy(this.grid, (dx / d) * speed * 0.6 * dt, (dy / d) * speed * 0.6 * dt);
        if (r.blockedX && r.blockedY) this.target = null;
        a.dir = facingFor(dx, dy, a.dir);
        a.force('walk');
        a.sprite.anims.timeScale = 0.6;
      }
      this.grid.addRect(this.solid());
    }
    a.playFor();
    a.sync();
  }

  destroy(): void {
    this.grid.removeRect(`npc:${this.def.id}`);
    this.actor.destroy();
  }
}
