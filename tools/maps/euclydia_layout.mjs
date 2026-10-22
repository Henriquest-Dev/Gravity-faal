import { Canvas } from './lib.mjs';

/**
 * Shared geography of Euclydia's square. Both the intact plaza and the
 * post-rupture map are painted from this, so landmarks stay recognisable:
 * river and bridge to the west, fountain at the centre, Bill's house to the
 * north-east, the gate to the observatory to the north.
 */
export const W = 40, H = 30;

export function baseCanvas() {
  const c = new Canvas(W, H, '.');
  c.frame(0, 0, W, H, 'x', 2);
  // river with a stone bridge
  c.river([[10.5, 0], [10.5, 30]], 2, 1);
  for (let y = 14; y <= 15; y++) for (let x = 8; x <= 13; x++) if ('~='.includes(c.get(x, y))) c.set(x, y, 'B');
  // plaza: warm paving, a gold ring around the fountain and lavender diamond inlays on the four spokes
  c.ellipse(24.5, 15.5, 8.5, 6.5, 'e');
  c.ellipse(24.5, 15.5, 3.4, 2.8, 'g');
  for (let i = 0; i < 7; i++) {
    if (i % 2) continue;
    for (const x of [24, 25]) { c.set(x, 12 - i, 'l'); c.set(x, 19 + i, 'l'); }
    for (const y of [15, 16]) { c.set(21 - i, y, 'l'); c.set(28 + i, y, 'l'); }
  }
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    // inlays only where the paving is
    const d = ((x + 0.5 - 24.5) / 8.5) ** 2 + ((y + 0.5 - 15.5) / 6.5) ** 2;
    if (c.get(x, y) === 'l' && d > 1) c.set(x, y, '.');
  }
  // streets
  c.path([[16, 14.5], [3, 14.5]], 2, 'p', ['.', 'x', 'e']);
  c.path([[24.5, 9], [24.5, 6]], 3, 'e', ['.']);
  c.rect(24, 0, 1, 6, 'p');
  c.rect(22, 2, 2, 4, 'x');
  c.rect(25, 2, 2, 4, 'x');
  c.path([[30, 11], [34, 9.5]], 2, 'e', ['.']);
  c.path([[24.5, 22], [24.5, 26]], 2, 'p', ['.']);
  c.path([[18, 21], [16, 24]], 2, 'p', ['.']);
  // west bank garden of the elder
  c.rect(3, 9, 5, 4, 'm');
  return c;
}

/** The houses are painted in the village's own style: lavender A-frames framed in gold. */
export const ELDER_HOUSE = { id: 'elder_house', x: 3, y: 7, w: 5, h: 2, style: 'euclid', door: { x: 5 }, windows: [7] };
export const BILL_HOUSE = { id: 'bill_house', x: 32, y: 7, w: 5, h: 2, style: 'euclid', sign: 'tall', door: { x: 34, exit: 'bill_door' }, windows: [36] };
export const HOUSES = [
  { id: 'house_nw', x: 15, y: 7, w: 5, h: 2, style: 'euclid', door: { x: 17 }, windows: [15] },
  { id: 'tri_house', x: 13, y: 23, w: 5, h: 2, style: 'euclid', door: { x: 15 }, windows: [17] },
  { id: 'house_se', x: 30, y: 22, w: 5, h: 2, style: 'euclid', door: { x: 32 } },
  ELDER_HOUSE,
];
export const BILL_DOOR = { x: 34, y: 8, w: 1, h: 1 };

/** Terraces: low stone retaining walls under the northern houses, with stairs down to the square. */
export function terraces(c) {
  for (let x = 13; x <= 20; x++) if (x !== 17) c.set(x, 10, 'C');
  for (let x = 30; x <= 37; x++) if (x !== 33 && x !== 34) c.set(x, 10, 'C');
  for (const [x, y] of [[17, 9], [33, 9], [34, 9]]) c.set(x, y, 'p');
  return [
    { prop: 'euclydia/stairs', x: 17.5, y: 11.1, layer: 'ground' },
    { prop: 'euclydia/stairs', x: 34, y: 11.1, layer: 'ground' },
  ];
}

export function trees(seedShift = 0) {
  const out = [];
  const spots = [[3, 3], [6, 4], [14, 3], [19, 4], [30, 3], [35, 4], [37, 12], [37, 19], [36, 27], [28, 27], [20, 27], [6, 27], [3, 20], [14, 19], [36, 7]];
  spots.forEach(([x, y], i) => out.push({ prop: 'euclydia/round_tree', x: x + 0.5, y: y + 0.9, flip: (i + seedShift) % 2 === 0 }));
  return out;
}
