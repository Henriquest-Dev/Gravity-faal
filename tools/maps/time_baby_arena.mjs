import { Canvas } from './lib.mjs';

export default function build() {
  const W = 32, H = 28;
  const c = new Canvas(W, H, 'v');
  c.ellipse(16, 14, 12.5, 9.5, 'T');
  c.ellipse(16, 14, 5, 3, 'g');
  c.rect(14, 23, 4, 5, 't'); // entrance walkway
  c.rect(14, 1, 4, 4, 't'); // exit walkway (north)
  // four pillars give cover from projectiles
  for (const [x, y] of [[9, 9], [22, 9], [9, 18], [22, 18]]) c.rect(x, y, 1, 1, '#');
  return {
    id: 'time_baby_arena', name: 'Arena do Bebé do Tempo', arc: 2, theme: 'temporal', music: 'boss', reference: 'time_baby_arena',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#05100f', strange: true, darkness: 0.15 },
    props: [
      { prop: 'temporal/throne', x: 16, y: 7.2 },
      { prop: 'temporal/hourglass_frame', x: 6.5, y: 14 }, { prop: 'temporal/hourglass_frame', x: 25.5, y: 14, flip: true },
      { prop: 'temporal/wheel', x: 16, y: 26.5, layer: 'ground' },
    ],
    spawns: { default: { x: 16, y: 25, dir: 'north' }, north: { x: 16, y: 3.6, dir: 'south' } },
    exits: [
      { id: 'to_city', x: 14, y: 27, w: 4, h: 1, to: 'time_city', spawn: 'arena' },
      { id: 'to_crossing', x: 14, y: 1, w: 4, h: 1, to: 'timeline_crossing', spawn: 'default', requires: { any: [{ defeated: 'time_baby' }, { flag: 'baby_calmed' }, { flag: 'baby_bargain' }] }, lockedText: 'O Bebé do Tempo bloqueia a passagem para as linhas temporais.' },
    ],
    enemies: [
      { id: 'time_baby', type: 'time_baby', x: 16, y: 10.5, if: { all: [{ not: { flag: 'baby_calmed' } }, { not: { flag: 'baby_bargain' } }, { flag: 'baby_fight' }] } },
    ],
    npcs: [
      { id: 'baby_idle', character: 'time_baby', x: 16, y: 10.5, dialogue: 'baby_intro', if: { all: [{ not: { flag: 'baby_fight' } }, { not: { flag: 'baby_calmed' } }, { not: { flag: 'baby_bargain' } }] } },
      { id: 'baby_calm', character: 'time_baby', x: 16, y: 10.5, dialogue: 'baby_after', if: { any: [{ flag: 'baby_calmed' }, { flag: 'baby_bargain' }] } },
    ],
    interactables: [
      { id: 'arena_pad', kind: 'save', x: 17.6, y: 24.6, prop: 'temporal/pad', label: 'Ponto de controlo' },
    ],
    triggers: [
      { id: 'baby_meet', x: 12, y: 13, w: 8, h: 6, once: true, if: { not: { flag: 'baby_fight' } }, dialogue: 'baby_intro' },
    ],
    onEnter: [{ questStart: 'b_q9' }],
  };
}
