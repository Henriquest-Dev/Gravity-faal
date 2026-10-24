import Phaser from 'phaser';
import { SLOT_COUNT } from '../../core/save';
import { createState } from '../../core/state';
import { propKey, queueProp } from '../assets';
import { session } from '../session';
import { runeLine } from '../ui/runes';
import type { Ui } from '../ui/Ui';
import { bakeShack } from '../world/BuildingRenderer';
import type { ShackVariant } from '../world/ShackPainter';

const PINES = ['nature/pine', 'nature/pine_b'];

/**
 * Title screen: the Mystery Shack at night in the middle of the pines, fog
 * crawling over the clearing, fireflies and something watching from the
 * trees. New game, continue, slot selection, import and options.
 */
export class MenuScene extends Phaser.Scene {
  private el: HTMLElement | null = null;
  private fog: Phaser.GameObjects.TileSprite[] = [];
  private eyes: Phaser.GameObjects.Image[] = [];
  private flies: { o: Phaser.GameObjects.Image; a: number; r: number; cx: number; cy: number; s: number }[] = [];

  constructor() {
    super('menu');
  }

  preload(): void {
    for (const p of PINES) queueProp(this, p);
    queueProp(this, 'nature/lamp_post');
    queueProp(this, 'nature/mushrooms');
  }

  private paintScene(): void {
    const w = this.scale.width, h = this.scale.height;
    const zoom = Math.max(0.8, Math.min(w / 900, h / 600));
    const cam = this.cameras.main;
    const portrait = h > w;
    cam.setZoom(zoom).centerOn(portrait ? 0 : -170, -80);
    cam.setBackgroundColor('#06080b');
    const vw = w / zoom, vh = h / zoom;
    // sky: deep gradient and a pale moon behind the trees
    const sky = this.add.graphics();
    for (let i = 0; i < 24; i++) {
      const t = i / 23;
      sky.fillStyle(Phaser.Display.Color.GetColor(6 + t * 10, 8 + t * 16, 14 + t * 18), 1);
      sky.fillRect(-vw * 2, -40 - vh + (i * vh * 1.5) / 24 - 2, vw * 4, (vh * 1.5) / 24 + 4);
    }
    this.add.image(170, -230, 'light').setScale(1.6).setTint(0xc8d6ff).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.add.circle(170, -230, 22, 0xe8ecf4, 0.9);
    this.add.circle(176, -234, 20, 0x0b1018, 0.0);
    // far pines, darkest
    const pine = (x: number, y: number, sc: number, tint: number, i: number) => {
      const key = propKey(PINES[i % 2]);
      if (!this.textures.exists(key)) return;
      this.add.image(x, y, key).setOrigin(0.5, 1).setScale(sc).setTint(tint).setFlipX(i % 3 === 0);
    };
    for (let i = 0; i < 26; i++) pine(-vw / 2 - 40 + i * ((vw + 80) / 25), 40 - (i % 3) * 6, 1.05 + (i % 4) * 0.08, 0x0e1a1c, i);
    // the Shack in the clearing
    // the Shack in the clearing, in each of its versions, taking turns
    const versions: ShackVariant[] = ['normal', 'weird', 'ruined', 'rebuilt'];
    const lightsOf: Record<ShackVariant, [number, number, number][]> = {
      normal: [[-128, -91, 0.7], [19, 59, 0.9], [195, 84, 0.8], [-128, 95, 0.8]],
      weird: [[-128, -91, 0.7], [19, 59, 0.9], [195, 84, 0.8]],
      ruined: [],
      rebuilt: [[-128, -91, 0.7], [19, 59, 0.9], [195, 84, 0.8], [-128, 95, 0.8]],
    };
    this.versions = versions.map((v, i) => {
      const t = bakeShack(this, { id: 'title', x: 0, y: 0, w: 15, h: 5, style: 'shack', door: { x: 3 } }, `title:shack:${v}`, v);
      const img = this.add.image(0, 120, t.key).setOrigin(0.5, 1).setTint(0x9a9aa6).setAlpha(i === 0 ? 1 : 0);
      const glow = lightsOf[v].map(([x, y, sc]) => this.add.image(x, y, 'light').setScale(sc).setTint(v === 'weird' ? 0xff6ad0 : 0xffb54a).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD));
      return { v, img, glow };
    });
    for (const g of this.versions[0].glow) g.setAlpha(0.55);
    this.sky = this.add.rectangle(0, -40, vw * 4, vh * 5, 0xc02a80, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.time.addEvent({ delay: 7000, loop: true, callback: () => this.nextVersion() });
    if (this.textures.exists(propKey('nature/lamp_post'))) {
      this.add.image(-150, 150, propKey('nature/lamp_post')).setOrigin(0.5, 1).setTint(0x9a9080);
      this.add.image(-146, 100, 'light').setScale(1.1).setTint(0xffc060).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    }
    // ground
    const g = this.add.graphics();
    g.fillStyle(0x0d1410, 1).fillRect(-vw, 118, vw * 2, vh);
    // the worn dirt clearing in front of the porch, as in the show
    g.fillStyle(0x2c261a, 1).fillEllipse(-40, 168, 420, 80);
    g.fillStyle(0x3a3222, 1).fillEllipse(-40, 166, 330, 52);
    if (this.textures.exists(propKey('nature/mushrooms'))) {
      for (const [x, y, sc, f] of [[-vw / 2 + 70, 205, 1.4, false], [vw / 2 - 80, 190, 1.2, true], [-vw / 2 + 140, 230, 0.9, true]] as const) {
        this.add.image(x, y, propKey('nature/mushrooms')).setOrigin(0.5, 1).setScale(sc).setFlipX(f).setTint(0x8a7a80);
      }
    }
    // near pines framing the view, almost black
    for (const [x, sc, i] of [[-vw / 2 + 20, 2.3, 0], [-vw / 2 + 110, 1.9, 1], [vw / 2 - 30, 2.4, 1], [vw / 2 - 120, 1.8, 0]] as const) {
      pine(x, 220, sc, 0x050909, i);
    }
    // eyes among the far trees
    for (const [x, y] of [[-300, -10], [-230, 20], [260, 0], [330, 30], [-360, 40]] as const) {
      this.eyes.push(this.add.image(x, y, 'eyes').setScale(1.2).setAlpha(0));
    }
    // fog bands
    for (const [y, a, sc] of [[100, 0.16, 2], [150, 0.22, 3]] as const) {
      this.fog.push(this.add.tileSprite(0, y, vw * 2, 140, 'fog').setTileScale(sc).setAlpha(a).setTint(0x9fb0b8));
    }
    // fireflies
    for (let i = 0; i < 22; i++) {
      const o = this.add.image(0, 0, 'light').setScale(0.05).setTint(0xd8ff7a).setBlendMode(Phaser.BlendModes.ADD);
      this.flies.push({ o, a: Math.random() * 6.28, r: 10 + Math.random() * 30, cx: (Math.random() - 0.5) * vw, cy: 60 + Math.random() * 120, s: 0.3 + Math.random() * 0.6 });
    }
    // vignette over everything
    this.add.image(0, -40, 'vignette').setDisplaySize(vw * 1.02, vh * 1.02);
  }

  private versions: { v: ShackVariant; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image[] }[] = [];
  private shown = 0;
  private sky: Phaser.GameObjects.Rectangle | null = null;

  /** Cross-fades to the next version of the Shack; Weirdmageddon stains the sky. */
  private nextVersion(): void {
    const from = this.versions[this.shown];
    this.shown = (this.shown + 1) % this.versions.length;
    const to = this.versions[this.shown];
    this.tweens.add({ targets: [from.img, ...from.glow], alpha: 0, duration: 1800 });
    this.tweens.add({ targets: to.img, alpha: 1, duration: 1800 });
    this.tweens.add({ targets: to.glow, alpha: 0.55, duration: 1800 });
    if (this.sky) this.tweens.add({ targets: this.sky, fillAlpha: to.v === 'weird' ? 0.16 : to.v === 'ruined' ? 0.04 : 0, duration: 1800 });
  }

  update(_t: number, dms: number): void {
    const dt = dms / 1000;
    for (const [i, f] of this.fog.entries()) f.tilePositionX += dt * (6 + i * 5);
    const now = this.time.now / 1000;
    for (const f of this.flies) {
      f.a += dt * f.s;
      f.o.setPosition(f.cx + Math.cos(f.a) * f.r, f.cy + Math.sin(f.a * 1.3) * f.r * 0.5);
      f.o.setAlpha(0.4 + 0.6 * Math.max(0, Math.sin(now * 2 + f.cx)));
    }
    for (const [i, e] of this.eyes.entries()) {
      const ph = (now * 0.35 + i * 0.37) % 1;
      e.setAlpha(ph > 0.7 && ph < 0.92 && (now * 10 + i) % 7 > 0.6 ? 0.9 : 0);
    }
  }

  create(): void {
    const ui = this.registry.get('ui') as Ui;
    ui.showHud(false);
    ui.touch.update({ visible: false, ability: false, party: false, interact: null, jump: false, dodge: false, abilityIcon: '', cycle: false });
    this.fog = [];
    this.eyes = [];
    this.flies = [];
    this.versions = [];
    this.shown = 0;
    this.paintScene();
    session.audio.startMusic('title');
    session.audio.startAmbience('night');
    this.render(ui);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.el?.remove(); this.el = null; });
  }

  private render(ui: Ui): void {
    this.el?.remove();
    const el = document.createElement('div');
    el.className = 'title';
    const slots = session.saves.list();
    const latest = slots.filter((s) => s.file).sort((a, b) => (b.file!.savedAt > a.file!.savedAt ? 1 : -1))[0];
    el.innerHTML = `<h1>Gravity Falls<small>Dimensões</small></h1>
      <div class="cipher" aria-hidden="true">${runeLine('NADA E O QUE PARECE')}</div>
      <div class="menu-list">
        ${latest ? `<button data-a="continue">Continuar <small>${latest.file!.summary.mapName}, página ${latest.slot}</small></button>` : ''}
        <button data-a="new">Novo jogo</button>
        <button data-a="load">Gravações</button>
        <button data-a="options">Opções</button>
      </div>
      <p class="small">WASD mover · Shift correr · E interagir · J atacar · K capacidade · Espaço saltar · L esquivar · Q alternar · Esc pausa</p>`;
    ui.root.appendChild(el);
    this.el = el;
    el.addEventListener('pointerdown', () => session.audio.unlock());
    el.querySelector('[data-a="continue"]')?.addEventListener('click', () => this.start(latest!.slot));
    el.querySelector('[data-a="new"]')!.addEventListener('click', () => this.chooseSlot(ui));
    el.querySelector('[data-a="load"]')!.addEventListener('click', () => this.loadMenu(ui));
    el.querySelector('[data-a="options"]')!.addEventListener('click', () => this.options(ui));
  }

  private chooseSlot(ui: Ui): void {
    const slots = session.saves.list();
    const el = this.el!;
    el.querySelector('.menu-list')!.innerHTML = `<p>Em que página do diário começamos?</p>${slots.map((s) => `<button data-slot="${s.slot}">Página ${s.slot} <small>${s.file ? `${s.file.summary.mapName}, ${Math.floor(s.file.summary.playTime / 60)} min` : s.error ? 'ilegível' : 'em branco'}</small></button>`).join('')}<button data-back>Voltar</button>`;
    for (const b of el.querySelectorAll<HTMLElement>('[data-slot]')) {
      b.addEventListener('click', () => {
        const slot = Number(b.dataset.slot);
        const used = slots.find((s) => s.slot === slot)?.file;
        const go = () => this.newGame(slot);
        if (used) ui.confirm(`A ranhura ${slot} tem uma gravação. Substituir por um jogo novo?`, go);
        else go();
      });
    }
    el.querySelector('[data-back]')!.addEventListener('click', () => this.render(ui));
  }

  private loadMenu(ui: Ui): void {
    ui.titleLoad = (slot) => this.start(slot);
    ui.open('saves');
  }

  private options(ui: Ui): void {
    ui.open('options');
  }

  private newGame(slot: number): void {
    session.state = createState(1);
    session.slot = slot;
    session.settings.lastSlot = slot;
    session.saveSettings();
    session.saves.write(slot, session.state, 'Praça de Euclydia');
    // the arc opens with its own cutscene in the plaza
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('world'));
  }

  private start(slot: number): void {
    try {
      const f = session.saves.read(slot);
      if (!f) return;
      session.state = f.state;
      session.slot = slot;
      session.settings.lastSlot = slot;
      session.saveSettings();
      this.scene.start('world');
    } catch (e) {
      (this.registry.get('ui') as Ui).toast((e as Error).message);
    }
  }
}

export const _slots = SLOT_COUNT;
