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
  // plaza
  c.ellipse(24.5, 15.5, 8.5, 6.5, 'e');
  c.speckle('e', 'l', 0.07, 31, 16, 9, 18, 14);
  c.ellipse(24.5, 15.5, 3.2, 2.6, 'g');
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

export const HOUSES = [
  { prop: 'euclydia/a_frame_house', x: 17, y: 8.4 },
  { prop: 'euclydia/hex_house', x: 15.5, y: 24.6 },
  { prop: 'euclydia/dome_house', x: 32, y: 23.5 },
  { prop: 'euclydia/hex_house', x: 5.5, y: 8.6 },
];
export const BILL_HOUSE = { prop: 'euclydia/a_frame_house', x: 34, y: 8.6, id: 'bill_house_front' };
export const BILL_DOOR = { x: 33.6, y: 8.6, w: 0.8, h: 0.8 };

export function trees(seedShift = 0) {
  const out = [];
  const spots = [[3, 3], [6, 4], [14, 3], [19, 4], [30, 3], [35, 4], [37, 12], [37, 19], [36, 27], [28, 27], [20, 27], [6, 27], [3, 20], [14, 19], [36, 7]];
  spots.forEach(([x, y], i) => out.push({ prop: 'euclydia/round_tree', x: x + 0.5, y: y + 0.9, flip: (i + seedShift) % 2 === 0 }));
  return out;
}
