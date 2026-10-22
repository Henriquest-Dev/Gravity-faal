import Phaser from 'phaser';
import type { Grid } from '../../core/grid';
import { TILE } from '../../core/grid';
import type { MapDef } from '../../core/types';
import type { BuiltMap } from './MapBuilder';

/** Layer order above the world. Telegraphs stay above the night so danger is always readable. */
export const ATMOS_DEPTH = { fog: 1_900_000, night: 1_920_000, glow: 1_930_000, eyes: 1_940_000, vignette: 1_950_000, hazards: 1_960_000 };

export interface LightSource {
  x: number; y: number; r: number; color: number; intensity: number;
  flicker?: number; pulse?: number; seed: number; glow?: number;
  follow?: () => { x: number; y: number } | null;
  until?: number; // temporary lights (ms timestamp)
}

interface Eye { img: Phaser.GameObjects.Image; spots: { x: number; y: number }[]; next: number; open: boolean }

/** Which catalogue props emit light, and how. Offset is the fraction of the sprite height above the base. */
const PROP_LIGHTS: [RegExp, number, number, number, number][] = [
  // pattern, color, radius, intensity, height fraction
  [/nature\/lamp_post/, 0xffb45a, 96, 1, 0.82],
  [/euclydia\/lamp$/, 0xffd27a, 84, 1, 0.82],
  [/temporal\/lamp$/, 0x7af0ff, 84, 0.9, 0.85],
  [/rifts\/lantern/, 0xffb45a, 74, 1, 0.5],
  [/interiors\/floor_lamp/, 0xffcf80, 96, 1, 0.8],
  [/euclydia\/fountain/, 0x6fe8ff, 120, 0.9, 0.5],
  [/crystal_cluster|blue_crystal/, 0x6fe8ff, 74, 0.8, 0.4],
  [/pink_crystal/, 0xff7ad0, 60, 0.75, 0.4],
  [/void_portal|portal_ring/, 0xb070ff, 130, 1, 0.45],
  [/time_gate/, 0x7af0ff, 120, 1, 0.45],
  [/portal_model/, 0x7af0ff, 150, 1, 0.4],
  [/clock_tower/, 0xffd27a, 70, 0.8, 0.75],
  [/generator|control_console|time_console|terminal|time_capsule|capsule/, 0x7af0ff, 54, 0.7, 0.5],
  [/euclydia\/(a_frame_house|hex_house|dome_house|observatory)/, 0xffc66a, 70, 0.75, 0.3],
  [/nature\/cabin/, 0xffc66a, 70, 0.75, 0.35],
  [/eye_sigil/, 0xffe066, 60, 0.7, 0.5],
];

export interface AmbientConfig {
  night: number; nightColor: number; fog: number; fogColor: number; vignette: number; eyes: number; player: number;
}

/** Mood per theme; any map can override a value in its "ambient" block. */
const THEME_MOOD: Record<string, Partial<AmbientConfig>> = {
  forest: { night: 0.56, nightColor: 0x050a12, fog: 0.15, fogColor: 0x9fb4c4, eyes: 4 },
  town: { night: 0.46, nightColor: 0x090b16, fog: 0.1, fogColor: 0xa8b4c8 },
  interior: { night: 0.34, nightColor: 0x0c0705, fog: 0, vignette: 0.85 },
  cave: { night: 0.82, nightColor: 0x020203, fog: 0.08, eyes: 3 },
  bunker: { night: 0.62, nightColor: 0x02080c, fog: 0.05, fogColor: 0x7af0ff },
  workshop: { night: 0.48, nightColor: 0x0a0806, fog: 0.08 },
  euclid: { night: 0.4, nightColor: 0x140a26, fog: 0.13, fogColor: 0xc9b8ff },
  rupture: { night: 0.56, nightColor: 0x12061e, fog: 0.2, fogColor: 0xb48cff },
  nightmare: { night: 0.6, nightColor: 0x0c0418, fog: 0.22, fogColor: 0xa070ff },
  temporal: { night: 0.5, nightColor: 0x020c10, fog: 0.15, fogColor: 0x7af0ff },
};

export function ambientConfig(def: MapDef): AmbientConfig {
  const a = def.ambient ?? {};
  const mood = THEME_MOOD[def.theme] ?? {};
  const col = (c: string | undefined, d: number) => (c ? Phaser.Display.Color.HexStringToColor(c).color : d);
  return {
    night: a.night ?? mood.night ?? 0.45,
    nightColor: col(a.nightColor, mood.nightColor ?? 0x070a14),
    fog: a.fog ?? mood.fog ?? 0.12,
    fogColor: col(a.fogColor, mood.fogColor ?? 0xb8c6d8),
    vignette: a.vignette ?? mood.vignette ?? 0.75,
    eyes: a.eyes ?? mood.eyes ?? 0,
    player: a.playerLight ?? 78,
  };
}

export class Atmosphere {
  readonly lights: LightSource[] = [];
  private night: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;
  private cone: Phaser.GameObjects.Image;
  private fog: Phaser.GameObjects.TileSprite;
  private vignette: Phaser.GameObjects.Image;
  private glows: Phaser.GameObjects.Image[] = [];
  private eyes: Eye[] = [];
  private cfg: AmbientConfig;
  private coneUntil = 0;
  private coneState = { x: 0, y: 0, angle: 0, range: 140 };
  private t = 0;
  reduced = false;

  constructor(private scene: Phaser.Scene, def: MapDef, built: BuiltMap, private grid: Grid) {
    this.cfg = ambientConfig(def);
    const cam = scene.cameras.main;
    this.night = scene.add.renderTexture(0, 0, Math.ceil(cam.width / cam.zoom) + 4, Math.ceil(cam.height / cam.zoom) + 4).setOrigin(0, 0).setDepth(ATMOS_DEPTH.night);
    this.stamp = scene.make.image({ key: 'light', add: false }).setOrigin(0.5, 0.5);
    this.cone = scene.make.image({ key: 'cone', add: false }).setOrigin(0, 0.5);
    this.fog = scene.add.tileSprite(0, 0, 64, 64, 'fog').setOrigin(0, 0).setDepth(ATMOS_DEPTH.fog).setTint(this.cfg.fogColor).setAlpha(this.cfg.fog);
    this.vignette = scene.add.image(0, 0, 'vignette').setOrigin(0, 0).setDepth(ATMOS_DEPTH.vignette).setAlpha(this.cfg.vignette);
    this.collectLights(def, built);
    this.placeEyes(def);
    this.resize();
  }

  get config(): AmbientConfig {
    return this.cfg;
  }

  private add(l: Omit<LightSource, 'seed'>): LightSource {
    const full = { seed: Math.random() * 100, ...l };
    this.lights.push(full);
    return full;
  }

  private collectLights(def: MapDef, built: BuiltMap): void {
    for (const o of built.destroyables) {
      const img = o as Phaser.GameObjects.Image;
      const key = img.texture?.key ?? '';
      if (!key.startsWith('prop:')) continue;
      for (const [re, color, r, intensity, h] of PROP_LIGHTS) {
        if (!re.test(key)) continue;
        const flame = color === 0xffb45a || color === 0xffd27a || color === 0xffcf80;
        this.add({ x: img.x, y: img.y - img.displayHeight * h, r, color, intensity, flicker: flame ? 0.12 : 0, pulse: flame ? 0 : 0.08, glow: 0.4 });
        break;
      }
    }
    for (const b of built.buildings) {
      const wallY = b.img.y - (b.def.wallHeight ?? 2) * TILE + 30;
      for (const w of b.def.windows ?? []) this.add({ x: w * TILE + 16, y: wallY, r: 58, color: 0xffc66a, intensity: 0.85, flicker: 0.05, glow: 0.5 });
      if (b.def.door) this.add({ x: b.def.door.x * TILE + 16, y: b.img.y - 20, r: 70, color: 0xffb45a, intensity: 0.8, flicker: 0.08, glow: 0.3 });
    }
    for (const l of def.ambient?.lights ?? []) {
      this.add({ x: l.x * TILE, y: l.y * TILE, r: l.r ?? 90, color: Phaser.Display.Color.HexStringToColor(l.color ?? '#ffc66a').color, intensity: l.intensity ?? 1, flicker: l.flicker ?? 0, glow: 0.4 });
    }
  }

  /** Lights that follow something (player, interactables, projectiles). */
  attach(follow: () => { x: number; y: number } | null, r: number, color: number, intensity: number, extra: Partial<LightSource> = {}): LightSource {
    return this.add({ x: 0, y: 0, r, color, intensity, follow, ...extra });
  }

  remove(l: LightSource): void {
    const i = this.lights.indexOf(l);
    if (i >= 0) this.lights.splice(i, 1);
  }

  burst(x: number, y: number, r: number, color: number, ms = 400): void {
    this.add({ x, y, r, color, intensity: 1, until: this.scene.time.now + ms, glow: 0.6 });
  }

  flashlight(x: number, y: number, angle: number, range: number, ms = 450): void {
    this.coneState = { x, y, angle, range };
    this.coneUntil = this.scene.time.now + ms;
  }

  /** Eyes in the dark: only where the forest is thick, and they vanish when approached. */
  private placeEyes(def: MapDef): void {
    if (!this.cfg.eyes) return;
    const spots: { x: number; y: number }[] = [];
    const g = this.grid;
    for (let y = 2; y < g.h - 2; y++) {
      for (let x = 2; x < g.w - 2; x++) {
        const t = g.tile(x, y);
        if (!t.blocker) continue;
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !g.tile(x + dx * 2, y + dy * 2).solid);
        if (open && (x * 7 + y * 13) % 5 === 0) spots.push({ x: x * TILE + 16, y: y * TILE + 10 });
      }
    }
    if (!spots.length) return;
    for (let i = 0; i < this.cfg.eyes; i++) {
      const img = this.scene.add.image(0, 0, 'eyes').setDepth(ATMOS_DEPTH.eyes).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      this.eyes.push({ img, spots, next: this.scene.time.now + 1500 + Math.random() * 4000, open: false });
    }
    void def;
  }

  resize(): void {
    const cam = this.scene.cameras.main;
    const w = Math.ceil(cam.width / cam.zoom) + 4, h = Math.ceil(cam.height / cam.zoom) + 4;
    if (this.night.width !== w || this.night.height !== h) this.night.resize(w, h);
    this.fog.setSize(w, h);
    this.vignette.setDisplaySize(w, h);
  }

  update(dt: number, player: { x: number; y: number }): void {
    this.t += dt;
    const cam = this.scene.cameras.main;
    const v = cam.worldView;
    const ox = Math.floor(v.x) - 2, oy = Math.floor(v.y) - 2;
    const now = this.scene.time.now;
    // fog drifts with parallax
    this.fog.setPosition(ox, oy);
    this.fog.tilePositionX = ox * 0.85 + this.t * 6;
    this.fog.tilePositionY = oy * 0.85 + this.t * 2;
    this.vignette.setPosition(ox, oy);

    const rt = this.night;
    rt.setPosition(ox, oy);
    rt.clear();
    let glowIdx = 0;
    if (this.cfg.night > 0) {
      rt.fill(this.cfg.nightColor, this.cfg.night);
      for (let i = this.lights.length - 1; i >= 0; i--) {
        const l = this.lights[i];
        if (l.until && now > l.until) { this.lights.splice(i, 1); continue; }
        if (l.follow) {
          const p = l.follow();
          if (!p) continue;
          l.x = p.x; l.y = p.y;
        }
        if (l.x + l.r < v.x || l.x - l.r > v.right || l.y + l.r < v.y || l.y - l.r > v.bottom) continue;
        let k = l.intensity;
        if (l.flicker) k *= 1 - l.flicker * (0.5 + 0.5 * Math.sin(this.t * 11 + l.seed) * Math.sin(this.t * 7.3 + l.seed * 2));
        if (l.pulse) k *= 1 - l.pulse * (0.5 + 0.5 * Math.sin(this.t * 2 + l.seed));
        if (l.until) k *= Math.max(0, (l.until - now) / 400);
        this.stamp.setScale(l.r / 64).setAlpha(Math.min(1, k));
        rt.erase(this.stamp, l.x - ox, l.y - oy);
        if (l.glow && !this.reduced) {
          const g = this.glows[glowIdx] ?? this.makeGlow();
          glowIdx++;
          g.setVisible(true).setPosition(l.x, l.y).setScale((l.r * 0.8) / 64).setTint(l.color).setAlpha(l.glow * k * 0.55);
        }
      }
      if (now < this.coneUntil) {
        const c = this.coneState;
        this.cone.setRotation(c.angle).setScale(c.range / 256).setAlpha(1);
        rt.erase(this.cone, c.x - ox, c.y - oy);
        rt.erase(this.cone, c.x - ox, c.y - oy);
      }
    }
    for (let i = glowIdx; i < this.glows.length; i++) this.glows[i].setVisible(false);

    for (const e of this.eyes) {
      if (now < e.next) continue;
      if (!e.open) {
        const spot = e.spots[Math.floor(Math.random() * e.spots.length)];
        if (Math.hypot(spot.x - player.x, spot.y - player.y) < 140) { e.next = now + 800; continue; }
        e.img.setPosition(spot.x, spot.y).setAlpha(0);
        this.scene.tweens.add({ targets: e.img, alpha: 0.85, duration: 600 });
        this.scene.tweens.add({ targets: e.img, scaleY: 0.1, duration: 90, yoyo: true, delay: 1400, repeat: 1, repeatDelay: 900 });
        e.open = true;
        e.next = now + 3500 + Math.random() * 2500;
      } else {
        this.scene.tweens.add({ targets: e.img, alpha: 0, duration: 400 });
        e.open = false;
        e.next = now + 4000 + Math.random() * 7000;
      }
      // eyes close at once if the player walks up to them
    }
    for (const e of this.eyes) if (e.open && Math.hypot(e.img.x - player.x, e.img.y - player.y) < 110) { e.img.setAlpha(0); e.open = false; e.next = now + 5000; }
  }

  private makeGlow(): Phaser.GameObjects.Image {
    const g = this.scene.add.image(0, 0, 'light').setDepth(ATMOS_DEPTH.glow).setBlendMode(Phaser.BlendModes.ADD);
    this.glows.push(g);
    return g;
  }

  destroy(): void {
    for (const o of [this.night, this.fog, this.vignette, this.stamp, this.cone, ...this.glows, ...this.eyes.map((e) => e.img)]) {
      this.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.glows = [];
    this.eyes = [];
    this.lights.length = 0;
  }
}
