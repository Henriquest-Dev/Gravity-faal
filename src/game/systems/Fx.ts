import Phaser from 'phaser';
import { DEPTH } from '../world/MapBuilder';

/**
 * Pooled visual effects with hard caps. Every effect has a fixed lifetime and
 * returns to its pool, so nothing accumulates across long sessions.
 */
export class Fx {
  private sprites: Phaser.GameObjects.Sprite[] = [];
  private rings: Phaser.GameObjects.Arc[] = [];
  private bits: Phaser.GameObjects.Image[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  reduced = false;
  shakeEnabled = true;

  constructor(private scene: Phaser.Scene) {}

  private take<T extends Phaser.GameObjects.GameObject & { active: boolean }>(pool: T[], make: () => T, cap: number): T | null {
    const free = pool.find((p) => !p.active);
    if (free) return free;
    if (pool.length >= cap) return null;
    const n = make();
    pool.push(n);
    return n;
  }

  /** Sprite effect from the catalogue effects sheet: rift, stasis, run_dust, impact. */
  anim(name: 'rift' | 'stasis' | 'run_dust' | 'impact', x: number, y: number, depth: number, scale = 1, tint?: number): void {
    if (this.reduced && name === 'run_dust') return;
    const cap = this.reduced ? 8 : 24;
    const s = this.take(this.sprites, () => this.scene.add.sprite(0, 0, '__DEFAULT').setActive(false).setVisible(false), cap);
    if (!s) return;
    s.setActive(true).setVisible(true).setPosition(x, y).setDepth(depth).setScale(scale).setAlpha(1).setOrigin(0.5, 0.8);
    if (tint !== undefined) s.setTint(tint);
    else s.clearTint();
    s.play(`fx:${name}`);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.setActive(false).setVisible(false));
  }

  ripple(x: number, y: number, color = 0xd8fffb, radius = 14, duration = 500): void {
    const cap = this.reduced ? 6 : 16;
    const r = this.take(this.rings, () => this.scene.add.circle(0, 0, 4).setActive(false).setVisible(false), cap);
    if (!r) return;
    r.setActive(true).setVisible(true).setPosition(x, y).setRadius(3).setStrokeStyle(2, color, 0.9).setFillStyle();
    r.setScale(1, 0.5).setDepth(DEPTH.ground + y).setAlpha(1);
    this.scene.tweens.add({
      targets: r, radius, alpha: 0, duration,
      onComplete: () => r.setActive(false).setVisible(false),
    });
  }

  burst(x: number, y: number, color: number, count = 6, depth = y): void {
    const n = this.reduced ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const b = this.take(this.bits, () => this.scene.add.image(0, 0, 'px').setActive(false).setVisible(false), 48);
      if (!b) return;
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      b.setActive(true).setVisible(true).setPosition(x, y).setTint(color).setDepth(depth).setAlpha(1).setScale(1);
      this.scene.tweens.add({
        targets: b, x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 10 - 6, alpha: 0, duration: 380,
        onComplete: () => b.setActive(false).setVisible(false),
      });
    }
  }

  text(x: number, y: number, msg: string, color = '#ffffff'): void {
    const t = this.take(this.texts, () => this.scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '10px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setActive(false).setVisible(false), 12);
    if (!t) return;
    t.setActive(true).setVisible(true).setText(msg).setColor(color).setPosition(x, y).setOrigin(0.5, 1).setDepth(DEPTH.overlay).setAlpha(1);
    this.scene.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 900, onComplete: () => t.setActive(false).setVisible(false) });
  }

  shake(intensity = 0.004, duration = 120): void {
    if (!this.shakeEnabled || this.reduced) return;
    this.scene.cameras.main.shake(duration, intensity);
  }

  flash(color = 0xffffff, duration = 120): void {
    if (this.reduced) return;
    const c = Phaser.Display.Color.IntegerToRGB(color);
    this.scene.cameras.main.flash(duration, c.r, c.g, c.b);
  }

  get activeCount(): number {
    return [...this.sprites, ...this.rings, ...this.bits, ...this.texts].filter((o) => o.active).length;
  }

  destroy(): void {
    for (const o of [...this.sprites, ...this.rings, ...this.bits, ...this.texts]) o.destroy();
    this.sprites = [];
    this.rings = [];
    this.bits = [];
    this.texts = [];
  }
}
