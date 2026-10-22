import Phaser from 'phaser';
import { check } from '../../core/conditions';
import { DialogueRunner } from '../../core/dialogue';
import { TILE } from '../../core/grid';
import { animRate, dirVector, facingFor, isLocomotion, normalizeInput } from '../../core/motion';
import { findPath, tileCenter } from '../../core/path';
import { applyEffects, endingVariations, evaluateEnding, updateQuests, type Signal } from '../../core/rules';
import { createState, objKey, record } from '../../core/state';
import type { DialogueDef, Dir, Effect, MapDef } from '../../core/types';
import { buildCharacterAnims, buildEffectAnims, buildEnemyAnims, missingAssets, queueMap, unloadUnused } from '../assets';
import { ABILITIES, CHARACTERS, DIALOGUES, ENEMIES, ITEMS, MAPS, QUESTS, RULES } from '../data';
import { Actor } from '../entities/Actor';
import { Enemy, type EnemyHost } from '../entities/Enemy';
import { Npc } from '../entities/Npc';
import { session } from '../session';
import { Combat, type Target } from '../systems/Combat';
import { Fx } from '../systems/Fx';
import type { Ui, UiHost } from '../ui/Ui';
import { DEPTH, MapBuilder, type BuiltMap, type IObj } from '../world/MapBuilder';

const STEP = 1 / 60;
const JUMP_V = 230;
const GRAVITY = 900;

interface Interactive { kind: 'npc' | 'obj' | 'enemy'; id: string; x: number; y: number; label: string }

export class WorldScene extends Phaser.Scene implements UiHost, EnemyHost {
  ui!: Ui;
  built: BuiltMap | null = null;
  player!: Actor;
  companion: Actor | null = null;
  companionHold = false;
  npcs: Npc[] = [];
  enemies: Enemy[] = [];
  combat!: Combat;
  fx!: Fx;
  private areaKeys: string[] = [];
  private acc = 0;
  private busy = false; // loading / transitioning
  private jumpV = { x: 0, y: 0 };
  private takeoff = { x: 0, y: 0 };
  private dodgeV = { x: 0, y: 0 };
  private dodgeCd = 0;
  private abilityCd = 0;
  private attackHitAt = -1;
  private grappleTo: { x: number; y: number; t: number; fromX: number; fromY: number } | null = null;
  private rope!: Phaser.GameObjects.Graphics;
  private cone!: Phaser.GameObjects.Graphics;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private marker!: Phaser.GameObjects.Image;
  private darkness!: Phaser.GameObjects.Image;
  private target: Interactive | null = null;
  private lastSafeT = 0;
  private lastGround = { x: 0, y: 0 };
  private exitBlockedShown = '';
  private compPath: { x: number; y: number }[] = [];
  private compRepath = 0;
  private compStuck = 0;
  private seqProgress = new Map<string, number>();
  private fpsSamples: number[] = [];
  private downedT = 0;
  private stepDust = 0;
  private wasInWater = false;

  constructor() {
    super('world');
  }

  get grid() { return this.built!.grid; }
  get s() { return session.state; }

  create(data: { spawn?: string }): void {
    this.ui = this.registry.get('ui') as Ui;
    this.ui.setHost(this);
    this.ui.showHud(true);
    this.combat = new Combat(this, () => this.grid, () => this.targets());
    this.combat.onImpact = (x, y) => this.fx.anim('impact', x, y, y + 40, 0.6);
    this.combat.onTelegraph = () => session.audio.play('telegraph');
    this.fx = new Fx(this);
    this.applySettings();
    buildEffectAnims(this);
    this.rope = this.add.graphics().setDepth(DEPTH.overlay - 2);
    this.cone = this.add.graphics().setDepth(DEPTH.overlay - 3);
    this.debugGfx = this.add.graphics().setDepth(DEPTH.overlay + 10);
    this.debugText = this.add.text(4, 4, '', { fontFamily: 'monospace', fontSize: '10px', color: '#0f0', backgroundColor: '#000a' }).setScrollFactor(0).setDepth(DEPTH.overlay + 11);
    this.marker = this.add.image(0, 0, 'target').setDepth(DEPTH.overlay - 1).setVisible(false);
    this.darkness = this.add.image(0, 0, 'darkness').setScrollFactor(0).setDepth(DEPTH.foreground + 5e5).setVisible(false);
    this.tweens.add({ targets: this.marker, y: '-=4', duration: 400, yoyo: true, repeat: -1 });
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.exposeDebug();
    this.loadArea(this.s.mapId, data.spawn);
  }

  // ------------------------------------------------------------------ input
  private onPointerDown(p: Phaser.Input.Pointer): void {
    session.audio.unlock();
    if (p.wasTouch) return; // touch uses on-screen controls
    if (this.ui.blocking || this.busy) return;
    if (p.leftButtonDown()) {
      this.onPointerMove(p);
      session.input.virtualDown('primary', -1);
      session.input.virtualUp('primary', -1);
    }
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (p.wasTouch) return;
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    session.input.mouseWorld = { x: w.x, y: w.y };
    session.input.mouseActiveUntil = this.time.now + 2500;
    session.input.lastDevice = 'keyboard';
  }

  /** Aim direction: mouse in the world, touch drag, else facing. */
  private aimVector(): { x: number; y: number } {
    const inp = session.input;
    if (inp.aim) return inp.aim;
    if (inp.mouseAimActive(this.time.now) && inp.mouseWorld) {
      const dx = inp.mouseWorld.x - this.player.x, dy = inp.mouseWorld.y - (this.player.y - 20);
      const d = Math.hypot(dx, dy);
      if (d > 8) return { x: dx / d, y: dy / d };
    }
    return dirVector(this.player.dir);
  }

  // ------------------------------------------------------------- loading
  loadArea(mapId: string, spawn?: string): void {
    const def = MAPS[mapId];
    if (!def) {
      this.ui.toast(`Mapa em falta: ${mapId}`);
      this.busy = false;
      return;
    }
    this.busy = true;
    const art = def.reference ? `assets/environments/${def.reference}.png` : undefined;
    this.ui.loading(true, `A carregar: ${def.name}`, 0, art);
    const keys = queueMap(this, mapId);
    const finish = () => {
      this.load.off('progress');
      this.ui.loading(true, `A construir: ${def.name}`, 1, art);
      unloadUnused(this, this.areaKeys, keys);
      this.areaKeys = keys;
      try {
        this.buildArea(def, spawn);
      } finally {
        this.ui.loading(false);
        if (missingAssets.length) console.warn('Recursos em falta:', [...new Set(missingAssets)]);
      }
    };
    if (this.load.list.size === 0 && !this.load.isLoading()) {
      finish();
      return;
    }
    this.load.on('progress', (p: number) => this.ui.loading(true, `A carregar: ${def.name}`, p, art));
    this.load.once('complete', finish);
    this.load.once('loaderror', (f: Phaser.Loader.File) => missingAssets.push(`${f.key} (${f.url})`));
    this.load.start();
  }

  private cleanup(): void {
    this.combat.clearAll();
    for (const n of this.npcs) n.destroy();
    for (const e of this.enemies) e.destroy();
    this.npcs = [];
    this.enemies = [];
    this.player?.destroy();
    this.companion?.destroy();
    this.companion = null;
    if (this.built) for (const o of this.built.destroyables) o.destroy();
    this.built = null;
    this.target = null;
    this.seqProgress.clear();
  }

  private buildArea(def: MapDef, spawnName?: string): void {
    this.cleanup();
    const s = this.s;
    for (const id of new Set([...s.party, ...(def.npcs ?? []).map((n) => n.character)])) buildCharacterAnims(this, id);
    for (const e of def.enemies ?? []) buildEnemyAnims(this, e.type);
    this.built = new MapBuilder(this, s).build(def);
    const grid = this.grid;

    // position: named spawn > saved position (validated) > checkpoint > default
    let pos: { x: number; y: number } | null = null;
    let dir: Dir = s.pos.dir ?? 'south';
    const sp = spawnName ? def.spawns[spawnName] : undefined;
    if (sp) {
      pos = { x: sp.x * TILE, y: sp.y * TILE };
      dir = sp.dir ?? dir;
    } else if (s.mapId === def.id && s.pos.x >= 0 && grid.standable(s.pos.x, s.pos.y, 7, 4, s.pos.level)) {
      pos = { x: s.pos.x, y: s.pos.y };
    } else if (s.safe.mapId === def.id && s.safe.x >= 0) {
      pos = { x: s.safe.x, y: s.safe.y };
    }
    if (!pos) {
      const d = def.spawns.default ?? Object.values(def.spawns)[0];
      pos = { x: d.x * TILE, y: d.y * TILE };
      dir = d.dir ?? 'south';
    }
    const safe = grid.findStandable(pos.x, pos.y) ?? pos;
    this.player = this.makeHero(s.character, safe.x, safe.y);
    this.player.dir = dir;
    this.lastGround = { ...safe };
    s.mapId = def.id;
    s.pos = { x: safe.x, y: safe.y, level: 0, dir };
    if (!s.party.includes(s.character)) s.character = s.party[0];
    this.spawnCompanion();

    for (const n of def.npcs ?? []) {
      if (!check(n.if, s, def.id)) continue;
      if (s.npcs[n.id] === 'gone') continue;
      this.npcs.push(new Npc(this, n, grid));
    }
    for (const e of def.enemies ?? []) {
      if (!check(e.if, s, def.id) || s.defeated.includes(e.id) || !ENEMIES[e.type]) continue;
      this.enemies.push(new Enemy(this, e, this));
    }

    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, 0.14, 0.14, 0, 20);
    cam.setRoundPixels(true);
    this.onResize();
    cam.fadeIn(250, 0, 0, 0);

    const first = !s.visited.includes(def.id);
    if (first) s.visited.push(def.id);
    this.handleSignals(applyEffects(s, def.onEnter, RULES, def.id));
    session.audio.startMusic(def.music);
    this.ui.areaTitle(def.name);
    if (s.safe.mapId !== def.id || s.safe.x < 0) s.safe = { mapId: def.id, x: safe.x, y: safe.y, level: 0 };
    const amb = def.ambient;
    this.darkness.setVisible(!!amb?.darkness).setAlpha(amb?.darkness ?? 0);
    if (amb?.tint) cam.setBackgroundColor(amb.tint);
    this.busy = false;
    this.autosave();
  }

  private makeHero(id: string, x: number, y: number): Actor {
    const a = new Actor(this, id, x, y, { hw: 7, hh: 4, canSwim: true });
    a.maxHp = this.s.maxHp;
    a.hp = this.s.hp[id] ?? this.s.maxHp;
    a.hurtSize = [24, 50];
    a.playFor(true);
    a.sync();
    return a;
  }

  private spawnCompanion(): void {
    this.companion?.destroy();
    this.companion = null;
    const other = this.s.party.find((c) => c !== this.s.character);
    if (!other) return;
    const back = dirVector(this.player.dir);
    const p = this.grid.findStandable(this.player.x - back.x * 26, this.player.y - back.y * 26) ?? { x: this.player.x, y: this.player.y };
    this.companion = this.makeHero(other, p.x, p.y);
    this.companion.dir = this.player.dir;
    this.companionHold = false;
  }

  private onResize(): void {
    const cam = this.cameras.main;
    const w = this.scale.width, h = this.scale.height;
    // integer zoom keeps every sprite pixel the same size
    const forced = Number(new URLSearchParams(location.search).get('zoom'));
    const zoom = forced > 0 ? forced : Math.max(1, Math.floor(Math.min(w / 560, h / 330)));
    cam.setZoom(zoom);
    if (!this.built) return;
    const vw = w / zoom, vh = h / zoom;
    const mw = this.grid.pxW, mh = this.grid.pxH;
    const bx = mw < vw ? -(vw - mw) / 2 : 0, by = mh < vh ? -(vh - mh) / 2 : 0;
    cam.setBounds(bx, by, Math.max(mw, vw), Math.max(mh, vh));
    this.darkness.setPosition(w / 2, h / 2).setDisplaySize(Math.max(w, h) * 1.2 / zoom, Math.max(w, h) * 1.2 / zoom);
    this.darkness.setScrollFactor(0);
  }

  applySettings(): void {
    if (!this.fx) return;
    this.fx.reduced = session.settings.reducedEffects;
    this.fx.shakeEnabled = session.settings.screenShake;
  }

  // ---------------------------------------------------------------- update
  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.fpsSamples.push(deltaMs);
    if (this.fpsSamples.length > 60) this.fpsSamples.shift();
    this.ui.update(dt);
    if (!this.built || this.busy) return;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 6) {
      this.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === 6) this.acc = 0;
    this.render(dt);
    session.input.endFrame();
  }

  private step(dt: number): void {
    const s = this.s;
    s.playTime += dt;
    const inp = session.input;
    if (!this.ui.blocking) {
      if (inp.consume('pause')) this.ui.open('pause');
      else if (inp.consume('inventory')) this.ui.open('inventory');
      else if (inp.consume('journal')) this.ui.open('journal');
      else if (inp.consume('map')) this.ui.open('map');
    }
    if (inp.consume('debug')) session.debug = !session.debug;
    const blocked = this.ui.blocking;
    if (!blocked) {
      s.energy = Math.min(s.maxEnergy, s.energy + dt * 0.6);
      this.updatePlayer(dt);
    } else if (isLocomotion(this.player.state)) {
      this.player.force('idle');
    }
    this.player.update(dt);
    this.updateCompanion(dt, blocked);
    for (const n of this.npcs) n.update(blocked ? 0 : dt, this.player);
    if (!blocked) {
      const camView = this.cameras.main.worldView;
      for (const e of this.enemies) {
        // far, inactive enemies are not simulated
        const near = Math.abs(e.x - this.player.x) < camView.width && Math.abs(e.y - this.player.y) < camView.height;
        e.update(dt, near);
      }
      this.combat.update(dt);
      this.updatePlates();
      this.checkTriggers(dt);
      this.checkExits();
    }
    this.syncState();
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    const inp = session.input;
    const grid = this.grid;
    if (this.dodgeCd > 0) this.dodgeCd -= dt;
    if (this.abilityCd > 0) this.abilityCd -= dt;

    if (p.state === 'downed') {
      this.downedT += dt;
      if (this.downedT > 1.2 && !this.ui.blocking) this.defeatScreen();
      p.playFor();
      return;
    }

    if (this.grappleTo) {
      const g = this.grappleTo;
      g.t += dt;
      const k = Math.min(1, g.t / 0.35);
      p.body.x = g.fromX + (g.x - g.fromX) * k;
      p.body.y = g.fromY + (g.y - g.fromY) * k;
      p.z = Math.sin(k * Math.PI) * 24;
      if (k >= 1) {
        this.grappleTo = null;
        p.z = 0;
        p.body.airborne = false;
        p.force('idle');
        this.rope.clear();
        session.audio.play('land');
      }
      p.playFor();
      return;
    }

    const tile = grid.tileAtPx(p.x, p.y - p.body.hh);
    const inDeep = p.body.level === 0 && !p.body.airborne && (tile.water === 'deep' || !!tile.bridge);
    const onLadder = !!tile.climb && !p.body.airborne;
    let mv = normalizeInput(inp.moveVector().x, inp.moveVector().y);
    const c = CHARACTERS[p.charId];
    let speed = 0;

    // ---------------------------------------------------------- actions
    const grounded = !p.body.airborne;
    const busy = !isLocomotion(p.state) && !p.stateFinished;
    if (!busy && grounded) {
      if (inp.consume('interact')) this.interact();
      else if (inp.consume('switch')) this.switchCharacter();
      else if (inp.consume('cycle')) this.cycleAbility();
      else if (inp.consume('jump') && !inDeep && !onLadder) {
        if (p.enter('jump')) {
          p.vz = JUMP_V;
          p.z = 0.01;
          p.body.airborne = true;
          const run = inp.running() ? c?.runSpeed ?? 150 : c?.walkSpeed ?? 90;
          this.jumpV = { x: mv.x * run, y: mv.y * run };
          this.takeoff = { x: p.x, y: p.y };
          session.audio.play('jump');
        }
      } else if (inp.consume('dodge') && !inDeep && !onLadder && this.dodgeCd <= 0) {
        const v = mv.mag > 0.1 ? mv : dirVector(p.dir);
        if (p.enter('dodge', 0.24)) {
          this.dodgeV = { x: v.x * 270, y: v.y * 270 };
          p.invuln = Math.max(p.invuln, 0.3);
          this.dodgeCd = 0.55;
          session.audio.play('dodge');
          this.fx.anim('run_dust', p.x, p.y, p.y - 1, 0.6);
        }
      } else if (inp.consume('primary') && !inDeep && !onLadder) {
        this.primaryAttack();
      } else if (inp.consume('secondary') && !inDeep && !onLadder) {
        this.useAbility();
        inp.aim = null;
      }
    }
    // drop presses that could not be used this frame so they do not fire later
    for (const a of ['interact', 'switch', 'cycle', 'jump', 'dodge', 'primary', 'secondary'] as const) inp.consume(a);

    // ------------------------------------------------------- locomotion
    if (p.state === 'dodge' && !p.stateFinished) {
      p.moveBy(grid, this.dodgeV.x * dt, this.dodgeV.y * dt);
      p.playFor();
      return;
    }
    if (p.body.airborne) {
      p.vz -= GRAVITY * dt;
      p.z += p.vz * dt;
      // limited steering in the air
      this.jumpV.x += mv.x * 200 * dt;
      this.jumpV.y += mv.y * 200 * dt;
      const m = Math.hypot(this.jumpV.x, this.jumpV.y), max = (c?.runSpeed ?? 150);
      if (m > max) { this.jumpV.x *= max / m; this.jumpV.y *= max / m; }
      p.moveBy(grid, this.jumpV.x * dt, this.jumpV.y * dt);
      if (p.z <= 0) this.land();
      p.playFor();
      return;
    }
    if (p.state === 'ability' || p.state === 'interact' || p.state === 'hurt') {
      if (p.state === 'ability' && this.attackHitAt >= 0 && p.stateTime >= this.attackHitAt) {
        this.attackHitAt = -1;
        this.meleeHit();
      }
      if (p.state === 'hurt') p.moveBy(grid, this.dodgeV.x * dt, this.dodgeV.y * dt);
      if (!p.stateFinished) {
        p.playFor();
        return;
      }
      p.force('idle');
    }

    if (onLadder) {
      // ladders: vertical only, gently centred on the rungs
      const cx = Math.floor(p.x / TILE) * TILE + TILE / 2;
      mv = { x: 0, y: mv.y, mag: Math.abs(mv.y) };
      speed = 55;
      p.force('climb');
      p.moveBy(grid, (cx - p.x) * Math.min(1, dt * 10), mv.y * speed * dt);
      p.dir = 'north';
      p.sprite.anims.timeScale = mv.mag > 0.1 ? 1 : 0;
      p.playFor();
      return;
    }
    if (inDeep) {
      speed = 62;
      p.force('swim');
      if (!this.wasInWater) { session.audio.play('splash'); this.fx.ripple(p.x, p.y, 0xd8fffb, 20); }
      this.wasInWater = true;
    } else {
      if (this.wasInWater) { this.fx.ripple(p.x, p.y); this.wasInWater = false; }
      const running = inp.running() && mv.mag > 0.5;
      speed = (running ? c?.runSpeed ?? 150 : c?.walkSpeed ?? 90) * (tile.water === 'shallow' ? 0.7 : 1);
      if (mv.mag > 0.05) p.force(running ? 'run' : 'walk');
      else p.force('idle');
    }
    if (mv.mag > 0.05) {
      p.dir = facingFor(mv.x, mv.y, p.dir);
      const before = { x: p.x, y: p.y };
      p.moveBy(grid, mv.x * speed * dt, mv.y * speed * dt);
      const actual = Math.hypot(p.x - before.x, p.y - before.y) / dt;
      p.speedNow = actual;
      const nominal = p.state === 'run' ? c?.runSpeed ?? 150 : c?.walkSpeed ?? 90;
      // animation speed follows real ground speed (slower when sliding along walls or in water)
      p.sprite.anims.timeScale = p.state === 'swim' ? 1 : animRate(actual, nominal);
      this.footsteps(p, tile.surface, tile.water === 'shallow');
    } else {
      p.speedNow = 0;
      p.sprite.anims.timeScale = 1;
    }
    p.playFor();
    // remember safe ground for falls and reloads
    this.lastSafeT += dt;
    if (this.lastSafeT > 0.3 && !inDeep && grid.standable(p.x, p.y)) {
      this.lastSafeT = 0;
      this.lastGround = { x: p.x, y: p.y };
    }
  }

  private footsteps(a: Actor, surface: string, shallow: boolean): void {
    const stride = a.state === 'run' ? 30 : 24;
    if (!a.takeStep(stride)) return;
    session.audio.step_(shallow ? 'water' : surface);
    if (shallow) this.fx.ripple(a.x, a.y, 0xd8fffb, 10, 350);
    if (a.state === 'run' && !shallow && (surface === 'dirt' || surface === 'grass')) {
      this.stepDust++;
      if (this.stepDust % 2 === 0) this.fx.anim('run_dust', a.x - dirVector(a.dir).x * 8, a.y + 2, a.y - 2, 0.5);
    }
  }

  private land(): void {
    const p = this.player;
    p.z = 0;
    p.vz = 0;
    p.body.airborne = false;
    const grid = this.grid;
    const t = grid.tileAtPx(p.x, p.y - p.body.hh);
    if (t.pit) {
      this.fall();
      return;
    }
    if (grid.boxBlocked(p.body, p.x, p.y)) {
      // landed on a low obstacle: slide forward a little, else back to takeoff
      const v = Math.hypot(this.jumpV.x, this.jumpV.y) || 1;
      let ok = false;
      for (let d = 2; d <= 30 && !ok; d += 2) {
        const nx = p.x + (this.jumpV.x / v) * d, ny = p.y + (this.jumpV.y / v) * d;
        if (!grid.boxBlocked(p.body, nx, ny)) { p.body.x = nx; p.body.y = ny; ok = true; }
      }
      if (!ok) { p.body.x = this.takeoff.x; p.body.y = this.takeoff.y; }
    }
    p.force('idle');
    session.audio.play('land');
    this.fx.anim('run_dust', p.x, p.y, p.y - 1, 0.5);
  }

  private fall(): void {
    const p = this.player;
    session.audio.play('hurt');
    this.fx.anim('rift', p.x, p.y, p.y + 1, 0.6);
    p.body.x = this.lastGround.x;
    p.body.y = this.lastGround.y;
    p.body.level = 0;
    this.damagePlayer(1, p.x, p.y, 'queda', false);
    this.ui.toast('Caíste no vazio. Regressaste à última posição segura.');
  }

  // ------------------------------------------------------------- abilities
  private abilitiesFor(char: string): string[] {
    return this.s.abilities.filter((a) => ABILITIES[a]?.owner === char && !['geometry', 'rift'].includes(a));
  }

  private selectedAbility(): string | undefined {
    const list = this.abilitiesFor(this.s.character);
    const sel = this.s.selectedAbility[this.s.character];
    return sel && list.includes(sel) ? sel : list[0];
  }

  private cycleAbility(): void {
    const list = this.abilitiesFor(this.s.character);
    if (list.length < 2) return;
    const cur = this.selectedAbility();
    const next = list[(list.indexOf(cur ?? '') + 1) % list.length];
    this.s.selectedAbility[this.s.character] = next;
    session.audio.play('ui');
    this.ui.toast(`Capacidade: ${ABILITIES[next].name}`, 1200);
  }

  private primaryAttack(): void {
    const p = this.player;
    if (!p.enter('ability', 0.42)) return;
    this.attackHitAt = 0.14;
    session.audio.play('swing');
    const a = this.aimVector();
    if (Math.hypot(a.x, a.y) > 0) p.dir = facingFor(a.x, a.y, p.dir);
  }

  private meleeHit(): void {
    const p = this.player;
    const a = this.aimVector();
    const reach = p.charId === 'mabel' ? 26 : 22;
    const cx = p.x + a.x * reach, cy = p.y + a.y * reach * 0.8;
    this.combat.circle(cx, cy, p.charId === 'mabel' ? 28 : 24, 0, 0.08, 1, 'player', p.charId);
    this.fx.anim('impact', cx, cy - 14, cy + 2, 0.45, p.charId === 'bill_child' ? 0xffe066 : undefined);
  }

  private spendEnergy(n: number): boolean {
    if (this.s.energy < n) {
      this.ui.toast('Energia insuficiente.', 1200);
      session.audio.play('deny');
      return false;
    }
    this.s.energy -= n;
    return true;
  }

  private useAbility(): void {
    const id = this.selectedAbility();
    if (!id) return;
    const ab = ABILITIES[id];
    if (this.abilityCd > 0) return;
    const p = this.player;
    const aim = this.aimVector();
    p.dir = facingFor(aim.x, aim.y, p.dir);
    switch (id) {
      case 'perceive': {
        if (!this.spendEnergy(ab.energy)) return;
        p.enter('ability', 0.35);
        this.fx.ripple(p.x, p.y, 0xffe066, ab.range ?? 160, 700);
        this.fx.anim('stasis', p.x, p.y - 30, p.y + 2, 1, 0xffe066);
        session.audio.play('clue');
        let found = 0;
        for (const o of this.built!.objects.values()) {
          if (o.revealed || (o.def.reveal && o.def.reveal !== 'perceive')) continue;
          if (Math.hypot(o.x - p.x, o.y - p.y) <= (ab.range ?? 160)) { this.reveal(o); found++; }
        }
        this.ui.toast(found ? `Anomalias reveladas: ${found}` : 'Nenhuma anomalia por perto.', 1400);
        break;
      }
      case 'flashlight': {
        if (!this.spendEnergy(ab.energy)) return;
        p.enter('ability', 0.35);
        this.flashCone(aim, ab.range ?? 140);
        break;
      }
      case 'journal_scan': {
        const e = this.nearestEnemy(ab.range ?? 200);
        if (!e) { this.ui.toast('Nenhuma criatura ao alcance para analisar.', 1400); return; }
        if (!this.spendEnergy(ab.energy)) return;
        e.exposed = 6;
        const first = !this.s.flags[`scanned:${e.def.type}`];
        this.s.flags[`scanned:${e.def.type}`] = true;
        this.fx.text(e.x, e.y - 80, 'ponto fraco!', '#ffe066');
        session.audio.play('clue');
        if (first) this.ui.toast(`Diário: ${ENEMIES[e.def.type].name} registado no bestiário.`);
        break;
      }
      case 'grapple': this.grapple(aim); break;
      case 'telekinesis': {
        const o = this.findInCone([...this.built!.objects.values()].filter((x) => x.def.kind === 'push'), aim, ab.range ?? 128);
        if (!o) { this.ui.toast('Nenhum bloco geométrico na direcção apontada.', 1400); return; }
        if (!this.spendEnergy(ab.energy)) return;
        p.enter('ability', 0.35);
        const d: Dir = facingFor(o.x - p.x, o.y - p.y, p.dir);
        if (!this.pushBlock(o, d)) this.ui.toast('O bloco não se move nessa direcção.', 1200);
        this.fx.anim('rift', o.x, o.y - 10, o.y + 1, 0.5, 0xffe066);
        break;
      }
      case 'energy_bolt': {
        if (!this.spendEnergy(ab.energy)) return;
        p.enter('ability', 0.3);
        this.combat.projectile(p.x + aim.x * 10, p.y + aim.y * 6, Math.atan2(aim.y, aim.x), 260, 6, ab.range ?? 220, 2, 'player', 'bill', 0xffe066);
        session.audio.play('bolt');
        break;
      }
      case 'charm': {
        const e = this.nearestEnemy(ab.range ?? 90);
        if (!e) { this.ui.toast('Ninguém por perto para acalmar.', 1200); return; }
        if (!this.spendEnergy(ab.energy)) return;
        p.enter('ability', 0.4);
        const calmCond = (e.type.calm ?? e.type.negotiate) as never;
        if ((calmCond && check(calmCond, this.s)) || e.hp <= e.type.hp * 0.4) {
          this.fx.text(e.x, e.y - 80, '♥ acalmou', '#ff9ad0');
          record(this.s, 'helped', `calm:${e.def.type}`);
          e.pacify();
        } else {
          e.stunFor(1.5);
          this.fx.text(e.x, e.y - 80, 'hesita…', '#ff9ad0');
        }
        break;
      }
    }
    this.abilityCd = ab.cooldown;
  }

  private flashCone(aim: { x: number; y: number }, range: number): void {
    const p = this.player;
    const ang = Math.atan2(aim.y, aim.x), half = 0.45;
    const g = this.cone;
    g.clear();
    g.fillStyle(0xfff3a0, 0.28);
    g.slice(p.x, p.y - 20, range, ang - half, ang + half, false);
    g.fillPath();
    this.time.delayedCall(350, () => g.clear());
    session.audio.play('open');
    const inCone = (x: number, y: number) => {
      const dx = x - p.x, dy = y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range) return false;
      return Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang)) < half + 0.15 && this.grid.lineOfSight(p.x, p.y - 8, x, y - 8);
    };
    let found = 0;
    for (const o of this.built!.objects.values()) {
      if (!o.revealed && (o.def.reveal ?? 'flashlight') === 'flashlight' && inCone(o.x, o.y)) { this.reveal(o); found++; }
    }
    for (const e of this.enemies) {
      if (!e.alive || !inCone(e.x, e.y)) continue;
      if (e.type.behavior === 'lock') { e.open = 3; this.fx.text(e.x, e.y - 90, 'aberto!', '#ffe066'); }
      else if (e.def.type === 'teeth' || e.def.type === 'shard') e.stunFor(2);
      else e.exposed = Math.max(e.exposed, 2);
    }
    if (found) this.ui.toast(`A lanterna revelou ${found} símbolo(s).`, 1400);
  }

  private reveal(o: IObj): void {
    o.revealed = true;
    this.s.flags[`revealed:${o.key}`] = true;
    new MapBuilder(this, this.s).refreshObject(o);
    this.fx.anim('stasis', o.x, o.y - 16, o.y + 2, 0.6, 0xffe066);
    if (o.def.effects && o.def.kind === 'examine' && o.def.hidden && !o.def.text) this.handleSignals(applyEffects(this.s, o.def.effects, RULES));
  }

  private nearestEnemy(range: number): Enemy | null {
    let best: Enemy | null = null, bd = range;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d <= bd) { bd = d; best = e; }
    }
    return best;
  }

  private findInCone(list: IObj[], aim: { x: number; y: number }, range: number, cone = 0.6, losWater = false): IObj | null {
    const p = this.player;
    const ang = Math.atan2(aim.y, aim.x);
    let best: IObj | null = null, bs = Infinity;
    for (const o of list) {
      if (!o.revealed) continue;
      const dx = o.x - p.x, dy = o.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range || d < 4) continue;
      const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang));
      if (da > cone) continue;
      if (!this.grid.lineOfSight(p.x, p.y - 8, o.x, o.y - 8, losWater)) continue;
      const score = d + da * 120;
      if (score < bs) { bs = score; best = o; }
    }
    return best;
  }

  private grapple(aim: { x: number; y: number }, forced?: IObj): void {
    const ab = ABILITIES.grapple;
    const p = this.player;
    const posts = [...this.built!.objects.values()].filter((o) => o.def.kind === 'grapple');
    const o = forced ?? this.findInCone(posts, aim, ab.range ?? 200, 0.7);
    if (!this.spendEnergy(ab.energy)) return;
    this.abilityCd = ab.cooldown;
    session.audio.play('grapple');
    const ang = Math.atan2(aim.y, aim.x);
    if (!o || !o.def.landing) {
      // feedback: the hook flies to max range and returns
      const ex = p.x + Math.cos(ang) * (ab.range ?? 200), ey = p.y - 20 + Math.sin(ang) * (ab.range ?? 200);
      this.drawRope(ex, ey);
      this.time.delayedCall(220, () => this.rope.clear());
      this.ui.toast('Sem poste de ancoragem ao alcance nessa direcção.', 1400);
      return;
    }
    const land = { x: o.def.landing.x * TILE, y: o.def.landing.y * TILE };
    const safe = this.grid.findStandable(land.x, land.y, 2);
    if (!safe) return;
    this.grappleTo = { x: safe.x, y: safe.y, t: 0, fromX: p.x, fromY: p.y };
    p.body.airborne = true;
    p.force('jump');
    p.dir = facingFor(o.x - p.x, o.y - p.y, p.dir);
    this.drawRope(o.x, o.y - 30);
    record(this.s, 'portals', `grapple:${o.def.id}`);
  }

  private drawRope(x: number, y: number): void {
    this.rope.clear();
    this.rope.lineStyle(2, 0xffd84a, 1);
    this.rope.lineBetween(this.player.x, this.player.y - 24, x, y);
  }

  private pushBlock(o: IObj, d: Dir): boolean {
    const v = dirVector(d);
    const tx = Math.floor(o.x / TILE) + v.x, ty = Math.floor((o.y - 4) / TILE) + v.y;
    const grid = this.grid;
    if (!grid.pathable(tx, ty)) return false;
    const nx = tx * TILE + TILE / 2, ny = ty * TILE + TILE - 2;
    for (const r of grid.rectsNear(nx - 14, ny - 20, nx + 14, ny)) {
      if (r.id === o.solidId) continue;
      if (nx + 14 > r.x && nx - 14 < r.x + r.w && ny > r.y && ny - 20 < r.y + r.h) return false;
    }
    for (const a of [this.player, this.companion]) if (a && Math.hypot(a.x - nx, a.y - ny) < 18) return false;
    o.x = nx;
    o.y = ny;
    grid.moveRect(o.solidId!, nx - 15, ny - 22);
    this.s.objectPos[o.key] = { x: nx / TILE, y: ny / TILE };
    if (o.sprite) this.tweens.add({ targets: o.sprite, x: nx, y: ny, duration: 160 });
    o.sprite?.setDepth(ny);
    session.audio.play('close');
    return true;
  }

  // ------------------------------------------------------------ interact
  private candidates(): Interactive[] {
    const out: Interactive[] = [];
    for (const n of this.npcs) out.push({ kind: 'npc', id: n.id, x: n.actor.x, y: n.actor.y, label: `Falar com ${CHARACTERS[n.def.character]?.name ?? n.def.character}` });
    for (const o of this.built!.objects.values()) {
      if (!o.revealed || o.def.kind === 'plate') continue;
      if (o.def.kind === 'pickup' && o.state === 'taken') continue;
      if (o.def.kind === 'grapple' && !(this.s.character === 'mabel' && this.s.abilities.includes('grapple'))) continue;
      out.push({ kind: 'obj', id: o.def.id, x: o.x, y: o.y, label: o.def.label ?? LABELS[o.def.kind] ?? 'Examinar' });
    }
    for (const e of this.enemies) if (e.alive && e.def.dialogue) out.push({ kind: 'enemy', id: e.id, x: e.x, y: e.y, label: `Falar com ${e.type.name}` });
    return out;
  }

  private pickTarget(): Interactive | null {
    const p = this.player;
    const f = dirVector(p.dir);
    const px = p.x + f.x * 16, py = p.y + f.y * 12;
    let best: Interactive | null = null, bd = Infinity;
    for (const c of this.candidates()) {
      const range = c.kind === 'obj' && this.built!.objects.get(c.id)?.def.kind === 'grapple' ? (ABILITIES.grapple.range ?? 200) : 36;
      const d = Math.hypot(c.x - px, c.y - py);
      const dFeet = Math.hypot(c.x - p.x, c.y - p.y);
      if (dFeet > range + 24 || d > range) continue;
      const obj = c.kind === 'obj' ? this.built!.objects.get(c.id) : null;
      if (obj?.def.facing) {
        const dot = ((c.x - p.x) * f.x + (c.y - p.y) * f.y) / (dFeet || 1);
        if (dot < 0.4) continue;
      }
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  private interact(): void {
    const t = this.target ?? this.pickTarget();
    if (!t) return;
    const p = this.player;
    p.dir = facingFor(t.x - p.x, t.y - p.y, p.dir);
    if (t.kind === 'npc') {
      const n = this.npcs.find((x) => x.id === t.id);
      if (!n) return;
      n.faceTowards(p.x, p.y);
      n.talking = true;
      this.talk(n.def.dialogue, () => { n.talking = false; });
      return;
    }
    if (t.kind === 'enemy') {
      const e = this.enemies.find((x) => x.id === t.id);
      if (e?.def.dialogue) this.talk(e.def.dialogue, () => {
        if (this.s.flags[`pacified:${e.id}`]) e.pacify();
      });
      return;
    }
    const o = this.built!.objects.get(t.id);
    if (o) this.useObject(o);
  }

  talk(dialogueId: string, done?: () => void): void {
    const def = DIALOGUES[dialogueId];
    if (!def) {
      this.ui.toast(`Diálogo em falta: ${dialogueId}`);
      return;
    }
    const r = new DialogueRunner(def, this.s, RULES);
    if (!r.start()) {
      done?.();
      return;
    }
    this.player.force('dialogue');
    this.combat.clearTeam('enemy');
    let hadChoice = false;
    const origChoose = r.choose.bind(r);
    r.choose = (i: number) => { hadChoice = true; return origChoose(i); };
    this.handleSignals(r.signals.splice(0));
    this.ui.openDialogue(r, () => {
      this.player.force('idle');
      this.handleSignals(r.signals.splice(0));
      if (hadChoice) this.autosave();
      done?.();
    });
  }

  private say(speaker: string, text: string, effects?: Effect[], done?: () => void): void {
    const def: DialogueDef = { id: '_inline', entries: [{ start: 'a' }], nodes: { a: { id: 'a', speaker, text, effects } } };
    const r = new DialogueRunner(def, this.s, RULES);
    r.start();
    this.player.force('dialogue');
    this.handleSignals(r.signals.splice(0));
    this.ui.openDialogue(r, () => {
      this.player.force('idle');
      done?.();
    });
  }

  private useObject(o: IObj): void {
    const d = o.def;
    const s = this.s;
    const name = CHARACTERS[s.character]?.name;
    if (d.character && s.character !== d.character && d.kind !== 'examine') {
      this.ui.toast(`Só ${CHARACTERS[d.character]?.name ?? d.character} consegue fazer isto. ${this.companion ? `Alterna com ${session.input.keyLabel('switch')}.` : ''}`);
      session.audio.play('deny');
      return;
    }
    const allowed = check(d.requires, s);
    const apply = (effects?: Effect[]) => this.handleSignals(applyEffects(s, effects, RULES));
    const setState = (st: string) => {
      o.state = st;
      s.objects[o.key] = st;
      new MapBuilder(this, s).refreshObject(o);
    };
    switch (d.kind) {
      case 'examine':
        session.audio.play('clue');
        this.say(name ? `${name} examina` : 'Examinar', d.text ?? '…', undefined, () => {
          if (o.state !== 'read') { setState('read'); apply(d.effects); }
        });
        return;
      case 'npcProxy':
        if (d.text) this.talk(d.text);
        return;
      case 'grapple':
        this.grapple({ x: o.x - this.player.x, y: o.y - this.player.y }, o);
        return;
    }
    if (!allowed) {
      session.audio.play('deny');
      this.say('', d.requiresText ?? 'Ainda não é possível. Talvez mais tarde.');
      return;
    }
    switch (d.kind) {
      case 'pickup':
      case 'chest':
        if ((d.kind === 'pickup' && o.state === 'taken') || (d.kind === 'chest' && o.state === 'open')) {
          this.ui.toast('Está vazio.', 1000);
          return;
        }
        setState(d.kind === 'pickup' ? 'taken' : 'open');
        session.audio.play(d.kind === 'chest' ? 'open' : 'pickup');
        if (d.item) apply([{ give: d.item }]);
        apply(d.effects);
        this.autosave();
        return;
      case 'door':
        if (o.state === 'open') return;
        setState('open');
        if (o.solidId) this.grid.removeRect(o.solidId);
        session.audio.play('open');
        apply(d.effects);
        return;
      case 'switch': {
        if (d.value === -1) {
          this.resetGroup(d.group ?? '');
          return;
        }
        setState(o.state === 'on' ? 'off' : 'on');
        session.audio.play(o.state === 'on' ? 'open' : 'close');
        if (o.state === 'on') apply(d.effects);
        this.checkCircuit(d.group);
        return;
      }
      case 'repair':
        if (o.state === 'fixed') { this.ui.toast('Já está reparado.', 1000); return; }
        setState('fixed');
        record(s, 'repaired', d.id);
        session.audio.play('puzzle');
        this.fx.anim('impact', o.x, o.y - 20, o.y + 2, 0.8, 0x7af0ff);
        apply(d.effects);
        this.autosave();
        return;
      case 'portal':
        session.audio.play('rift');
        this.fx.anim('rift', o.x, o.y - 20, o.y + 2, 1.2);
        record(s, 'portals', d.id);
        apply(d.effects);
        return;
      case 'save':
        s.hp[s.character] = s.maxHp;
        this.player.hp = s.maxHp;
        if (this.companion) s.hp[this.companion.charId] = s.maxHp;
        s.energy = s.maxEnergy;
        s.safe = { mapId: s.mapId, x: this.player.x, y: this.player.y, level: 0 };
        this.autosave(true);
        session.audio.play('confirm');
        apply(d.effects);
        return;
      case 'rift': {
        const partner = d.pair ? this.built!.objects.get(d.pair) : null;
        if (!partner) return;
        if (o.state !== 'open' && !this.spendEnergy(ABILITIES.rift.energy)) return;
        setState('open');
        s.objects[partner.key] = 'open';
        partner.state = 'open';
        new MapBuilder(this, s).refreshObject(partner);
        record(s, 'portals', `rift:${d.id}`);
        session.audio.play('rift');
        this.fx.anim('rift', o.x, o.y - 16, o.y + 2, 1);
        const dest = this.grid.findStandable(partner.x, partner.y + 18, 3);
        if (dest) {
          this.cameras.main.flash(150, 180, 120, 255);
          this.player.body.x = dest.x;
          this.player.body.y = dest.y;
          this.player.body.level = 0;
          this.fx.anim('rift', partner.x, partner.y - 16, partner.y + 2, 1);
          if (this.companion) { this.companion.body.x = dest.x; this.companion.body.y = dest.y; }
        }
        apply(d.effects);
        return;
      }
      case 'glyph':
        if (o.state === 'active') return;
        setState('active');
        session.audio.play('open');
        this.fx.anim('stasis', o.x, o.y - 10, o.y + 2, 0.7, 0xffe066);
        apply(d.effects);
        this.checkGroup(d.group, (x) => x.state === 'active');
        return;
      case 'ring': {
        if (d.group && s.flags[`${d.group}_solved`]) return;
        setState(String((Number(o.state) + 1) % 4));
        session.audio.play('ui');
        this.checkGroup(d.group, (x) => Number(x.state) === (x.def.value ?? 0));
        return;
      }
      case 'sequence': {
        const g = d.group ?? '';
        if (s.flags[`${g}_solved`]) return;
        const next = (this.seqProgress.get(g) ?? 0) + 1;
        if (d.value === next) {
          this.seqProgress.set(g, next);
          setState('lit');
          session.audio.play('confirm');
          const total = [...this.built!.objects.values()].filter((x) => x.def.group === g && x.def.kind === 'sequence').length;
          if (next >= total) this.solveGroup(g);
        } else {
          // wrong order: everything resets, nothing is lost
          this.seqProgress.set(g, 0);
          for (const x of this.built!.objects.values()) if (x.def.group === g && x.def.kind === 'sequence') { x.state = 'idle'; s.objects[x.key] = 'idle'; new MapBuilder(this, s).refreshObject(x); }
          session.audio.play('deny');
          this.ui.toast('A sequência reiniciou. Revê a pista no diário.', 1800);
        }
        return;
      }
      case 'push': {
        if (!this.pushBlock(o, this.player.dir)) this.ui.toast('Não há espaço para empurrar nessa direcção.', 1200);
        return;
      }
    }
  }

  private checkGroup(group: string | undefined, solved: (o: IObj) => boolean): void {
    if (!group || this.s.flags[`${group}_solved`]) return;
    const members = [...this.built!.objects.values()].filter((x) => x.def.group === group && x.def.kind !== 'switch');
    if (members.length && members.every(solved)) this.solveGroup(group);
  }

  private solveGroup(group: string): void {
    this.s.flags[`${group}_solved`] = true;
    session.audio.play('puzzle');
    this.fx.flash(0xffe066, 150);
    const first = [...this.built!.objects.values()].find((x) => x.def.group === group && x.def.effects);
    // group effects live on the member flagged with value 0 or the first one listed
    const owner = [...this.built!.objects.values()].find((x) => x.def.group === group && x.def.kind === 'examine') ?? first;
    if (owner?.def.effects) this.handleSignals(applyEffects(this.s, owner.def.effects, RULES));
    this.handleSignals(updateQuests(this.s, RULES));
    this.ui.toast('Mecanismo resolvido!');
    this.autosave();
  }

  /** Lights-out style circuit: each switch toggles a bitmask of lamps; solved when all lamps are on. */
  private checkCircuit(group?: string): void {
    if (!group || this.s.flags[`${group}_solved`]) return;
    const objs = [...this.built!.objects.values()].filter((x) => x.def.group === group);
    const lamps = objs.filter((x) => x.def.kind === 'repair' || x.def.kind === 'examine').length;
    const switches = objs.filter((x) => x.def.kind === 'switch' && (x.def.value ?? 0) > 0);
    if (!switches.length || !lamps) return;
    let mask = 0;
    for (const sw of switches) if (sw.state === 'on') mask ^= sw.def.value ?? 0;
    const full = (1 << lamps) - 1;
    this.ui.toast(`Circuito: ${[...Array(lamps)].map((_, i) => (mask >> i) & 1 ? '●' : '○').join(' ')}`, 1400);
    if (mask === full) this.solveGroup(group);
  }

  private resetGroup(group: string): void {
    if (this.s.flags[`${group}_solved`]) {
      this.ui.toast('Este mecanismo já está resolvido.', 1200);
      return;
    }
    for (const o of this.built!.objects.values()) {
      if (o.def.group !== group) continue;
      if (o.def.kind === 'push') {
        delete this.s.objectPos[o.key];
        o.x = o.def.x * TILE;
        o.y = o.def.y * TILE;
        this.grid.moveRect(o.solidId!, o.x - 15, o.y - 22);
        o.sprite?.setPosition(o.x, o.y).setDepth(o.y);
      }
      if (o.def.kind === 'switch' && (o.def.value ?? 0) > 0) { o.state = 'off'; this.s.objects[o.key] = 'off'; new MapBuilder(this, this.s).refreshObject(o); }
    }
    session.audio.play('close');
    this.ui.toast('Mecanismo reposto.', 1200);
  }

  private updatePlates(): void {
    const objs = this.built!.objects;
    const groups = new Set<string>();
    for (const o of objs.values()) {
      if (o.def.kind !== 'plate') continue;
      const weights = [this.player, this.companion].filter(Boolean).map((a) => ({ x: a!.x, y: a!.y, air: a!.body.airborne }));
      for (const b of objs.values()) if (b.def.kind === 'push') weights.push({ x: b.x, y: b.y, air: false });
      const down = weights.some((w) => !w.air && Math.abs(w.x - o.x) < 16 && Math.abs(w.y - o.y) < 14);
      const st = down ? 'down' : 'up';
      if (st !== o.state) {
        o.state = st;
        new MapBuilder(this, this.s).refreshObject(o);
        session.audio.play(down ? 'open' : 'close');
      }
      if (o.def.group) groups.add(o.def.group);
    }
    for (const g of groups) this.checkGroup(g, (x) => x.def.kind !== 'plate' || x.state === 'down');
  }

  // ----------------------------------------------------- companion / party
  private switchCharacter(): void {
    if (!this.companion) return;
    const s = this.s;
    const old = this.player;
    const next = this.companion;
    // the character left behind keeps holding a pressure plate if standing on one
    const onPlate = [...this.built!.objects.values()].some((o) => o.def.kind === 'plate' && Math.abs(old.x - o.x) < 16 && Math.abs(old.y - o.y) < 14);
    s.hp[old.charId] = old.hp;
    this.player = next;
    this.companion = old;
    this.companionHold = onPlate;
    old.force('idle');
    next.force('idle');
    s.character = next.charId;
    this.cameras.main.startFollow(this.player.sprite, true, 0.14, 0.14, 0, 20);
    this.fx.anim('stasis', next.x, next.y - 30, next.y + 2, 0.6, 0xffffff);
    session.audio.play('confirm');
    this.ui.toast(`A controlar: ${CHARACTERS[next.charId].name}${onPlate ? ` (${CHARACTERS[old.charId].name} fica na placa)` : ''}`, 1500);
    this.compPath = [];
  }

  private updateCompanion(dt: number, blocked: boolean): void {
    const c = this.companion;
    if (!c) return;
    c.update(dt);
    const p = this.player;
    const grid = this.grid;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (blocked || this.companionHold || p.state === 'downed') {
      c.force(grid.tileAtPx(c.x, c.y - 4).water === 'deep' ? 'swim' : 'idle');
      c.playFor();
      c.sync();
      return;
    }
    if (d < 40) {
      this.compStuck = 0;
      c.force(grid.tileAtPx(c.x, c.y - 4).water === 'deep' ? 'swim' : 'idle');
      c.playFor();
      c.sync();
      return;
    }
    let tx = p.x, ty = p.y;
    if (!grid.lineOfSight(c.x, c.y - 6, p.x, p.y - 6) || d > 160) {
      this.compRepath -= dt;
      if (this.compRepath <= 0) {
        this.compRepath = 0.4;
        this.compPath = findPath(grid, c.tileX, c.tileY, p.tileX, p.tileY, { canSwim: true, maxNodes: 3000 }) ?? [];
      }
      const n = this.compPath[0];
      if (n) {
        const cc = tileCenter(n);
        tx = cc.x;
        ty = cc.y;
        if (Math.hypot(cc.x - c.x, cc.y - c.y) < 6) this.compPath.shift();
      }
    }
    const tile = grid.tileAtPx(c.x, c.y - 4);
    const deep = tile.water === 'deep' && c.body.level === 0;
    const ch = CHARACTERS[c.charId];
    const speed = deep ? 62 : d > 110 ? ch?.runSpeed ?? 150 : ch?.walkSpeed ?? 90;
    const dx = tx - c.x, dy = ty - c.y, dd = Math.hypot(dx, dy) || 1;
    const before = { x: c.x, y: c.y };
    c.moveBy(grid, (dx / dd) * speed * dt, (dy / dd) * speed * dt);
    const moved = Math.hypot(c.x - before.x, c.y - before.y);
    this.compStuck = moved < speed * dt * 0.2 ? this.compStuck + dt : 0;
    c.dir = facingFor(dx, dy, c.dir);
    c.force(deep ? 'swim' : speed > (ch?.walkSpeed ?? 90) ? 'run' : 'walk');
    c.sprite.anims.timeScale = deep ? 1 : animRate(moved / dt, speed);
    // unreachable (player jumped/grappled across) or far behind: regroup on a valid tile near the player
    if ((this.compStuck > 3 || d > 480) && !p.body.airborne && !this.grappleTo) {
      const back = dirVector(p.dir);
      const spot = grid.findStandable(p.x - back.x * 28, p.y - back.y * 28, 3);
      if (spot) {
        c.body.x = spot.x;
        c.body.y = spot.y;
        c.body.level = p.body.level;
        this.fx.anim('stasis', spot.x, spot.y - 20, spot.y + 1, 0.5, 0xffffff);
      }
      this.compStuck = 0;
      this.compPath = [];
    }
    c.playFor();
    c.sync();
  }

  // --------------------------------------------------------- damage / defeat
  private targets(): Target[] {
    const out: Target[] = [];
    const p = this.player;
    if (!p || !this.built) return out;
    out.push({
      id: 'player', team: 'player', x: p.x, y: p.y, z: p.z, radius: p.body.hw,
      vulnerable: () => p.invuln <= 0 && p.state !== 'downed' && p.state !== 'dialogue' && p.state !== 'transition',
      hit: (dmg, fx, fy, src) => this.damagePlayer(dmg, fx, fy, src),
      detain: () => this.detain(),
    });
    for (const e of this.enemies) if (e.alive) out.push(e);
    return out;
  }

  damagePlayer(dmg: number, fromX: number, fromY: number, _src: string, knock = true): void {
    const p = this.player;
    if (p.invuln > 0 && knock) return;
    p.hp = Math.max(0, p.hp - dmg);
    this.s.hp[p.charId] = p.hp;
    p.invuln = 1.0;
    session.audio.play('hurt');
    this.fx.shake(0.006, 140);
    this.fx.text(p.x, p.y - 60, `-${dmg}`, '#ff8080');
    if (p.hp <= 0) {
      p.force('downed');
      this.downedT = 0;
      this.combat.clearTeam('enemy');
      p.playFor(true);
      return;
    }
    if (knock) {
      const d = Math.hypot(p.x - fromX, p.y - fromY) || 1;
      this.dodgeV = { x: ((p.x - fromX) / d) * 160, y: ((p.y - fromY) / d) * 160 };
      p.body.airborne = false;
      p.z = 0;
      p.force('hurt', 0.3);
    }
  }

  private detain(): void {
    this.ui.toast('Um agente do tempo colocou-te em estase. Voltaste ao último ponto de controlo.');
    session.audio.play('stasis');
    this.fx.anim('stasis', this.player.x, this.player.y - 30, this.player.y + 2, 1);
    record(this.s, 'sacrificed', 'tempo perdido em estase');
    this.s.vars.timeDebt = Math.min(20, this.s.vars.timeDebt + 1);
    this.respawnAtSafe();
  }

  private respawnAtSafe(): void {
    const s = this.s;
    if (s.safe.mapId !== s.mapId) {
      s.pos = { x: s.safe.x, y: s.safe.y, level: 0, dir: 'south' };
      this.transition(s.safe.mapId);
      return;
    }
    const spot = this.grid.findStandable(s.safe.x, s.safe.y) ?? this.lastGround;
    this.player.body.x = spot.x;
    this.player.body.y = spot.y;
    this.player.body.level = 0;
    if (this.companion) { this.companion.body.x = spot.x; this.companion.body.y = spot.y; }
  }

  private defeatScreen(): void {
    // combat defeat is not a narrative ending: retry from the last checkpoint
    this.s.deaths++;
    this.ui.banner('Derrotado', 'A derrota em combate não muda a história.\nRegressas ao último ponto de controlo com a vida recuperada.', 0, () => {
      const s = this.s;
      for (const c of s.party) s.hp[c] = s.maxHp;
      this.player.hp = s.maxHp;
      this.player.force('idle');
      this.player.invuln = 1.5;
      s.energy = s.maxEnergy;
      this.respawnAtSafe();
    });
  }

  onDefeated(e: Enemy): void {
    if (!this.s.defeated.includes(e.id)) this.s.defeated.push(e.id);
    this.handleSignals(updateQuests(this.s, RULES));
    if (e.ai === 'calm') this.s.flags[`pacified:${e.id}`] = true;
    if (e.def.type === 'time_baby' || e.def.type === 'bola8') this.autosave();
  }

  playerPos() {
    const p = this.player;
    return { x: p.x, y: p.y, z: p.z, level: p.body.level };
  }

  playSfx(name: string): void {
    session.audio.play(name as never);
  }

  // --------------------------------------------------------- triggers/exits
  private checkTriggers(dt: number): void {
    const p = this.player;
    const tx = p.x / TILE, ty = (p.y - 2) / TILE;
    for (const t of this.built!.triggers) {
      if (tx < t.x || ty < t.y || tx >= t.x + t.w || ty >= t.y + t.h) continue;
      const key = `trig:${this.s.mapId}/${t.id}`;
      if (t.once && this.s.flags[key]) continue;
      if (!check(t.if, this.s)) continue;
      if (t.hazard) {
        if (p.invuln <= 0 && !p.body.airborne) this.damagePlayer(1, p.x, p.y - 10, t.hazard);
        continue;
      }
      if (t.once) this.s.flags[key] = true;
      this.handleSignals(applyEffects(this.s, t.effects, RULES));
      if (t.dialogue) this.talk(t.dialogue);
      break;
    }
    void dt;
  }

  private checkExits(): void {
    const p = this.player;
    if (p.body.airborne || this.grappleTo) return;
    const tx = p.x / TILE, ty = (p.y - 2) / TILE;
    let inside = '';
    for (const e of this.built!.exits) {
      if (tx < e.x || ty < e.y || tx >= e.x + e.w || ty >= e.y + e.h) continue;
      inside = e.id;
      if (!check(e.requires, this.s)) {
        if (this.exitBlockedShown !== e.id) {
          this.exitBlockedShown = e.id;
          session.audio.play('deny');
          this.say('', e.lockedText ?? 'Por aqui ainda não.');
          // step back out of the exit so the message is not repeated
          const back = dirVector(p.dir);
          p.moveBy(this.grid, -back.x * 10, -back.y * 10);
        }
        return;
      }
      if (!MAPS[e.to]) {
        this.ui.toast(`Destino em falta: ${e.to}`);
        return;
      }
      this.transition(e.to, e.spawn);
      return;
    }
    if (!inside) this.exitBlockedShown = '';
  }

  transition(mapId: string, spawn?: string): void {
    if (this.busy) return;
    if (!this.built || !this.player) {
      this.loadArea(mapId, spawn);
      return;
    }
    this.busy = true;
    this.player.force('transition');
    session.audio.play('transition');
    this.combat.clearAll();
    this.syncState();
    if (spawn) this.s.pos = { x: -1, y: -1, level: 0, dir: this.player.dir };
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.s.mapId = mapId;
      this.loadArea(mapId, spawn);
    });
  }

  // -------------------------------------------------------------- signals
  handleSignals(signals: Signal[]): void {
    for (const sg of signals) {
      switch (sg.type) {
        case 'toast': this.ui.toast(sg.text); break;
        case 'questStarted': this.ui.toast(`Nova missão: ${QUESTS[sg.id]?.title ?? sg.id}`); session.audio.play('clue'); break;
        case 'questStep': session.audio.play('confirm'); this.ui.toast(`Objectivo actualizado: ${QUESTS[sg.id]?.steps[sg.step]?.text ?? ''}`, 3200); break;
        case 'questDone': this.ui.toast(`Missão concluída: ${QUESTS[sg.id]?.title ?? sg.id}`); session.audio.play('puzzle'); this.autosave(); break;
        case 'questFailed': this.ui.toast(`Missão falhada: ${QUESTS[sg.id]?.title ?? sg.id}`); break;
        case 'unlock': this.ui.toast(`Nova capacidade: ${ABILITIES[sg.ability]?.name ?? sg.ability}`, 3500); session.audio.play('puzzle'); break;
        case 'item': this.ui.toast(`Obtido: ${ITEMS[sg.id]?.name ?? sg.id}${sg.count > 1 ? ` ×${sg.count}` : ''}`); break;
        case 'checkpoint': this.s.safe = { mapId: this.s.mapId, x: this.player.x, y: this.player.y, level: 0 }; this.autosave(); break;
        case 'objectChanged': this.refreshObjectByKey(sg.key, sg.state); break;
        case 'party': this.spawnCompanion(); break;
        case 'teleport': this.time.delayedCall(10, () => this.transition(sg.map, sg.spawn)); break;
        case 'ending': this.time.delayedCall(30, () => this.showEnding(sg.arc, sg.id)); break;
        case 'arc2': break;
      }
    }
  }

  private refreshObjectByKey(key: string, st: string): void {
    if (!this.built) return;
    for (const o of this.built.objects.values()) {
      if (o.key !== key) continue;
      o.state = st;
      if (o.def.kind === 'door' && st === 'open' && o.solidId) this.grid.removeRect(o.solidId);
      new MapBuilder(this, this.s).refreshObject(o);
    }
  }

  private showEnding(arc: 1 | 2, id: string): void {
    const rules = arc === 1 ? RULES.endings.arc1 : RULES.endings.arc2;
    const o = rules.outcomes.find((x) => x.id === id)!;
    const score = evaluateEnding(rules, this.s);
    const vars = endingVariations(rules, this.s);
    const why = score.reasons.length ? `\nPorque: ${score.reasons.join('; ')}.` : '';
    this.autosave();
    this.ui.banner(o.title, `${o.text}${vars.length ? '\n' + vars.join('\n') : ''}${why}`, 0, () => {
      if (arc === 1) {
        this.ui.banner('Arco 2 — Dipper e Mabel', 'Trinta anos depois, em Gravity Falls, os gémeos Pines chegam à Cabana do Mistério.\nO que Bill fez em Euclydia vai pesar neste Verão.', 0, () => {
          this.handleSignals(applyEffects(this.s, [{ startArc2: true }], RULES));
          this.s.pos = { x: -1, y: -1, level: 0, dir: 'south' };
          this.transition('shack_exterior', 'default');
        });
      } else {
        this.s.flags.game_complete = true;
        this.autosave();
        this.ui.banner('Fim', 'Obrigado por jogar.\nPodes continuar a explorar ou começar de novo para descobrir outros desfechos.', 0);
      }
    });
  }

  // ------------------------------------------------------------- persistence
  private syncState(): void {
    const s = this.s;
    const p = this.player;
    if (!p) return;
    if (!p.body.airborne && !this.grappleTo) s.pos = { x: p.x, y: p.y, level: p.body.level, dir: p.dir };
    s.hp[p.charId] = p.hp;
    if (this.companion) s.hp[this.companion.charId] = this.companion.hp;
    // progressive map discovery in 4x4 tile chunks
    const chunk = Math.floor(p.tileY / 4) * 64 + Math.floor(p.tileX / 4);
    const ex = (s.explored[s.mapId] ??= []);
    const around = [chunk, chunk - 1, chunk + 1, chunk - 64, chunk + 64];
    for (const c of around) if (c >= 0 && !ex.includes(c)) ex.push(c);
  }

  autosave(force = false): void {
    if (!this.built) return;
    this.syncState();
    try {
      session.saves.write(session.slot, this.s, this.built.def.name);
      if (force) this.ui.toast(`Progresso gravado (ranhura ${session.slot}).`);
    } catch (e) {
      this.ui.toast(`Não foi possível gravar: ${(e as Error).message}`);
    }
  }

  // UiHost
  gameState() { return this.s; }
  currentMap() { return this.built!.def; }
  saveSlot(slot: number): void {
    session.slot = slot;
    session.settings.lastSlot = slot;
    session.saveSettings();
    this.autosave(true);
  }
  loadSlot(slot: number): void {
    const f = session.saves.read(slot);
    if (!f) return;
    session.state = f.state;
    session.slot = slot;
    this.transition(f.state.mapId);
  }
  quit(): void {
    this.cleanup();
    this.ui.showHud(false);
    this.ui.setHost(null);
    this.scene.start('menu');
  }
  useItem(id: string): void {
    const it = ITEMS[id];
    if (!it?.use || !(this.s.inventory[id] > 0)) return;
    this.handleSignals(applyEffects(this.s, [...it.use, { take: id }], RULES));
    this.player.hp = this.s.hp[this.s.character] ?? this.player.hp;
    session.audio.play('pickup');
  }
  onClose(): void {}
  onDialogueSignals(r: DialogueRunner): void {
    this.handleSignals(r.signals.splice(0));
  }

  // ---------------------------------------------------------------- render
  private render(dt: number): void {
    const p = this.player;
    p.sync();
    // depth-sorted fading of tall props the player walks behind
    const pb = p.sprite.getBounds();
    for (const f of this.built!.fades) {
      const behind = (p.y < f.baseY && Phaser.Geom.Intersects.RectangleToRectangle(pb, f.bounds) && Math.abs(p.x - (f.bounds.centerX)) < f.bounds.width / 2 + 4)
        || (f.baseY === Infinity && Phaser.Geom.Intersects.RectangleToRectangle(pb, f.bounds));
      const target = behind ? (f.baseY === Infinity ? 0.35 : 0.6) : 1;
      f.alpha += (target - f.alpha) * Math.min(1, dt * 10);
      f.img.setAlpha(f.alpha);
    }
    // interaction highlight and prompt
    if (!this.ui.blocking && isLocomotion(p.state)) {
      this.target = this.pickTarget();
    } else this.target = null;
    if (this.target) {
      const obj = this.target.kind === 'obj' ? this.built!.objects.get(this.target.id) : null;
      const h = obj?.sprite ? obj.sprite.displayHeight : this.target.kind === 'obj' ? 20 : 70;
      this.marker.setVisible(true).setPosition(this.target.x, this.target.y - h - 8);
      if (!this.marker.getData('bob')) this.marker.y = this.target.y - h - 8;
      this.ui.prompt(this.target.label);
    } else {
      this.marker.setVisible(false);
      this.ui.prompt(null);
    }
    if (this.grappleTo) this.drawRope(this.grappleTo.x, this.grappleTo.y - 30);
    const sel = this.selectedAbility();
    const quest = this.currentObjective();
    this.ui.updateHud(this.s, this.built!.def.name, quest, sel);
    const touchVisible = session.touchVisible() && !this.ui.blocking;
    this.ui.touch.update({
      visible: touchVisible,
      ability: !!sel,
      cycle: this.abilitiesFor(this.s.character).length > 1,
      party: !!this.companion,
      interact: this.target ? this.target.label.split(' ')[0] : null,
      jump: isLocomotion(p.state) && p.state !== 'swim' && p.state !== 'climb',
      dodge: this.dodgeCd <= 0,
      abilityIcon: sel ? ABILITY_ICONS[sel] ?? '◈' : '◈',
    });
    this.drawDebug();
  }

  private currentObjective(): string {
    const s = this.s;
    const quests = Object.entries(s.quests).filter(([id, q]) => q.state === 'active' && QUESTS[id]?.arc === s.arc);
    quests.sort((a, b) => Number(QUESTS[b[0]].main) - Number(QUESTS[a[0]].main));
    const [id, q] = quests[0] ?? [];
    if (!id) return '';
    return `★ ${QUESTS[id].steps[q.step]?.text ?? QUESTS[id].title}`;
  }

  private drawDebug(): void {
    const g = this.debugGfx;
    g.clear();
    this.debugText.setVisible(session.debug);
    if (!session.debug || !this.built) return;
    const grid = this.grid;
    const v = this.cameras.main.worldView;
    for (let ty = Math.max(0, Math.floor(v.y / TILE)); ty <= Math.min(grid.h - 1, Math.ceil(v.bottom / TILE)); ty++) {
      for (let tx = Math.max(0, Math.floor(v.x / TILE)); tx <= Math.min(grid.w - 1, Math.ceil(v.right / TILE)); tx++) {
        const t = grid.tile(tx, ty);
        let col = -1;
        if (t.climb) col = 0x00ff88;
        else if (t.solid) col = 0xff0000;
        else if (t.pit) col = 0x8000ff;
        else if (t.bridge) col = 0xffaa00;
        else if (t.water === 'deep') col = 0x0040ff;
        else if (t.water === 'shallow') col = 0x00c0ff;
        if (col >= 0) { g.lineStyle(1, col, 0.6); g.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2); }
      }
    }
    for (const r of grid.allRects()) { g.lineStyle(1, r.jumpable ? 0xffff00 : 0xff8000, 0.9); g.strokeRect(r.x, r.y, r.w, r.h); }
    for (const a of [this.player, this.companion, ...this.npcs.map((n) => n.actor)]) {
      if (!a) continue;
      g.lineStyle(1, 0x00ff00, 1);
      g.strokeRect(a.x - a.body.hw, a.y - a.body.hh * 2, a.body.hw * 2, a.body.hh * 2);
      const hb = a.hurtbox();
      g.lineStyle(1, 0xff00ff, 0.6);
      g.strokeRect(hb.x, hb.y, hb.width, hb.height);
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      g.lineStyle(1, 0xff00ff, 0.8);
      const hb = e.hurtbox();
      g.strokeRect(hb.x, hb.y, hb.width, hb.height);
      g.lineStyle(1, 0xff4040, 0.25);
      g.strokeCircle(e.x, e.y, e.type.aggro);
      g.lineStyle(1, 0x00ff00, 1);
      g.strokeRect(e.x - e.body.hw, e.y - e.body.hh * 2, e.body.hw * 2, e.body.hh * 2);
    }
    for (const o of this.built.objects.values()) { g.lineStyle(1, 0xffff00, 0.8); g.strokeCircle(o.x, o.y, 36); }
    for (const e of this.built.exits) { g.lineStyle(2, 0xffffff, 0.9); g.strokeRect(e.x * TILE, e.y * TILE, e.w * TILE, e.h * TILE); }
    for (const t of this.built.triggers) { g.lineStyle(1, t.hazard ? 0xff2020 : 0xb060ff, 0.8); g.strokeRect(t.x * TILE, t.y * TILE, t.w * TILE, t.h * TILE); }
    for (const sp of Object.values(this.built.def.spawns)) { g.lineStyle(2, 0x00ffff, 1); g.lineBetween(sp.x * TILE - 5, sp.y * TILE, sp.x * TILE + 5, sp.y * TILE); g.lineBetween(sp.x * TILE, sp.y * TILE - 5, sp.x * TILE, sp.y * TILE + 5); }
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / (this.fpsSamples.length || 1);
    this.debugText.setText([
      `fps ${(1000 / avg).toFixed(0)}  map ${this.built.def.id}`,
      `pos ${this.player.x.toFixed(0)},${this.player.y.toFixed(0)} tile ${this.player.tileX},${this.player.tileY} lvl ${this.player.body.level} z ${this.player.z.toFixed(0)}`,
      `state ${this.player.state} dir ${this.player.dir} speed ${this.player.speedNow.toFixed(0)}`,
      `fx ${this.fx.activeCount} proj ${this.combat.activeProjectiles} hazards ${this.combat.hazards.length} enemies ${this.enemies.filter((e) => e.alive).length}`,
    ].join('\n')).setScale(1 / this.cameras.main.zoom);
  }

  private exposeDebug(): void {
    (window as unknown as { __gf: unknown }).__gf = {
      scene: this,
      session,
      state: () => this.s,
      teleport: (map: string, spawn?: string) => this.transition(map, spawn),
      place: (x: number, y: number) => { this.player.body.x = x; this.player.body.y = y; },
      newState: (arc: 1 | 2) => { session.state = createState(arc); },
      objKey,
    };
  }

  private shutdown(): void {
    this.scale.off('resize', this.onResize, this);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointermove', this.onPointerMove, this);
    this.cleanup();
    this.combat.destroy();
    this.fx.destroy();
  }
}

const LABELS: Partial<Record<string, string>> = {
  examine: 'Examinar', door: 'Abrir', switch: 'Accionar', pickup: 'Apanhar', chest: 'Abrir', push: 'Empurrar',
  repair: 'Reparar', portal: 'Activar portal', save: 'Descansar', rift: 'Abrir fenda', grapple: 'Lançar gancho',
  glyph: 'Activar glifo', ring: 'Rodar anel', sequence: 'Premir', npcProxy: 'Falar',
};

const ABILITY_ICONS: Record<string, string> = {
  perceive: '◉', telekinesis: '✋', energy_bolt: '✷', flashlight: '🔦', journal_scan: '📖', grapple: '⚓', charm: '♥',
};
