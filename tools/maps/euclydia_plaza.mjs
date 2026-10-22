import { decorate, forest } from './lib.mjs';
import { BILL_DOOR, BILL_HOUSE, H, HOUSES, W, baseCanvas, terraces, trees } from './euclydia_layout.mjs';

export default function build() {
  const c = baseCanvas();
  c.path([[30, 11], [34, 9.5]], 2, '.', ['e']);
  const stairs = terraces(c);
  const border = forest(c, 'x', ['euclydia/round_tree'], 41, { step: 2, gap: 0.25 });
  return {
    id: 'euclydia_plaza', name: 'Praça de Euclydia', arc: 1, theme: 'euclid', music: 'euclydia', reference: 'euclydia_plaza',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#fff1d6' },
    buildings: [...HOUSES, BILL_HOUSE],
    props: [
      ...border, ...trees(), ...stairs,
      ...decorate(c, '.', ['nature/flower', 'nature/fern'], 14, 77),
      { prop: 'euclydia/fountain', x: 24.5, y: 16.2 },
      { prop: 'euclydia/crystal_cluster', x: 24.5, y: 15.4, solid: false },
      { prop: 'euclydia/lamp', x: 17.5, y: 12.2 }, { prop: 'euclydia/lamp', x: 31.5, y: 12.2 },
      { prop: 'euclydia/lamp', x: 17.5, y: 19.4 }, { prop: 'euclydia/lamp', x: 31.5, y: 19.4 },
      { prop: 'euclydia/planter', x: 20.5, y: 10.3 }, { prop: 'euclydia/planter', x: 28.5, y: 10.3 },
      { prop: 'euclydia/obelisk', x: 13.5, y: 12.4 },
      { prop: 'euclydia/vine_arch', x: 24.5, y: 6.2, solid: false },
      { prop: 'interiors/crate', x: 29.6, y: 11.2 }, { prop: 'interiors/crate', x: 30.4, y: 11.9 }, { prop: 'interiors/barrel', x: 27.4, y: 11.6 },
      { prop: 'euclydia/table', x: 30.5, y: 19.8 },
    ],
    spawns: {
      default: { x: 24.5, y: 20.5, dir: 'north' },
      from_house: { x: 34, y: 9.8, dir: 'south' },
      from_observatory: { x: 24.5, y: 2.8, dir: 'south' },
    },
    exits: [
      { id: 'bill_door', ...BILL_DOOR, to: 'bill_house', spawn: 'door', kind: 'door' },
      { id: 'to_observatory', x: 24, y: 0, w: 1, h: 1, to: 'observatory', spawn: 'default' },
    ],
    npcs: [
      { id: 'professor', character: 'professor_circle', x: 20.5, y: 12.6, dialogue: 'professor' },
      { id: 'merchant', character: 'merchant_square', x: 28.5, y: 12.8, dialogue: 'merchant' },
      { id: 'artisan', character: 'artisan_triangle', x: 29.5, y: 19.2, dialogue: 'artisan_plaza' },
      { id: 'elder', character: 'elder_hexagon', x: 5.5, y: 11.8, dialogue: 'elder' },
    ],
    interactables: [
      { id: 'fountain_core', kind: 'examine', x: 24.5, y: 17.4, label: 'Examinar o cristal', text: 'O cristal da fonte zumbe. Quando Bill o toca, as arestas do mundo ficam nítidas como nunca: há formas a tremer onde mais ninguém olha. (Nova capacidade: Perceber anomalias — K)', effects: [{ unlock: 'perceive' }, { setFlag: 'fountain_examined' }, { journal: 'j_fountain' }] },
      { id: 'anomaly_1', kind: 'examine', x: 14.5, y: 8.6, hidden: true, reveal: 'perceive', text: 'Um triângulo desenhado no chão... que não projecta sombra. Está virado para o observatório.', effects: [{ setFlag: 'anomaly_1' }, { journal: 'j_anom1' }] },
      { id: 'anomaly_2', kind: 'examine', x: 34.5, y: 18.8, hidden: true, reveal: 'perceive', text: 'Pedras dispostas em forma de olho. Quando pestanejas, o olho pestaneja contigo.', effects: [{ setFlag: 'anomaly_2' }, { journal: 'j_anom2' }] },
      { id: 'anomaly_3', kind: 'examine', x: 4.5, y: 21.6, hidden: true, reveal: 'perceive', text: 'Uma espiral suspensa no ar, do outro lado do rio. Gira ao contrário dos ponteiros do relógio de sol.', effects: [{ setFlag: 'anomaly_3' }, { journal: 'j_anom3' }] },
      { id: 'north_gate', kind: 'door', x: 24.5, y: 4.9, prop: 'euclydia/stone_door', label: 'Abrir o portão', requires: { all: [{ item: 'elder_token' }, { ability: 'geometry' }] }, requiresText: 'O portão do observatório tem um selo hexagonal e um triângulo vazio. Precisa do Selo do Ancião e de quem saiba activar geometria.' },
      { id: 'plaza_bench', kind: 'save', x: 19.5, y: 21.4, prop: 'euclydia/bench', label: 'Descansar e gravar', solid: true },
      { id: 'sign_plaza', kind: 'examine', x: 14.5, y: 16.6, text: 'Placa: "Praça das Arestas. A oeste, a casa da Anciã Hexágono. A norte, o observatório (acesso com selo)."' },
    ],
    triggers: [
      { id: 'intro', x: 20, y: 18, w: 9, h: 5, once: true, effects: [{ toast: 'Fala com as pessoas (E). Algo no cristal da fonte chama por ti.' }] },
    ],
    checkpoints: [{ id: 'fountain', x: 24.5, y: 20.5 }],
    onEnter: [{ questStart: 'a1_q1' }],
  };
}
