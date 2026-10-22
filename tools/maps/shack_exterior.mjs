import { Canvas, forest, shiftDown } from './lib.mjs';

/**
 * The Mystery Shack at dusk, composed after the catalogue reference: the Shack
 * in a clearing at the top, a dirt path down to the plank bridge over the
 * creek, the creek falling from the western cliff, the road east to town and
 * dark pines all around. Decoration is deliberate and sparse.
 */
export default function build() {
  const W = 44, H = 32;
  const c = new Canvas(W, H, '.');
  c.frame(0, 0, W, H, 'x', 3);
  c.rect(0, 0, W, 4, 'x');
  // west lookout on a ledge, reached by a ladder through a two-tile cliff face
  c.rect(3, 4, 8, 7, 'x');
  c.rect(3, 9, 8, 2, 'C');
  c.rect(4, 5, 6, 4, ',');
  c.set(7, 9, 'H').set(7, 10, 'H');
  // the creek: drops from the west, widens into a pool in the south-east
  c.river([[2, 14], [9, 17], [16, 20], [30, 20], [43, 21]], 2, 1);
  c.ellipse(35, 25, 6, 3.2, '~');
  c.ellipse(35, 25, 4.6, 2.2, '=');
  c.rect(34, 25, 2, 1, ',');
  // clearing and paths (worn dirt)
  c.rect(12, 11, 20, 3, ':');
  c.path([[21.5, 11], [21.5, 31]], 3, ':', ['.', ',', 'x']);
  c.path([[26, 12], [36, 13], [43, 12]], 3, ':', ['.', ',', 'x']);
  c.path([[17, 12], [11, 13], [7, 12]], 2, ':', ['.', ',']);
  for (let y = 14; y < 26; y++) for (const x of [21, 22]) if ('~='.includes(c.get(x, y))) c.set(x, y, 'B');
  c.set(20, 31, ':').set(23, 31, ':');
  // darker undergrowth at the forest edge
  for (let y = 4; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    const nearEdge = c.get(x - 1, y) === 'x' || c.get(x + 1, y) === 'x' || c.get(x, y - 1) === 'x' || c.get(x, y + 1) === 'x';
    if (nearEdge && c.get(x, y) === '.') c.set(x, y, ',');
  }

  const trees = forest(c, 'x', ['nature/pine', 'nature/pine_b'], 7, { gap: 0.05, skip: (x, y) => (y > 27 && x > 17 && x < 26) || (x > 39 && y > 9 && y < 15) });
  const foreground = [];
  for (let x = 0; x < W; x += 3) foreground.push({ prop: x % 2 ? 'nature/pine_b' : 'nature/pine', x: x + 1, y: H + 1.6, scale: 2, layer: 'foreground', flip: x % 4 === 0 });

  const top = new Canvas(W, 4, 'x');
  const topTrees = forest(top, 'x', ['nature/pine', 'nature/pine_b'], 11, { gap: 0.05 });
  const def = shiftDown({
    id: 'shack_exterior', name: 'Cabana do Mistério', arc: 2, theme: 'forest', music: 'shack', reference: 'shack_exterior',
    width: W, height: H, terrain: c.rows(),
    ambient: { motes: 'fireflies', night: 0.5, eyes: 4 },
    buildings: [
      { id: 'mystery_shack', x: 14, y: 6, w: 15, h: 5, style: 'shack', wallHeight: 4, roofHeight: 3, door: { x: 21, exit: 'shack_door' }, windows: [15, 17, 25, 27] },
    ],
    props: [
      ...trees, ...foreground,
      // a few deliberate pines inside the clearing frame the Shack
      { prop: 'nature/pine', x: 10.5, y: 16.4 }, { prop: 'nature/pine_b', x: 33.6, y: 16.2, flip: true },
      { prop: 'nature/pine', x: 12.4, y: 26.8 }, { prop: 'nature/pine_b', x: 28.4, y: 29.2 },
      { prop: 'nature/woodshed', x: 34.6, y: 10.4 },
      { prop: 'nature/lamp_post', x: 19.4, y: 11.4 },
      { prop: 'nature/lamp_post', x: 23.6, y: 17.6 },
      { prop: 'nature/lamp_post', x: 36.5, y: 12.2 },
      { prop: 'nature/mailbox', x: 24.6, y: 14.6 },
      { prop: 'nature/stump', x: 31.5, y: 15.4 },
      { prop: 'nature/stump', x: 15.4, y: 24.8 },
      { prop: 'nature/rock', x: 13.5, y: 22.6 },
      { prop: 'nature/rock_b', x: 29.5, y: 23.2 },
      { prop: 'nature/cattails', x: 10.5, y: 15.8 },
      { prop: 'nature/cattails', x: 27.5, y: 18.6 },
      { prop: 'nature/log', id: 'tutorial_log', x: 9.8, y: 13.6 },
      { prop: 'nature/fence', x: 31.5, y: 13.6 },
    ],
    spawns: {
      default: { x: 21.5, y: 15, dir: 'north' },
      door: { x: 21.5, y: 12.2, dir: 'south' },
      east: { x: 41, y: 13, dir: 'west' },
      south: { x: 21.5, y: 29.5, dir: 'north' },
    },
    exits: [
      { id: 'shack_door', x: 21, y: 10, w: 1, h: 1, to: 'shack_interior', spawn: 'door', kind: 'door' },
      { id: 'to_town_invaded', x: 43, y: 11, w: 1, h: 3, to: 'town_invaded', spawn: 'west', if: { flag: 'town_invaded' } },
      { id: 'to_town', x: 43, y: 11, w: 1, h: 3, to: 'town_center', spawn: 'west', if: { not: { flag: 'town_invaded' } }, requires: { flag: 'stan_briefing' }, lockedText: 'Melhor ouvir primeiro o que o tio-avô Stan tem para dizer. Ele está lá dentro.' },
      { id: 'to_forest', x: 20, y: 31, w: 4, h: 1, to: 'forest_lake_cave', spawn: 'north', requires: { flag: 'stan_briefing' }, lockedText: 'A floresta ao anoitecer? Primeiro falem com o Stan, lá dentro.' },
    ],
    npcs: [
      { id: 'soos', character: 'soos', x: 33, y: 12.2, dir: 'west', dialogue: 'soos', if: { not: { flag: 'town_invaded' } } },
      { id: 'wendy', character: 'wendy', x: 26.4, y: 12.4, dir: 'south', dialogue: 'wendy', if: { not: { flag: 'town_invaded' } } },
      { id: 'waddles_home', character: 'waddles', x: 18.5, y: 14.5, dialogue: 'waddles', wander: 2, if: { flag: 'waddles_home' } },
      { id: 'bill_echo_shack', character: 'bill', x: 37.5, y: 17.5, dialogue: 'bill_shack', if: { all: [{ flag: 'bill_ambiguous' }, { not: { flag: 'bill_shack_seen' } }] } },
    ],
    enemies: [
      { id: 'shack_teeth', type: 'teeth', x: 34, y: 17.5, if: { flag: 'bill_threat' } },
    ],
    interactables: [
      { id: 'sign_shack', kind: 'examine', x: 19.5, y: 15.6, prop: 'nature/signpost', label: 'Ler a placa', text: '"CABANA DO MISTÉRIO — Atracções genuínas! Entrada: dez dólares. Saída: outros dez." Alguém riscou "genuínas" a lápis.' },
      { id: 'lookout_chest', kind: 'chest', x: 6.5, y: 6.8, prop: 'interiors/crate', item: 'medkit', label: 'Abrir a caixa', solid: true },
      { id: 'rest_bench', kind: 'save', x: 28.6, y: 14.8, prop: 'nature/bench', label: 'Sentar e gravar', solid: true },
      { id: 'grapple_post_pond', kind: 'grapple', x: 35.6, y: 25.7, landing: { x: 34.5, y: 25.9 } },
      { id: 'islet_snack', kind: 'pickup', x: 34.4, y: 25.6, item: 'waddles_snack', label: 'Apanhar a bolacha' },
      { id: 'mailbox_note', kind: 'examine', x: 24.6, y: 15.1, label: 'Espreitar o correio', text: 'Cartas por abrir há trinta anos, endereçadas a "Stanford Pines". O Stan assina tudo como Stanford. Estranho.' },
    ],
    triggers: [
      { id: 'tut_water', x: 18, y: 16, w: 8, h: 2, once: true, effects: [{ toast: 'Água funda: nadas devagar e só sais por margens baixas.' }] },
    ],
    checkpoints: [{ id: 'shack_front', x: 21.5, y: 14.5 }],
    onEnter: [{ questStart: 'b_q1' }],
  }, 4);
  def.props.push(...topTrees);
  return def;
}
