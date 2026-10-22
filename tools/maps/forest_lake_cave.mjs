import { Canvas, decorate, forest } from './lib.mjs';

export default function build() {
  const W = 50, H = 36;
  const c = new Canvas(W, H, '.');
  c.speckle('.', 'G', 0.06, 4);
  c.frame(0, 0, W, H, 'x', 2);
  c.rect(23, 0, 3, 2, ':');
  // lake with an islet, fed by a stream from the north-west
  c.river([[3, 4], [8, 9], [12, 13]], 1, 1);
  c.ellipse(14, 19, 9, 6.5, '~');
  c.ellipse(14, 19, 7.4, 5, '=');
  c.rect(13, 18, 3, 2, '.');
  // paths
  c.path([[24, 1], [24, 10], [22, 14], [24, 20], [27, 22]], 2, ':', ['.', 'G']);
  c.path([[22, 14], [13, 8]], 2, ':', ['.', 'G']);
  c.path([[24, 20], [24, 29], [6, 30]], 2, ':', ['.', 'G']);
  // ravine (three tiles of void): only the hook crosses it
  c.rect(29, 2, 3, 32, 'v'); // from forest wall to forest wall: no way around
  // cave in the east cliff
  c.rect(33, 6, 15, 22, 'C');
  c.rect(35, 9, 12, 16, ';');
  c.rect(32, 14, 4, 3, ';');
  c.rect(41, 9, 1, 7, 'C');
  c.set(41, 12, ';');
  c.rect(32, 12, 1, 7, ';');
  c.rect(32, 17, 1, 1, ';');
  const skipForest = (x, y) => y < 3 && x > 20 && x < 28;
  return {
    id: 'forest_lake_cave', name: 'Floresta, lago e gruta', arc: 2, theme: 'forest', music: 'forest', reference: 'forest_lake_cave',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#cfe8c0' },
    props: [
      ...forest(c, 'x', ['nature/pine', 'nature/pine_b', 'nature/dead_tree'], 9, { step: 2, gap: 0.15, skip: skipForest }),
      ...decorate(c, '.', ['nature/pine', 'nature/pine_b', 'nature/autumn_tree'], 16, 33, [3, 3, 25, 30]),
      ...decorate(c, '.', ['nature/fern', 'nature/mushrooms', 'nature/flower'], 22, 34),
      ...decorate(c, ';', ['nature/mushrooms'], 6, 35, [35, 9, 12, 16]),
      { prop: 'nature/cattails', x: 6.5, y: 15.6 }, { prop: 'nature/cattails', x: 21.5, y: 22.2 },
      { prop: 'nature/log', x: 26.5, y: 12.6 },
      { prop: 'nature/cave_entrance', x: 33.6, y: 14.2, solid: false, layer: 'ground' },
      { prop: 'nature/rock', x: 36.5, y: 25.2 }, { prop: 'nature/rock_b', x: 46, y: 24.5 },
      { prop: 'nature/stump', x: 12.5, y: 5.6 },
      { prop: 'nature/pine', x: 2.5, y: 33.5, scale: 2, layer: 'foreground' },
      { prop: 'nature/pine_b', x: 47.5, y: 34, scale: 2, layer: 'foreground', flip: true },
    ],
    spawns: { default: { x: 24.5, y: 3, dir: 'south' }, north: { x: 24.5, y: 3, dir: 'south' } },
    exits: [
      { id: 'to_shack', x: 23, y: 0, w: 3, h: 1, to: 'shack_exterior', spawn: 'south', if: { not: { flag: 'town_invaded' } } },
      { id: 'to_shack_invaded', x: 23, y: 0, w: 3, h: 1, to: 'shack_exterior', spawn: 'south', if: { flag: 'town_invaded' } },
    ],
    npcs: [
      { id: 'waddles_lost', character: 'waddles', x: 7.5, y: 30.5, dialogue: 'waddles_lost', wander: 2, if: { not: { flag: 'waddles_home' } } },
    ],
    enemies: [
      { id: 'forest_teeth_1', type: 'teeth', x: 37, y: 19 },
      { id: 'forest_teeth_2', type: 'teeth', x: 44, y: 21 },
    ],
    interactables: [
      { id: 'hollow_tree', kind: 'examine', x: 12.5, y: 6.4, hidden: true, reveal: 'flashlight', label: 'Examinar o tronco oco', text: 'Dentro do tronco oco, embrulhado em oleado: um livro com uma mão de seis dedos e o número 3. Dipper fica sem fôlego. (Nova capacidade: Analisar com o diário)', effects: [{ give: 'journal3' }, { unlock: 'journal_scan' }, { setFlag: 'found_journal' }, { journal: 'j_journal3' }] },
      { id: 'stump_hint', kind: 'examine', x: 15, y: 7.6, text: 'Há marcas de garras a apontar para o tronco ao lado. Está escuro lá dentro — a lanterna do Dipper (K) revelaria mais.' },
      { id: 'power_cell', kind: 'pickup', x: 14.5, y: 19.6, item: 'power_cell', prop: 'interiors/generator', label: 'Apanhar a célula de energia' },
      { id: 'lake_post', kind: 'grapple', x: 15.6, y: 18.5, landing: { x: 14, y: 19.4 } },
      { id: 'lake_shore_post', kind: 'grapple', x: 22.5, y: 16.4, landing: { x: 23.4, y: 16.6 } },
      { id: 'ravine_post_w', kind: 'grapple', x: 28.4, y: 14.6, landing: { x: 28.2, y: 15.4 } },
      { id: 'ravine_post_e', kind: 'grapple', x: 32.5, y: 15.4, landing: { x: 33.6, y: 15.6 } },
      { id: 'ravine_sign', kind: 'examine', x: 26.5, y: 16.6, prop: 'nature/signpost', text: 'Uma ravina sem fundo. Há postes de ancoragem amarelos dos dois lados: só o gancho da Mabel atravessa.' },
      { id: 'ledge_chest', kind: 'chest', x: 11.5, y: 31.4, prop: 'interiors/crate', item: 'medkit', solid: true },
      { id: 'cave_sym_1', kind: 'examine', x: 37.5, y: 10.4, hidden: true, reveal: 'flashlight', text: 'Símbolo na rocha: um triângulo com um olho.', effects: [{ setFlag: 'cave_sym_1' }, { journal: 'j_sym1' }] },
      { id: 'cave_sym_2', kind: 'examine', x: 45.5, y: 23.4, hidden: true, reveal: 'flashlight', text: 'Símbolo na rocha: uma mão de seis dedos.', effects: [{ setFlag: 'cave_sym_2' }, { journal: 'j_sym2' }] },
      { id: 'cave_sym_3', kind: 'examine', x: 36.5, y: 22.4, hidden: true, reveal: 'flashlight', text: 'Símbolo na rocha: uma estrela de cadente com um ponto de interrogação.', effects: [{ setFlag: 'cave_sym_3' }, { journal: 'j_sym3' }] },
      { id: 'cave_door', kind: 'door', x: 41.5, y: 12.9, prop: 'nature/rock', label: 'Empurrar a pedra', requires: { all: [{ flag: 'cave_sym_1' }, { flag: 'cave_sym_2' }, { flag: 'cave_sym_3' }] }, requiresText: 'A pedra tem três cavidades vazias. A gruta esconde três símbolos — a lanterna mostra-os.' },
      { id: 'bunker_card', kind: 'pickup', x: 44.5, y: 11.4, item: 'bunker_key', prop: 'interiors/control_console', label: 'Apanhar o cartão', effects: [{ journal: 'j_bunker_card' }] },
      { id: 'forest_rest', kind: 'save', x: 21.5, y: 8.6, prop: 'nature/stump', label: 'Descansar e gravar' },
    ],
    triggers: [
      { id: 'forest_intro', x: 22, y: 2, w: 5, h: 3, once: true, effects: [{ toast: 'Na água profunda nadas devagar e não podes atacar. Sai pelas margens de terra.' }] },
      { id: 'cave_dark', x: 32, y: 13, w: 3, h: 5, once: true, effects: [{ toast: 'Está escuro na gruta. A lanterna do Dipper revela símbolos e atordoa os Teeth.' }] },
    ],
    onEnter: [{ questStart: 'b_q3' }],
  };
}
