import { forest } from './lib.mjs';
import { BILL_DOOR, BILL_HOUSE, ELDER_HOUSE, H, W, baseCanvas } from './euclydia_layout.mjs';

/** Same square as euclydia_plaza, torn by the rupture. Landmarks stay in place. */
export default function build() {
  const c = baseCanvas();
  // the paving cracks and the fountain becomes the heart of the rift
  c.replace('e', 'k');
  c.replace('l', 'n');
  c.replace('g', 'n');
  c.speckle('.', ';', 0.12, 5);
  // void scars across the square
  c.path([[18, 5], [21, 10]], 1, 'v', ['.', 'k', ';', 'e']);
  c.path([[30, 26], [35, 21]], 2, 'v', ['.', 'k', ';']);
  // professor's corner cut off by a double void band (fill it with blocks or use a rift)
  c.rect(13, 10, 7, 2, 'v');
  c.rect(13, 5, 1, 5, 'v');
  c.rect(19, 5, 1, 5, 'v');
  c.rect(14, 5, 5, 5, 'k');
  // merchant's stall: an island east of the square ringed by a single void line (jump it, or fill it)
  c.rect(33, 10, 5, 1, 'v');
  c.rect(33, 14, 5, 1, 'v');
  c.rect(33, 10, 1, 5, 'v');
  c.rect(34, 11, 4, 3, 'k');
  // bridge half destroyed: middle is gone, swim or go around
  c.set(10, 14, '=').set(11, 14, '=').set(10, 15, '=').set(11, 15, '=');
  // the gate to the observatory lies broken open
  c.rect(24, 0, 1, 6, 'k');
  // rubble walls around Tri's collapsed house
  c.rect(13, 21, 6, 1, 'R');
  c.rect(13, 22, 1, 4, 'R');
  c.rect(18, 22, 1, 4, 'R');
  c.rect(13, 26, 6, 1, 'R');
  c.rect(14, 22, 4, 4, 'k');
  c.set(15, 21, 'k'); // the only gap, blocked by a rubble slab until the glyph lifts it
  const border = forest(c, 'x', ['nature/dead_tree', 'euclydia/round_tree'], 41, { step: 2, gap: 0.3 });
  return {
    id: 'euclydia_rupture', name: 'Euclydia após a ruptura', arc: 1, theme: 'rupture', music: 'rupture', reference: 'euclydia_rupture',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#1a1024', strange: true, darkness: 0.25 },
    buildings: [BILL_HOUSE, ELDER_HOUSE],
    props: [
      ...border,
      { prop: 'rifts/broken_piece_a', x: 17, y: 8.6 }, { prop: 'rifts/broken_piece_b', x: 15.5, y: 25 },
      { prop: 'rifts/ruined_arch', x: 32, y: 24, solid: false },
      { prop: 'rifts/floating_rock', x: 30.5, y: 26.6 },
      { prop: 'rifts/pink_crystal', x: 20.5, y: 18.6 }, { prop: 'rifts/blue_crystal', x: 29, y: 13 },
      { prop: 'euclydia/lamp', x: 17.5, y: 19.4 }, { prop: 'euclydia/lamp', x: 31.5, y: 19.4 },
      { prop: 'rifts/chains', x: 8.5, y: 24.6, solid: false },
      { prop: 'interiors/crate', x: 37, y: 11.4 },
    ],
    spawns: {
      default: { x: 24.5, y: 2.8, dir: 'south' },
      north: { x: 24.5, y: 2.8, dir: 'south' },
      from_house: { x: 34, y: 9.8, dir: 'south' },
    },
    exits: [
      { id: 'bill_door', ...BILL_DOOR, to: 'bill_house', spawn: 'door', kind: 'door' },
      { id: 'to_observatory', x: 24, y: 0, w: 1, h: 1, to: 'observatory', spawn: 'from_rupture' },
    ],
    npcs: [
      { id: 'elder_r', character: 'elder_hexagon', x: 21.5, y: 19.4, dialogue: 'elder_rupture' },
      { id: 'professor_r', character: 'professor_circle', x: 16.5, y: 7.4, dialogue: 'rescue_professor', if: { not: { event: 'rescued', value: 'professor' } } },
      { id: 'merchant_r', character: 'merchant_square', x: 36, y: 12.4, dialogue: 'rescue_merchant', if: { not: { event: 'rescued', value: 'merchant' } } },
      { id: 'artisan_r', character: 'artisan_triangle', x: 16, y: 24.4, dialogue: 'rescue_tri', if: { not: { event: 'rescued', value: 'tri' } } },
    ],
    enemies: [
      { id: 'rupt_shard_1', type: 'shard', x: 27, y: 21 },
      { id: 'rupt_shard_2', type: 'shard', x: 22, y: 12 },
      { id: 'rupt_shard_3', type: 'shard', x: 6, y: 18 },
      { id: 'rupt_teeth', type: 'teeth', x: 33, y: 16 },
    ],
    interactables: [
      { id: 'prof_block_1', kind: 'push', x: 16.5, y: 13.95, label: 'Empurrar bloco' },
      { id: 'prof_block_2', kind: 'push', x: 16.5, y: 15.95, label: 'Empurrar bloco' },
      { id: 'prof_rift_a', kind: 'rift', x: 21.5, y: 13.6, pair: 'prof_rift_b', requires: { ability: 'rift' }, label: 'Abrir fenda' },
      { id: 'prof_rift_b', kind: 'rift', x: 15, y: 8.4, pair: 'prof_rift_a', requires: { ability: 'rift' }, label: 'Abrir fenda' },
      { id: 'merchant_block', kind: 'push', x: 31.5, y: 11.95, label: 'Empurrar bloco' },
      { id: 'tri_glyph', kind: 'glyph', x: 12.4, y: 20.4, hidden: true, reveal: 'perceive', requires: { ability: 'geometry' }, label: 'Activar glifo', effects: [{ setObject: 'tri_rubble', state: 'open' }, { toast: 'O glifo ergue os escombros!' }] },
      { id: 'tri_rubble', kind: 'door', x: 15.5, y: 21.9, prop: 'rifts/broken_piece_a', label: 'Escombros', requires: { flag: 'never' }, requiresText: 'Os escombros não cedem à força. Há qualquer coisa escondida por perto — usa Perceber anomalias (K).' },
      { id: 'broken_fountain', kind: 'repair', x: 24.5, y: 17.6, prop: 'euclydia/crystal_cluster', label: 'Reparar a fonte com um estilhaço', requires: { item: 'geometry_shard' }, requiresText: 'A fonte racharam. Um estilhaço geométrico podia repará-la.', effects: [{ take: 'geometry_shard' }, { var: 'reality', add: 2 }, { var: 'empathy', add: 1 }, { setFlag: 'fountain_repaired' }, { journal: 'j_fountain_repair' }] },
      { id: 'shard_1', kind: 'pickup', x: 7.5, y: 21.6, item: 'geometry_shard', prop: 'rifts/pink_crystal' },
      { id: 'shard_2', kind: 'pickup', x: 35.5, y: 27, item: 'geometry_shard', prop: 'rifts/pink_crystal' },
      { id: 'shard_3', kind: 'pickup', x: 28.5, y: 4.4, item: 'geometry_shard', prop: 'rifts/pink_crystal' },
      { id: 'heart_portal', kind: 'portal', x: 24.5, y: 15.8, prop: 'rifts/void_portal', label: 'Entrar na fenda', requires: { flag: 'rupture_choice' }, requiresText: 'A fenda pulsa. Antes de entrares, fala com a Anciã Hexágono — ela está junto à fonte.', effects: [{ teleport: { map: 'nightmare_realm', spawn: 'default' } }] },
      { id: 'rupt_bench', kind: 'save', x: 26.5, y: 23.6, prop: 'euclydia/bench', solid: true },
    ],
    triggers: [
      { id: 'surge', x: 22, y: 1, w: 5, h: 4, once: true, effects: [{ unlock: 'telekinesis' }, { unlock: 'energy_bolt' }, { toast: 'A ruptura acorda mais poder em Bill: Manipular objectos e Energia dimensional (R para mudar).' }, { journal: 'j_surge' }] },
    ],
    onEnter: [{ questStart: 'a1_q4' }],
  };
}
