import Phaser from 'phaser';
import { texKey } from '../assets';

/**
 * Small textures generated at boot for things the catalogue does not cover
 * (shadows, markers, bridge decks, levers, ring symbols). Registered in the
 * manifest report as generated complements.
 */
export const GENERATED = ['shadow', 'missing', 'clue', 'sym0', 'sym1', 'sym2', 'sym3', 'anchor', 'lever_off', 'lever_on', 'save',  'chevron', 'glint', 'px', 'target', 'darkness'];

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h)!;
  const c = t.getContext();
  c.imageSmoothingEnabled = false;
  draw(c);
  t.refresh();
}

export function makeGenerated(scene: Phaser.Scene): void {
  const r = (c: CanvasRenderingContext2D, col: string, x: number, y: number, w: number, h: number) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  canvas(scene, 'px', 2, 2, (c) => r(c, '#fff', 0, 0, 2, 2));
  canvas(scene, 'shadow', 22, 8, (c) => {
    r(c, 'rgba(0,0,0,0.32)', 4, 0, 14, 8);
    r(c, 'rgba(0,0,0,0.32)', 0, 2, 22, 4);
  });
  canvas(scene, 'missing', 32, 32, (c) => {
    r(c, '#ff00ff', 0, 0, 32, 32);
    r(c, '#000', 4, 4, 24, 24);
    r(c, '#ff00ff', 8, 8, 16, 16);
  });
  canvas(scene, 'clue', 10, 10, (c) => {
    r(c, '#fff6c0', 4, 0, 2, 10);
    r(c, '#fff6c0', 0, 4, 10, 2);
    r(c, '#ffd040', 4, 4, 2, 2);
  });
  canvas(scene, 'glint', 6, 6, (c) => {
    r(c, 'rgba(230,255,255,0.9)', 2, 0, 2, 6);
    r(c, 'rgba(230,255,255,0.9)', 0, 2, 6, 2);
  });
  canvas(scene, 'chevron', 14, 14, (c) => {
    for (let i = 0; i < 6; i++) {
      r(c, '#fff3c4', 2 + i, 1 + i, 2, 2);
      r(c, '#fff3c4', 2 + i, 11 - i, 2, 2);
      r(c, '#fff3c4', 7 + i, 1 + i, 2, 2);
      r(c, '#fff3c4', 7 + i, 11 - i, 2, 2);
    }
  });
  canvas(scene, 'target', 16, 16, (c) => {
    r(c, '#ffe066', 6, 0, 4, 4);
    r(c, '#ffe066', 4, 2, 8, 2);
    r(c, '#ffe066', 7, 4, 2, 2);
  });
  // ring puzzle symbols: triangle, eye, spiral, square
  const sym = (key: string, draw: (c: CanvasRenderingContext2D) => void) => canvas(scene, key, 16, 16, (c) => {
    r(c, 'rgba(20,10,40,0.75)', 0, 0, 16, 16);
    draw(c);
  });
  const gold = '#ffd84a';
  sym('sym0', (c) => { for (let i = 0; i < 6; i++) r(c, gold, 7 - i, 3 + i * 2, 2 + i * 2, 2); });
  sym('sym1', (c) => { r(c, gold, 3, 7, 10, 2); r(c, gold, 5, 5, 6, 2); r(c, gold, 5, 9, 6, 2); r(c, '#1a1030', 7, 6, 2, 4); });
  sym('sym2', (c) => { r(c, gold, 3, 3, 10, 2); r(c, gold, 11, 3, 2, 10); r(c, gold, 5, 11, 8, 2); r(c, gold, 5, 7, 2, 6); r(c, gold, 7, 7, 3, 2); });
  sym('sym3', (c) => { r(c, gold, 3, 3, 10, 2); r(c, gold, 3, 11, 10, 2); r(c, gold, 3, 3, 2, 10); r(c, gold, 11, 3, 2, 10); });
  canvas(scene, 'anchor', 20, 44, (c) => {
    r(c, '#3b2412', 8, 6, 6, 38);
    r(c, '#6b4424', 9, 6, 3, 38);
    r(c, '#ffd84a', 4, 2, 14, 4);
    r(c, '#ffd84a', 4, 2, 4, 10);
    r(c, '#ffd84a', 14, 2, 4, 10);
    r(c, '#b8902a', 6, 10, 10, 2);
  });
  const lever = (key: string, on: boolean) => canvas(scene, key, 20, 26, (c) => {
    r(c, '#2a2a30', 2, 18, 16, 8);
    r(c, '#56606a', 4, 18, 12, 4);
    const x = on ? 12 : 6;
    for (let i = 0; i < 14; i += 2) r(c, '#8a8f96', on ? x - i / 2 + 6 : x + i / 2 - 6 + 6, 4 + i, 2, 2);
    r(c, on ? '#7cff8a' : '#ff6a5a', on ? 13 : 1, 0, 6, 6);
  });
  lever('lever_off', false);
  lever('lever_on', true);
  canvas(scene, 'save', 22, 40, (c) => {
    r(c, '#2a1a0e', 9, 12, 4, 28);
    r(c, '#ffe9a0', 5, 0, 12, 12);
    r(c, '#ffc94a', 7, 2, 8, 8);
    r(c, '#2a1a0e', 3, 10, 16, 3);
  });
  const deck = (key: string, horiz: boolean, railA = true, railB = true) => canvas(scene, key, 32, 32, (c) => {
    const plank = ['#8a5a30', '#a0703f', '#7a4d28', '#956538'];
    for (let i = 0; i < 32; i += 4) {
      const col = plank[(i / 4) % plank.length];
      if (horiz) {
        r(c, col, i, 4, 4, 24);
        r(c, 'rgba(0,0,0,0.35)', i + 3, 4, 1, 24);
      } else {
        r(c, col, 4, i, 24, 4);
        r(c, 'rgba(0,0,0,0.35)', 4, i + 3, 24, 1);
      }
    }
    if (horiz) {
      if (railA) { r(c, '#4a2c14', 0, 0, 32, 4); r(c, '#5a3a1c', 2, 0, 3, 6); }
      if (railB) { r(c, '#4a2c14', 0, 28, 32, 4); r(c, '#2a180a', 0, 31, 32, 1); r(c, '#5a3a1c', 18, 26, 3, 6); }
      if (!railA) r(c, plank[1], 0, 0, 32, 4);
      if (!railB) r(c, plank[2], 0, 28, 32, 4);
    } else {
      if (railA) { r(c, '#4a2c14', 0, 0, 4, 32); r(c, 'rgba(0,0,0,0.4)', 4, 0, 1, 32); r(c, '#5a3a1c', 0, 2, 6, 3); }
      if (railB) { r(c, '#4a2c14', 28, 0, 4, 32); r(c, 'rgba(0,0,0,0.4)', 27, 0, 1, 32); r(c, '#5a3a1c', 26, 18, 6, 3); }
      if (!railA) for (let i = 0; i < 32; i += 4) r(c, plank[(i / 4) % plank.length], 0, i, 4, 4);
      if (!railB) for (let i = 0; i < 32; i += 4) r(c, plank[(i / 4) % plank.length], 28, i, 4, 4);
    }
  });
  for (const [a, b] of [[true, true], [true, false], [false, true], [false, false]] as const) {
    const suffix = `${a ? 1 : 0}${b ? 1 : 0}`;
    deck(`bridge_h${suffix}`, true, a, b);
    deck(`bridge_v${suffix}`, false, a, b);
  }
  // vignette used for dark areas: transparent centre, dark edges
  canvas(scene, 'darkness', 256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 30, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0.92)');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  });
  void texKey;
}
