import Phaser from 'phaser';

/**
 * Textures generated at boot. Only technical helpers live here — light
 * gradients, fog, shadows and bridge decks. Every visible object of the world
 * comes from the catalogue.
 */
export const GENERATED = ['px', 'shadow', 'missing', 'light', 'cone', 'fog', 'vignette', 'eyes', 'groundglow', 'bridge_*', 'bus'];

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, smooth = false): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h)!;
  const c = t.getContext();
  c.imageSmoothingEnabled = smooth;
  draw(c);
  t.refresh();
}

/** Deterministic value noise in [0,1], tileable with period p. */
function noise(x: number, y: number, p: number, seed: number): number {
  const h = (i: number, j: number) => {
    i = ((i % p) + p) % p;
    j = ((j % p) + p) % p;
    let n = (i * 374761393 + j * 668265263 + seed * 982451653) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return (a + (b - a) * s(xf)) + ((c + (d - c) * s(xf)) - (a + (b - a) * s(xf))) * s(yf);
}

export function makeGenerated(scene: Phaser.Scene): void {
  const r = (c: CanvasRenderingContext2D, col: string, x: number, y: number, w: number, h: number) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  canvas(scene, 'px', 2, 2, (c) => r(c, '#fff', 0, 0, 2, 2));
  canvas(scene, 'shadow', 22, 8, (c) => {
    r(c, 'rgba(0,0,0,0.34)', 4, 0, 14, 8);
    r(c, 'rgba(0,0,0,0.34)', 0, 2, 22, 4);
  });
  canvas(scene, 'missing', 32, 32, (c) => {
    r(c, '#ff00ff', 0, 0, 32, 32);
    r(c, '#000', 4, 4, 24, 24);
  });
  // soft radial light: erased out of the night layer, also used additively for glow
  canvas(scene, 'light', 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }, true);
  // flashlight cone pointing east, apex at the left middle
  canvas(scene, 'cone', 256, 160, (c) => {
    for (let x = 0; x < 256; x++) {
      const half = 6 + (x / 256) * 70;
      const fall = Math.pow(1 - x / 256, 0.8);
      for (let y = 0; y < 160; y++) {
        const d = Math.abs(y - 80) / half;
        if (d > 1) continue;
        c.fillStyle = `rgba(255,255,255,${(fall * (1 - d * d)).toFixed(3)})`;
        c.fillRect(x, y, 1, 1);
      }
    }
  }, true);
  // tileable fog: two octaves of value noise, soft and low contrast
  canvas(scene, 'fog', 256, 256, (c) => {
    const img = c.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const n = noise(x / 32, y / 32, 8, 7) * 0.65 + noise(x / 12, y / 12, 21.33, 3) * 0.35;
        const a = Math.max(0, Math.min(1, (n - 0.38) * 2.2));
        const i = (y * 256 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
    }
    c.putImageData(img, 0, 0);
  }, true);
  canvas(scene, 'vignette', 256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 60, 128, 128, 181);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0.85)');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  }, true);
  // a pair of eyes in the dark
  canvas(scene, 'eyes', 10, 3, (c) => {
    r(c, '#fff6b0', 0, 0, 3, 3);
    r(c, '#fff6b0', 7, 0, 3, 3);
    r(c, '#ffd23a', 1, 1, 1, 1);
    r(c, '#ffd23a', 8, 1, 1, 1);
  });
  canvas(scene, 'groundglow', 48, 16, (c) => {
    const g = c.createRadialGradient(24, 8, 0, 24, 8, 24);
    g.addColorStop(0, 'rgba(255,240,190,0.55)');
    g.addColorStop(1, 'rgba(255,240,190,0)');
    c.setTransform(1, 0, 0, 1 / 3, 0, 16 / 3);
    c.fillStyle = g;
    c.fillRect(0, -16, 48, 48);
  }, true);

  // the bus that brings the twins: an old country coach seen from the side, nose to the west
  canvas(scene, 'bus', 168, 78, (c) => {
    const W = 168;
    r(c, 'rgba(0,0,0,0.35)', 10, 72, W - 16, 6);
    // body
    r(c, '#2a2a2e', 6, 14, W - 10, 52);
    r(c, '#d9cfa8', 8, 16, W - 14, 40);
    r(c, '#b8ad86', 8, 46, W - 14, 10);
    r(c, '#3f6a6a', 8, 40, W - 14, 6);
    r(c, '#e8e0c0', 8, 16, W - 14, 3);
    // nose and windscreen
    r(c, '#2a2a2e', 2, 22, 8, 40);
    r(c, '#a8c8d0', 8, 20, 16, 18);
    r(c, '#d8eef2', 10, 22, 5, 8);
    r(c, '#ffe6a0', 4, 50, 5, 5);
    // destination board
    r(c, '#1a1a1e', 30, 8, 76, 10);
    for (let i = 0; i < 13; i++) r(c, '#f0b84a', 34 + i * 5.4, 11, 3, 4);
    // passenger windows with the light on inside
    for (let x = 30; x < W - 14; x += 18) {
      r(c, '#2a2a2e', x - 1, 21, 16, 17);
      r(c, '#f3d98a', x, 22, 14, 15);
      r(c, '#fff0c0', x + 1, 23, 5, 5);
    }
    // door
    r(c, '#2a2a2e', 26, 21, 2, 35);
    // wheels
    for (const x of [30, W - 36]) {
      r(c, '#121214', x - 12, 54, 24, 18);
      r(c, '#121214', x - 9, 51, 18, 24);
      r(c, '#5a5a60', x - 5, 58, 10, 10);
      r(c, '#8a8a90', x - 2, 61, 4, 4);
    }
  });

  // bridge decks: weathered planks with nails and posts, rails only on outer edges
  const plank = ['#6f4a2a', '#7c5532', '#5f3f24', '#6a4730'];
  const deck = (key: string, horiz: boolean, railA: boolean, railB: boolean) => canvas(scene, key, 32, 32, (c) => {
    for (let i = 0; i < 32; i += 4) {
      const col = plank[(i / 4) % plank.length];
      if (horiz) {
        r(c, col, i, 2, 4, 28);
        r(c, 'rgba(0,0,0,0.45)', i + 3, 2, 1, 28);
        r(c, 'rgba(255,230,180,0.10)', i, 2, 1, 28);
        r(c, '#2a1c10', i + 1, 6, 1, 1);
        r(c, '#2a1c10', i + 1, 25, 1, 1);
      } else {
        r(c, col, 2, i, 28, 4);
        r(c, 'rgba(0,0,0,0.45)', 2, i + 3, 28, 1);
        r(c, 'rgba(255,230,180,0.10)', 2, i, 28, 1);
        r(c, '#2a1c10', 6, i + 1, 1, 1);
        r(c, '#2a1c10', 25, i + 1, 1, 1);
      }
    }
    const rail = (x: number, y: number, w: number, h: number) => { r(c, '#3a2614', x, y, w, h); r(c, 'rgba(255,220,170,0.12)', x, y, w, 1); };
    if (horiz) {
      if (railA) { rail(0, 0, 32, 3); r(c, '#2a1a0c', 2, 0, 3, 5); }
      else r(c, plank[0], 0, 0, 32, 2);
      if (railB) { rail(0, 29, 32, 3); r(c, '#2a1a0c', 18, 27, 3, 5); }
      else r(c, plank[2], 0, 30, 32, 2);
    } else {
      if (railA) { rail(0, 0, 3, 32); r(c, '#2a1a0c', 0, 2, 5, 3); }
      else r(c, plank[0], 0, 0, 2, 32);
      if (railB) { rail(29, 0, 3, 32); r(c, '#2a1a0c', 27, 18, 5, 3); }
      else r(c, plank[2], 30, 0, 2, 32);
    }
  });
  for (const [a, b] of [[true, true], [true, false], [false, true], [false, false]] as const) {
    const suffix = `${a ? 1 : 0}${b ? 1 : 0}`;
    deck(`bridge_h${suffix}`, true, a, b);
    deck(`bridge_v${suffix}`, false, a, b);
  }
}
