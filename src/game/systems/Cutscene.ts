import Phaser from 'phaser';
import type { DialogueRunner } from '../../core/dialogue';
import { DialogueRunner as Runner } from '../../core/dialogue';
import type { RuleData, Signal } from '../../core/rules';
import { applyEffects } from '../../core/rules';
import type { GameState } from '../../core/state';
import type { CsPoint, CutsceneDef, CutsceneStep, Dir, Effect } from '../../core/types';
import { buildCharacterAnims } from '../assets';
import { CHARACTERS } from '../data';
import { Actor } from '../entities/Actor';
import { session } from '../session';
import type { Ui } from '../ui/Ui';
import { facingFor } from '../../core/motion';
import type { Atmosphere } from '../world/Atmosphere';

const TILE = 32;

export interface CutsceneHost {
  scene: Phaser.Scene;
  ui: Ui;
  state: GameState;
  rules: RuleData;
  atmos: Atmosphere | null;
  /** player, companion and map NPCs by reference */
  actor(ref: string): Actor | null;
  talk(dialogueId: string, done: () => void): void;
  signals(s: Signal[]): void;
  /** camera zoom the area normally uses */
  baseZoom(): number;
  followPlayer(): void;
}

/**
 * Plays a data-driven cutscene: letterbox, camera moves, actors walking and
 * turning, lines with portraits, title cards, fades, shakes and effects.
 * Skipping fast-forwards everything visual but still applies every effect
 * and still asks every interactive dialogue (choices are never skipped).
 */
export class Director {
  private skipping = false;
  private spawned = new Map<string, Actor>();
  private wake = new Set<() => void>();
  private moving: { a: Actor; tw: Phaser.Tweens.Tween; to: [number, number] }[] = [];
  private current: CutsceneStep | null = null;
  running = false;

  constructor(private host: CutsceneHost) {}

  async play(def: CutsceneDef): Promise<void> {
    const { ui } = this.host;
    this.running = true;
    this.skipping = false;
    ui.prompt(null);
    ui.setCinematic(true, () => this.skip());
    await this.sleep(500);
    try {
      for (const st of def.steps) {
        this.current = st;
        await this.run(st);
      }
    } catch (e) {
      console.error('cutscene', def.id, e);
    }
    this.current = null;
    await this.end();
  }

  private skip(): void {
    if (this.skipping) return;
    this.skipping = true;
    const isLine = !!this.current && 'say' in this.current;
    this.host.ui.skipCinematic(isLine);
    for (const m of this.moving) this.finishMove(m);
    this.moving = [];
    for (const w of [...this.wake]) w();
    this.wake.clear();
    this.host.scene.cameras.main.resetFX();
  }

  private async end(): Promise<void> {
    const sc = this.host.scene;
    const cam = sc.cameras.main;
    for (const a of this.spawned.values()) a.destroy();
    this.spawned.clear();
    cam.resetFX();
    cam.zoomTo(this.host.baseZoom(), this.skipping ? 1 : 500);
    this.host.followPlayer();
    this.host.ui.setCinematic(false);
    this.running = false;
  }

  private sleep(ms: number): Promise<void> {
    if (this.skipping || ms <= 0) return Promise.resolve();
    return new Promise((res) => {
      const done = () => { this.wake.delete(done); res(); };
      this.wake.add(done);
      this.host.scene.time.delayedCall(ms, done);
    });
  }

  private point(p: CsPoint): { x: number; y: number } | null {
    if (Array.isArray(p)) return { x: p[0] * TILE, y: p[1] * TILE };
    const a = this.find(p);
    return a ? { x: a.x, y: a.y - 24 } : null;
  }

  private find(ref: string): Actor | null {
    return this.spawned.get(ref) ?? this.host.actor(ref);
  }

  private async run(st: CutsceneStep): Promise<void> {
    const h = this.host;
    const sc = h.scene;
    const cam = sc.cameras.main;
    if ('effects' in st) {
      h.signals(applyEffects(h.state, st.effects as Effect[], h.rules));
      return;
    }
    if ('dialogue' in st) {
      // interactive: never skipped
      await new Promise<void>((res) => h.talk(st.dialogue, res));
      return;
    }
    if ('spawn' in st) {
      buildCharacterAnims(sc, st.char);
      const a = new Actor(sc, st.char, st.at[0] * TILE, st.at[1] * TILE);
      a.dir = (st.dir ?? 'south') as Dir;
      a.calm = /^cast_/.test(CHARACTERS[st.char]?.idle?.sheet ?? '');
      a.force('idle');
      a.playFor(true);
      a.sprite.setAlpha(st.alpha ?? 1);
      a.sync();
      this.spawned.get(st.spawn)?.destroy();
      this.spawned.set(st.spawn, a);
      return;
    }
    if ('remove' in st) {
      this.spawned.get(st.remove)?.destroy();
      this.spawned.delete(st.remove);
      return;
    }
    if ('face' in st) {
      const a = this.find(st.face);
      if (!a) return;
      const dirs = ['south', 'west', 'east', 'north'];
      if (dirs.includes(st.dir)) a.dir = st.dir as Dir;
      else {
        const t = this.find(st.dir);
        if (t) a.dir = facingFor(t.x - a.x, t.y - a.y, a.dir);
      }
      a.force('idle');
      a.playFor(true);
      a.sync();
      return;
    }
    if ('anim' in st) {
      const a = this.find(st.anim);
      if (!a) return;
      a.force(st.state as never, (st.ms ?? 800) / 1000);
      a.calm = false;
      a.playFor(true);
      await this.sleep(st.ms ?? 0);
      a.calm = /^cast_/.test(CHARACTERS[a.charId]?.idle?.sheet ?? '');
      return;
    }
    if ('move' in st) {
      const a = this.find(st.move);
      if (!a) return;
      const to: [number, number] = [st.to[0] * TILE, st.to[1] * TILE];
      if (this.skipping) {
        a.body.x = to[0];
        a.body.y = to[1];
        a.sync();
        return;
      }
      const speed = st.speed ?? (st.run ? 140 : 70);
      const d = Math.hypot(to[0] - a.x, to[1] - a.y);
      a.dir = facingFor(to[0] - a.x, to[1] - a.y, a.dir);
      a.force(st.run ? 'run' : 'walk');
      a.playFor(true);
      const p = new Promise<void>((res) => {
        const proxy = { x: a.x, y: a.y };
        const m = {
          a, to,
          tw: sc.tweens.add({
            targets: proxy, x: to[0], y: to[1], duration: (d / speed) * 1000, ease: 'Linear',
            onUpdate: () => { a.body.x = proxy.x; a.body.y = proxy.y; a.sync(); },
            onComplete: () => { this.finishMove(m); res(); },
            onStop: () => res(),
          }),
        };
        this.moving.push(m);
        this.wake.add(res);
      });
      if (!st.async) await p;
      return;
    }
    if ('alpha' in st) {
      const a = this.find(st.alpha);
      if (!a) return;
      if (this.skipping) { a.sprite.setAlpha(st.to); return; }
      sc.tweens.add({ targets: [a.sprite, a.shadow], alpha: st.to, duration: st.ms ?? 600 });
      if (!st.async) await this.sleep(st.ms ?? 600);
      return;
    }
    if (this.skipping) return; // everything below is presentation only
    if ('wait' in st) return this.sleep(st.wait);
    if ('fade' in st) {
      const ms = st.fade === 'out' ? st.ms ?? 700 : st.ms ?? 900;
      if (st.fade === 'out') cam.fadeOut(ms, 0, 0, 0);
      else cam.fadeIn(ms, 0, 0, 0);
      return this.sleep(ms);
    }
    if ('card' in st) {
      await h.ui.card(st.card, st.lines ?? [], st.ms ?? 3200, st.sub ?? '');
      return;
    }
    if ('say' in st) {
      const id = st.say;
      const name = st.as ?? (id ? CHARACTERS[id]?.name ?? id : '');
      const def = { id: '_cs', entries: [{ start: 'a' }], nodes: { a: { id: 'a', speaker: name, text: st.text, mood: st.mood } } };
      const r: DialogueRunner = new Runner(def, h.state, h.rules);
      r.start();
      // the speaking actor turns to whoever it is with, and gestures while it talks
      await new Promise<void>((res) => h.ui.openDialogue(r, res));
      return;
    }
    if ('camera' in st) {
      const p = this.point(st.camera);
      cam.stopFollow();
      const ms = st.ms ?? 1200;
      if (p) cam.pan(p.x, p.y, ms, 'Sine.easeInOut', true);
      if (st.zoom) cam.zoomTo(h.baseZoom() * st.zoom, ms, 'Sine.easeInOut', true);
      return this.sleep(ms);
    }
    if ('shake' in st) {
      if (session.settings.screenShake && !session.settings.reducedEffects) cam.shake(st.ms ?? 500, st.shake);
      return;
    }
    if ('flash' in st) {
      if (session.settings.reducedEffects) return;
      const c = Phaser.Display.Color.HexStringToColor(st.flash);
      cam.flash(st.ms ?? 400, c.red, c.green, c.blue);
      return;
    }
    if ('sfx' in st) { session.audio.play(st.sfx as never); return; }
    if ('music' in st) { session.audio.startMusic(st.music, true); return; }
    if ('glow' in st) {
      const col = Phaser.Display.Color.HexStringToColor(st.color ?? '#ffe08a').color;
      h.atmos?.burst(st.glow[0] * TILE, st.glow[1] * TILE, st.r ?? 140, col, st.ms ?? 900);
      return;
    }
  }

  private finishMove(m: { a: Actor; tw: Phaser.Tweens.Tween; to: [number, number] }): void {
    if (m.tw.isPlaying()) m.tw.stop();
    m.a.body.x = m.to[0];
    m.a.body.y = m.to[1];
    m.a.force('idle');
    m.a.playFor(true);
    m.a.sync();
    this.moving = this.moving.filter((x) => x !== m);
  }
}
