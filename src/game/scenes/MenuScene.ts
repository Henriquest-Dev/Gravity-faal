import Phaser from 'phaser';
import { SLOT_COUNT } from '../../core/save';
import { createState } from '../../core/state';
import { buildCharacterAnims } from '../assets';
import { CHARACTERS } from '../data';
import { session } from '../session';
import type { Ui } from '../ui/Ui';

/** Title screen: new game, continue, slot selection, import and options. */
export class MenuScene extends Phaser.Scene {
  private el: HTMLElement | null = null;

  constructor() {
    super('menu');
  }

  create(): void {
    const ui = this.registry.get('ui') as Ui;
    ui.showHud(false);
    ui.touch.update({ visible: false, ability: false, party: false, interact: null, jump: false, dodge: false, abilityIcon: '', cycle: false });
    this.cameras.main.setBackgroundColor('#14110f');
    for (const id of ['bill_child', 'dipper', 'mabel']) buildCharacterAnims(this, id);
    // little parade of the protagonists walking in place
    const w = this.scale.width, h = this.scale.height;
    const zoom = Math.max(1, Math.floor(Math.min(w / 480, h / 300)));
    this.cameras.main.setZoom(zoom).centerOn(0, 0);
    ['bill_child', 'dipper', 'mabel'].forEach((id, i) => {
      const s = this.add.sprite((i - 1) * 56, 70, `sheet:${CHARACTERS[id].walk}`, 0).setOrigin(0.5, 108 / 128);
      s.play(`${id}:walk:south`);
      this.add.image((i - 1) * 56, 70, 'shadow');
    });
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
      <div class="menu-list">
        ${latest ? `<button data-a="continue">Continuar <small>ranhura ${latest.slot}</small></button>` : ''}
        <button data-a="new">Novo jogo</button>
        <button data-a="load">Carregar / importar</button>
        <button data-a="options">Opções</button>
      </div>
      <p class="muted small">PC: WASD/setas · Shift correr · E interagir · J/clique atacar · K capacidade · Espaço saltar · L esquivar · Q alternar · I/N/M menus · Esc pausa</p>`;
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
    el.querySelector('.menu-list')!.innerHTML = `<p>Escolhe a ranhura de gravação:</p>${slots.map((s) => `<button data-slot="${s.slot}">Ranhura ${s.slot} <small>${s.file ? `${s.file.summary.mapName} · ${Math.floor(s.file.summary.playTime / 60)} min` : s.error ? 'inválida' : 'vazia'}</small></button>`).join('')}<button data-back>Voltar</button>`;
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
