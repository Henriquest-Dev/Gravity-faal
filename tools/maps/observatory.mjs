import { Canvas, decorate, forest } from './lib.mjs';

export default function build() {
  const W = 34, H = 28;
  const c = new Canvas(W, H, '.');
  c.frame(0, 0, W, H, 'x', 2);
  // upper terrace behind a two-tile cliff face; stairs gap gated by a geometric door
  c.rect(3, 3, 28, 9, 'p');
  c.ellipse(17, 7.5, 5, 3.4, 'g');
  c.rect(2, 12, 30, 2, 'C');
  c.rect(16, 12, 2, 2, 'p');
  // lens alcove (3x4) with two geometric blocks, entered from the west
  c.rect(24, 2, 5, 6, 'x');
  c.rect(25, 3, 3, 4, 'p');
  c.set(24, 5, 'p');
  // courtyard
  c.path([[17, 14], [17, 27]], 3, 'p', ['.', 'x']);
  c.ellipse(17, 20, 6, 3.4, 'm');
  const border = forest(c, 'x', ['euclydia/round_tree'], 51, { step: 2, gap: 0.3, skip: (x, y) => x >= 23 && x <= 29 && y <= 8 });
  return {
    id: 'observatory', name: 'Observatório de Euclydia', arc: 1, theme: 'euclid', music: 'euclydia', reference: 'observatory',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#1e1a33' },
    props: [
      ...border,
      ...decorate(c, '.', ['nature/flower', 'nature/fern'], 10, 12),
      { prop: 'euclydia/observatory', x: 17, y: 6.2 },
      { prop: 'euclydia/stairs', x: 17, y: 14.2, layer: 'ground' },
      { prop: 'euclydia/planter', x: 12.5, y: 18.4 }, { prop: 'euclydia/planter', x: 21.5, y: 18.4 },
      { prop: 'euclydia/lamp', x: 14.6, y: 23.6 }, { prop: 'euclydia/lamp', x: 19.4, y: 23.6 },
      { prop: 'euclydia/obelisk', x: 6.5, y: 9.6 }, { prop: 'euclydia/obelisk', x: 9.5, y: 9.6 },
      { prop: 'euclydia/crystal_cluster', x: 4.5, y: 5.2 },
      { prop: 'euclydia/round_tree', x: 6.5, y: 22.6 }, { prop: 'euclydia/round_tree', x: 27.5, y: 22.4 },
    ],
    spawns: {
      default: { x: 17, y: 25.6, dir: 'north' },
      from_rupture: { x: 17, y: 25.6, dir: 'north' },
    },
    exits: [
      { id: 'to_plaza', x: 16, y: 27, w: 3, h: 1, to: 'euclydia_plaza', spawn: 'from_observatory', if: { not: { flag: 'rupture_started' } } },
      { id: 'to_rupture', x: 16, y: 27, w: 3, h: 1, to: 'euclydia_rupture', spawn: 'north', if: { flag: 'rupture_started' } },
    ],
    interactables: [
      { id: 'terrace_gate', kind: 'door', x: 17, y: 12.2, prop: 'euclydia/stone_door', label: 'Activar a porta geométrica', requires: { ability: 'geometry' }, requiresText: 'A porta tem um triângulo vazio no centro. Só abre a quem saiba activar geometria.' },
      { id: 'plaque', kind: 'examine', x: 13.5, y: 10.6, text: 'Inscrição: "Alinha o céu como o desenhaste em criança". Os três anéis em volta da cúpula mostram símbolos. Consulta a carta estelar no inventário.', effects: [{ journal: 'j_plaque' }], runes: 'AS ESTRELAS MENTEM', teaches: 'ESTN' },
      { id: 'ring_a', kind: 'ring', x: 11.5, y: 9.4, group: 'obs_rings', value: 0, requires: { ability: 'geometry' }, requiresText: 'O anel não se mexe sem geometria.', label: 'Rodar o anel (1.º)', onSolve: [{ setFlag: 'obs_rings_solved' }, { journal: 'j_rings' }] },
      { id: 'ring_b', kind: 'ring', x: 17, y: 10.6, group: 'obs_rings', value: 1, requires: { ability: 'geometry' }, requiresText: 'O anel não se mexe sem geometria.', label: 'Rodar o anel (2.º)' },
      { id: 'ring_c', kind: 'ring', x: 22.5, y: 9.4, group: 'obs_rings', value: 2, requires: { ability: 'geometry' }, requiresText: 'O anel não se mexe sem geometria.', label: 'Rodar o anel (3.º)' },
      { id: 'telescope', kind: 'repair', x: 17, y: 7.6, label: 'Reparar o telescópio', requires: { all: [{ item: 'lens_shard' }, { flag: 'obs_rings_solved' }] }, requiresText: 'O telescópio está sem lente e os anéis não estão alinhados. Procura a lente no nicho a nordeste e alinha os anéis.', effects: [{ unlock: 'rift' }, { setFlag: 'telescope_fixed' }, { journal: 'j_telescope' }, { var: 'reality', add: -1 }] },
      { id: 'block_a', kind: 'push', x: 26.5, y: 4.95, group: 'obs_blocks', label: 'Empurrar bloco' },
      { id: 'block_b', kind: 'push', x: 26.5, y: 5.95, group: 'obs_blocks', label: 'Empurrar bloco' },
      { id: 'blocks_reset', kind: 'switch', x: 22.6, y: 6.6, group: 'obs_blocks', value: -1, label: 'Repor os blocos' },
      { id: 'lens', kind: 'pickup', x: 27.5, y: 3.9, item: 'lens_shard', prop: 'rifts/pink_crystal', label: 'Apanhar a lente', effects: [{ journal: 'j_lens' }] },
      { id: 'rift_terrace', kind: 'rift', x: 6.5, y: 6.6, pair: 'rift_garden', requires: { ability: 'rift' }, requiresText: 'Um ponto onde o ar está mais fino. Ainda não sabes abri-lo.', label: 'Abrir fenda' },
      { id: 'rift_garden', kind: 'rift', x: 8.5, y: 19.6, pair: 'rift_terrace', requires: { ability: 'rift' }, requiresText: 'Um ponto onde o ar está mais fino. Ainda não sabes abri-lo.', label: 'Abrir fenda' },
      { id: 'obs_bench', kind: 'save', x: 21.5, y: 22.4, prop: 'euclydia/bench', solid: true },
    ],
    triggers: [
      { id: 'vision', x: 14, y: 7, w: 7, h: 4, once: true, if: { flag: 'telescope_fixed' }, effects: [{ cutscene: 'a1_vision' }] },
    ],
    onEnter: [{ questStart: 'a1_q3' }],
  };
}
