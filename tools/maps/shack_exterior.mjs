import { Canvas, decorate, forest } from './lib.mjs';

export default function build() {
  const W = 44, H = 32;
  const c = new Canvas(W, H, '.');
  // forest walls around the clearing
  c.frame(0, 0, W, H, 'x', 3);
  c.rect(0, 0, W, 4, 'x');
  // west plateau with ladder (cliff faces are two tiles tall on the south side)
  c.rect(3, 4, 8, 7, 'x');
  c.rect(3, 9, 8, 2, 'C');
  c.rect(4, 5, 6, 4, '.');
  c.set(7, 9, 'H').set(7, 10, 'H');
  // stream: falls from the west forest, wide pool to the east
  c.river([[2, 14], [9, 17], [16, 20], [30, 20], [43, 21]], 2, 1);
  c.ellipse(35, 25, 6, 3.2, '~');
  c.ellipse(35, 25, 4.6, 2.2, '=');
  c.rect(34, 25, 2, 1, '.'); // islet
  // paths
  c.rect(13, 11, 18, 3, ':');
  c.path([[21.5, 11], [21.5, 31]], 3, ':', ['.', ',', 'x']);
  c.path([[24, 12], [43, 12]], 3, ':', ['.', ',', 'x']);
  c.path([[19, 12], [12, 13], [7, 12]], 2, ':', ['.', ',']);
  c.path([[21.5, 24], [27, 27], [31, 28]], 2, ':', ['.', ',']);
  // bridge over every water tile on the path columns
  for (let y = 14; y < 26; y++) for (const x of [21, 22]) if ('~='.includes(c.get(x, y))) c.set(x, y, 'B');
  c.set(20, 31, ':').set(23, 31, ':');

  const keep = [[12, 5, 20, 10], [18, 13, 8, 12], [0, 10, 44, 4], [5, 4, 6, 9], [28, 12, 6, 6]];
  const free = (x, y) => keep.some(([kx, ky, kw, kh]) => x >= kx && y >= ky && x < kx + kw && y < ky + kh);
  const trees = forest(c, 'x', ['nature/pine', 'nature/pine_b'], 7, { skip: (x, y) => (y > 27 && x > 17 && x < 26) || (x > 39 && y > 9 && y < 15) });
  const inner = decorate(c, '.', ['nature/pine', 'nature/pine_b', 'nature/pine'], 14, 23).filter((p) => !free(Math.floor(p.x), Math.floor(p.y)));
  const deco = decorate(c, '.', ['nature/fern', 'nature/flower', 'nature/mushrooms'], 18, 5);
  const foreground = [];
  for (let x = 0; x < W; x += 3) foreground.push({ prop: x % 2 ? 'nature/pine_b' : 'nature/pine', x: x + 1, y: H + 1.6, scale: 2, layer: 'foreground', flip: x % 4 === 0 });

  return {
    id: 'shack_exterior', name: 'Exterior da Cabana do Mistério', arc: 2, theme: 'forest', music: 'shack', reference: 'shack_exterior',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#ffe7b0', motes: 'pollen' },
    buildings: [
      { id: 'mystery_shack', x: 14, y: 6, w: 15, h: 5, style: 'shack', wallHeight: 2.5, roofHeight: 3, door: { x: 21, exit: 'shack_door' }, windows: [16, 18, 25, 27], sign: 'MYSTERY SHACK' },
      { id: 'shed', x: 31, y: 7, w: 4, h: 3, style: 'cabin', wallHeight: 2, roofHeight: 2 },
    ],
    props: [
      ...trees, ...inner, ...deco, ...foreground,
      { prop: 'nature/mailbox', x: 24.5, y: 14.8 },
      { prop: 'nature/lamp_post', x: 19.2, y: 11.2 },
      { prop: 'nature/woodshed', x: 36.5, y: 10.6 },
      { prop: 'nature/stump', x: 31.5, y: 15.2 },
      { prop: 'nature/rock', x: 13.5, y: 23.2 },
      { prop: 'nature/rock_b', x: 29.5, y: 23.5 },
      { prop: 'nature/cattails', x: 10.5, y: 15.8 },
      { prop: 'nature/cattails', x: 28.5, y: 18.6 },
      { prop: 'nature/log', id: 'tutorial_log', x: 9.8, y: 13.6 },
      { prop: 'nature/fence', x: 31.5, y: 13.6 },
      { prop: 'nature/fence', x: 34.5, y: 13.6 },
    ],
    spawns: {
      default: { x: 21.5, y: 15, dir: 'south' },
      door: { x: 21.5, y: 12.2, dir: 'south' },
      east: { x: 41, y: 13, dir: 'west' },
      south: { x: 21.5, y: 29.5, dir: 'north' },
    },
    exits: [
      { id: 'shack_door', x: 21, y: 10, w: 1, h: 1, to: 'shack_interior', spawn: 'door', kind: 'door' },
      { id: 'to_town_invaded', x: 43, y: 11, w: 1, h: 3, to: 'town_invaded', spawn: 'west', if: { flag: 'town_invaded' } },
      { id: 'to_town', x: 43, y: 11, w: 1, h: 3, to: 'town_center', spawn: 'west', if: { not: { flag: 'town_invaded' } }, requires: { flag: 'stan_briefing' }, lockedText: 'O Stan quer falar convosco antes de irem à cidade. Ele está dentro da Cabana.' },
      { id: 'to_forest', x: 20, y: 31, w: 4, h: 1, to: 'forest_lake_cave', spawn: 'north', requires: { flag: 'stan_briefing' }, lockedText: 'Primeiro falem com o Stan, dentro da Cabana.' },
    ],
    npcs: [
      { id: 'soos', character: 'soos', x: 17.5, y: 14.2, dialogue: 'soos', wander: 2, if: { not: { flag: 'town_invaded' } } },
      { id: 'wendy', character: 'wendy', x: 26.5, y: 13.2, dir: 'south', dialogue: 'wendy', if: { not: { flag: 'town_invaded' } } },
      { id: 'waddles_home', character: 'waddles', x: 30.5, y: 16.5, dialogue: 'waddles', wander: 2, if: { flag: 'waddles_home' } },
      { id: 'bill_echo_shack', character: 'bill', x: 37.5, y: 16.5, dialogue: 'bill_shack', if: { all: [{ flag: 'bill_ambiguous' }, { not: { flag: 'bill_shack_seen' } }] } },
    ],
    enemies: [
      { id: 'shack_teeth', type: 'teeth', x: 34, y: 16.5, if: { flag: 'bill_threat' } },
    ],
    interactables: [
      { id: 'sign_shack', kind: 'examine', x: 19.5, y: 15.6, prop: 'nature/signpost', text: 'CABANA DO MISTÉRIO — entrada pela porta da frente. À direita: cidade de Gravity Falls. A sul, a ponte leva à floresta e ao lago.' },
      { id: 'sign_jump', kind: 'examine', x: 12.5, y: 15.2, text: 'Um tronco caído bloqueia o atalho. Salta por cima dele (Espaço / botão ⤒). Paredes e árvores não se saltam.' },
      { id: 'ladder_note', kind: 'examine', x: 8.5, y: 11.4, text: 'Uma escada de mão sobe ao miradouro. Aproxima-te dela e sobe com ↑.' },
      { id: 'lookout_chest', kind: 'chest', x: 6.5, y: 6.8, prop: 'interiors/crate', item: 'medkit', label: 'Abrir caixa', solid: true },
      { id: 'rest_bench', kind: 'save', x: 28.5, y: 14.6, prop: 'nature/bench', label: 'Descansar e gravar', solid: true },
      { id: 'grapple_post_pond', kind: 'grapple', x: 35.6, y: 25.7, landing: { x: 34.5, y: 25.9 }, label: 'Poste de ancoragem' },
      { id: 'islet_snack', kind: 'pickup', x: 34.4, y: 25.6, item: 'waddles_snack', label: 'Apanhar bolacha', prop: 'nature/mushrooms' },
      { id: 'mailbox_note', kind: 'examine', x: 24.5, y: 15.2, text: 'Correio para "Stanford Pines". Parece que ninguém o abre há trinta anos.', if: { arc: 2 } },
    ],
    triggers: [
      { id: 'tut_move', x: 18, y: 13, w: 8, h: 4, once: true, effects: [{ toast: 'Mover: WASD/setas ou joystick. Correr: Shift ou empurrar o joystick até ao fim.' }] },
      { id: 'tut_water', x: 18, y: 16, w: 8, h: 2, once: true, effects: [{ toast: 'Água rasa abranda. Na água profunda nadas — só sais por margens acessíveis.' }] },
    ],
    checkpoints: [{ id: 'shack_front', x: 21.5, y: 14.5 }],
    onEnter: [{ questStart: 'b_q1' }],
  };
}
