import { session } from '../session';
import type { Action } from '../systems/Input';
import { icon } from './icons';

/** Satellite buttons around the main action button: [action, angle in degrees (180 = left, 90 = up), ring radius, size]. */
const ARC: [string, number, number, number][] = [
  ['jump', 180, 98, 60],
  ['secondary', 135, 100, 64],
  ['dodge', 90, 98, 60],
  ['cycle', 160, 168, 44],
  ['interact', 118, 176, 72],
  ['switch', 76, 170, 48],
];

/**
 * On-screen controls. Every control tracks its own pointerId with pointer
 * capture, so releasing a button never cancels the joystick held by another finger.
 */
export class TouchControls {
  readonly el: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private buttons = new Map<string, HTMLElement>();
  private interactLabel!: HTMLElement;
  runToggle = false;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'touch';
    this.el.innerHTML = `
      <div class="t-zone"></div>
      <div class="t-stick"><div class="t-ring"></div><div class="t-knob"></div></div>
      <div class="t-cluster">
        <button class="t-btn t-primary" data-a="primary" aria-label="Acção principal">${icon('strike')}</button>
        <button class="t-btn t-secondary" data-a="secondary" aria-label="Capacidade (arrastar para apontar)"><span class="t-ab">${icon('ability')}</span></button>
        <button class="t-btn t-interact" data-a="interact" aria-label="Interagir">${icon('eye')}<span></span></button>
        <button class="t-btn t-jump" data-a="jump" aria-label="Saltar">${icon('jump')}</button>
        <button class="t-btn t-dodge" data-a="dodge" aria-label="Esquivar">${icon('dodge')}</button>
        <button class="t-btn t-switch" data-a="switch" aria-label="Alternar personagem">${icon('swap')}</button>
        <button class="t-btn t-cycle" data-a="cycle" aria-label="Mudar capacidade">${icon('cycle')}</button>
      </div>
      <button class="t-btn t-run" data-a="run-toggle" aria-label="Correr">${icon('run')}</button>
      <div class="t-top">
        <button class="t-mini" data-a="journal" aria-label="Diário">${icon('journal')}</button>
        <button class="t-mini" data-a="inventory" aria-label="Inventário">${icon('bag')}</button>
        <button class="t-mini" data-a="map" aria-label="Mapa">${icon('map')}</button>
        <button class="t-mini" data-a="pause" aria-label="Pausa">${icon('pause')}</button>
      </div>`;
    root.appendChild(this.el);
    this.stick = this.el.querySelector('.t-stick')!;
    this.knob = this.el.querySelector('.t-knob')!;
    this.interactLabel = this.el.querySelector('.t-interact span')!;
    const zone = this.el.querySelector('.t-zone') as HTMLElement;
    zone.addEventListener('pointerdown', this.stickDown);
    zone.addEventListener('pointermove', this.stickMove);
    zone.addEventListener('pointerup', this.stickUp);
    zone.addEventListener('pointercancel', this.stickUp);
    zone.addEventListener('lostpointercapture', this.stickUp);
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-a]')) {
      this.buttons.set(b.dataset.a!, b);
      if (b.dataset.a === 'secondary') this.bindAim(b);
      else if (b.dataset.a === 'run-toggle') {
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.runToggle = !this.runToggle;
          session.input.touchRun = this.runToggle;
          b.classList.toggle('on', this.runToggle);
        });
      } else this.bindButton(b, b.dataset.a as Action);
    }
    this.applySettings();
  }

  applySettings(): void {
    const k = session.settings.touchScale;
    this.el.style.setProperty('--t-scale', String(k));
    this.el.style.setProperty('--t-opacity', String(session.settings.touchOpacity));
    // place the satellites on their arc around the main button (centre 52px from the corner)
    const main = 88 * k, cx = main / 2, cy = main / 2;
    for (const [a, deg, rad, size] of ARC) {
      const b = this.buttons.get(a);
      if (!b) continue;
      const th = (deg * Math.PI) / 180, sz = size * k;
      const x = cx - Math.cos(th) * rad * k, y = cy + Math.sin(th) * rad * k; // distances from the right/bottom edges
      b.style.width = b.style.height = `${sz}px`;
      b.style.right = `${x - sz / 2}px`;
      b.style.bottom = `${y - sz / 2}px`;
    }
  }

  private bindButton(b: HTMLElement, a: Action): void {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      session.audio.unlock();
      b.setPointerCapture(e.pointerId);
      b.classList.add('down');
      session.input.virtualDown(a, e.pointerId);
    });
    const up = (e: PointerEvent) => {
      b.classList.remove('down');
      session.input.virtualUp(a, e.pointerId);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
  }

  /** Ability button: tap = auto-aim, drag = aim in the drag direction, fires on release. */
  private bindAim(b: HTMLElement): void {
    let id: number | null = null;
    let ox = 0, oy = 0;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      session.audio.unlock();
      id = e.pointerId;
      ox = e.clientX;
      oy = e.clientY;
      b.setPointerCapture(e.pointerId);
      b.classList.add('down');
      session.input.aim = null;
    });
    b.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      session.input.aim = d > 14 ? { x: dx / d, y: dy / d } : null;
      b.style.setProperty('--aim', d > 14 ? `${Math.atan2(dy, dx)}rad` : '0rad');
      b.classList.toggle('aiming', d > 14);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      b.classList.remove('down', 'aiming');
      session.input.virtualDown('secondary', e.pointerId);
      session.input.virtualUp('secondary', e.pointerId);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== id) return;
      id = null;
      b.classList.remove('down', 'aiming');
      session.input.aim = null;
    });
  }

  private stickDown = (e: PointerEvent) => {
    if (this.stickId !== null) return;
    e.preventDefault();
    session.audio.unlock();
    this.stickId = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.stickOrigin = { x: e.clientX, y: e.clientY };
    this.stick.style.left = `${e.clientX}px`;
    this.stick.style.top = `${e.clientY}px`;
    this.stick.classList.add('on');
    this.knob.style.transform = 'translate(-50%,-50%)';
    session.input.lastDevice = 'touch';
  };

  private stickMove = (e: PointerEvent) => {
    if (e.pointerId !== this.stickId) return;
    const radius = 50 * session.settings.touchScale;
    let dx = e.clientX - this.stickOrigin.x, dy = e.clientY - this.stickOrigin.y;
    const d = Math.hypot(dx, dy);
    if (d > radius) { dx = (dx / d) * radius; dy = (dy / d) * radius; }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const m = Math.min(1, d / radius);
    const dead = 0.18;
    if (m < dead) {
      session.input.touchMove = { x: 0, y: 0 };
    } else {
      // rescale past the dead zone so small pushes still give fine control
      const k = (m - dead) / (1 - dead) / (m || 1);
      session.input.touchMove = { x: (dx / radius) * k, y: (dy / radius) * k };
    }
    session.input.touchRun = this.runToggle || m > 0.95;
  };

  private stickUp = (e: PointerEvent) => {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null;
    this.stick.classList.remove('on');
    session.input.touchMove = { x: 0, y: 0 };
    session.input.touchRun = this.runToggle;
  };

  /** Show controls according to unlocked abilities and party. */
  update(opts: { visible: boolean; ability: boolean; party: boolean; interact: string | null; jump: boolean; dodge: boolean; abilityIcon: string; cycle: boolean }): void {
    this.el.classList.toggle('hidden', !opts.visible);
    if (!opts.visible) { this.el.parentElement?.classList.remove('touch-on'); return; }
    this.buttons.get('secondary')!.classList.toggle('gone', !opts.ability);
    this.buttons.get('cycle')!.classList.toggle('gone', !opts.cycle);
    this.buttons.get('switch')!.classList.toggle('gone', !opts.party);
    this.buttons.get('jump')!.classList.toggle('disabled', !opts.jump);
    this.buttons.get('dodge')!.classList.toggle('disabled', !opts.dodge);
    const ib = this.buttons.get('interact')!;
    ib.classList.toggle('gone', !opts.interact);
    if (opts.interact && this.interactLabel.textContent !== opts.interact) this.interactLabel.textContent = opts.interact;
    const sb = this.buttons.get('secondary')!;
    if (sb.dataset.ab !== opts.abilityIcon) {
      sb.dataset.ab = opts.abilityIcon;
      sb.querySelector('.t-ab')!.innerHTML = icon(opts.abilityIcon || 'ability');
    }
    this.el.parentElement?.classList.toggle('touch-on', opts.visible);
  }

  release(): void {
    this.stickId = null;
    this.stick.classList.remove('on');
    for (const b of this.buttons.values()) b.classList.remove('down', 'aiming');
  }
}
