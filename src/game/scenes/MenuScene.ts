import Phaser from 'phaser';
import { SLOT_COUNT } from '../../core/save';
import { createState } from '../../core/state';
import { propKey, queueProp } from '../assets';
import { session } from '../session';
import type { Ui } from '../ui/Ui';
import { bakeShack } from '../world/BuildingRenderer';

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
  }

  private paintScene(): void {
    const w = this.scale.width, h = this.scale.height;
    const zoom = Math.max(1, Math.min(w / 760, h / 470));
    const cam = this.cameras.main;
    const portrait = h > w;
    cam.setZoom(zoom).centerOn(portrait ? 0 : -150, -40);
    cam.setBackgroundColor('#06080b');
    const vw = w / zoom, vh = h / zoom;
    // sky: deep gradient and a pale moon behind the trees
    const sky = this.add.graphics();
    for (let i = 0; i < 24; i++) {
      const t = i / 23;
      sky.fillStyle(Phaser.Display.Color.GetColor(6 + t * 10, 8 + t * 16, 14 + t * 18), 1);
      sky.fillRect(-vw, -40 - vh / 2 + (i * vh) / 24 - 2, vw * 2, vh / 24 + 4);
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
    const shack = bakeShack(this, { id: 'title', x: 0, y: 0, w: 15, h: 5, style: 'shack', wallHeight: 4, roofHeight: 3, door: { x: 7 }, windows: [] }, 'title:shack');
    this.add.image(0, 120, shack.key).setOrigin(0.5, 1).setTint(0x8a8a98);
    // warm light spilling from the windows and the door
    for (const [x, y, s] of [[-58, 95, 0.9], [58, 95, 0.9], [0, -40, 0.8], [140, 70, 0.9], [-52, -30, 0.6], [52, -30, 0.6]] as const) {
      this.add.image(x, y, 'light').setScale(s).setTint(0xffb54a).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
    }
    if (this.textures.exists(propKey('nature/lamp_post'))) {
      this.add.image(-150, 150, propKey('nature/lamp_post')).setOrigin(0.5, 1).setTint(0x9a9080);
      this.add.image(-146, 100, 'light').setScale(1.1).setTint(0xffc060).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    }
    // ground
    const g = this.add.graphics();
    g.fillStyle(0x0d1410, 1).fillRect(-vw, 118, vw * 2, vh);
    g.fillStyle(0x1a1a14, 1).fillRect(-26, 118, 52, vh);
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
    this.paintScene();
    session.audio.startMusic('title');
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
      <div class="cipher" aria-hidden="true">QDGD H R TXH SDUHFH</div>
      <div class="menu-list">
        ${latest ? `<button data-a="continue">Continuar <small>${latest.file!.summary.mapName}</small></button>` : ''}
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
    const ui = this.registry.get('ui') as Ui;
    ui.banner('Arco 1 — Bill', 'Muito antes de Gravity Falls, num mundo plano chamado Euclydia, uma criança triangular começa a ver coisas que mais ninguém vê.', 0, () => this.scene.start('world'));
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
