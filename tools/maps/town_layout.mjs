import { Canvas, forest } from './lib.mjs';

/** Shared street plan for town_center and town_invaded (same landmarks). */
export const W = 44, H = 30;

export function townCanvas() {
  const c = new Canvas(W, H, '.');
  c.frame(0, 0, W, H, 'x', 2);
  c.rect(0, 13, W, 4, 'o'); // main street
  c.rect(3, 11, 38, 2, 'p'); // north sidewalk
  c.rect(3, 17, 38, 2, 'p'); // south sidewalk
  c.rect(5, 19, 16, 8, '.'); // park
  c.path([[13, 19], [13, 26]], 2, ':', ['.']);
  c.path([[7, 23], [19, 23]], 2, ':', ['.']);
  c.ellipse(13, 23, 2.2, 1.6, 'p');
  c.rect(25, 19, 14, 7, ';'); // empty lot
  c.path([[31, 19], [31, 25]], 2, 'p', [';']);
  return c;
}

export const BUILDINGS = [
  { id: 'diner', x: 5, y: 7, w: 8, h: 4, style: 'shop', wallHeight: 2, roofHeight: 1.5, sign: "GREASY'S", door: { x: 9 }, windows: [6, 7, 11] },
  { id: 'town_hall', x: 16, y: 6, w: 10, h: 5, style: 'stone', wallHeight: 2.5, roofHeight: 2, sign: 'CAMARA', door: { x: 21 }, windows: [17, 19, 23, 24] },
  { id: 'hardware', x: 29, y: 7, w: 8, h: 4, style: 'workshop', wallHeight: 2, roofHeight: 1.5, sign: 'FERRAGENS', door: { x: 33 }, windows: [30, 35] },
];

export function townProps(c, seed) {
  return [
    ...forest(c, 'x', ['nature/pine', 'nature/pine_b'], seed, { step: 2, gap: 0.2, skip: (x, y) => y >= 12 && y <= 17 }),
    { prop: 'nature/lamp_post', x: 4.5, y: 12.6 }, { prop: 'nature/lamp_post', x: 15.5, y: 12.6 }, { prop: 'nature/lamp_post', x: 27.5, y: 12.6 }, { prop: 'nature/lamp_post', x: 39.5, y: 12.6 },
    { prop: 'nature/lamp_post', x: 9.5, y: 18.6 }, { prop: 'nature/lamp_post', x: 22.5, y: 18.6 }, { prop: 'nature/lamp_post', x: 36.5, y: 18.6 },
    { prop: 'nature/autumn_tree', x: 7, y: 21 }, { prop: 'nature/autumn_tree', x: 19, y: 25.6 }, { prop: 'nature/pine', x: 6.5, y: 26.4 },
    { prop: 'nature/fence', x: 26.5, y: 19.4 }, { prop: 'nature/fence', x: 35.5, y: 19.4 },
    { prop: 'interiors/wrecked_car', x: 36, y: 24 },
    { prop: 'nature/bush', x: 25.5, y: 25.6 },
  ];
}
