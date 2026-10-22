import { BUILDINGS, H, W, townCanvas, townProps } from './town_layout.mjs';

/** The same streets as town_center, invaded by dimensional rifts. */
export default function build() {
  const c = townCanvas();
  c.speckle('o', 'k', 0.25, 9);
  c.speckle('.', ';', 0.2, 10);
  // rifts split the street; the park pond became a void with an islet
  c.path([[22, 11], [24, 18]], 1, 'v', ['o', 'p', 'k']);
  c.rect(9, 20, 9, 6, 'v');
  c.rect(12, 22, 3, 2, 'k');
  // rubble pinning Soos near the diner
  c.rect(2, 19, 2, 1, 'R');
  c.rect(5, 19, 2, 1, 'R');
  c.rect(2, 20, 1, 3, 'R');
  c.rect(6, 20, 1, 3, 'R');
  c.rect(2, 23, 5, 1, 'R');
  c.rect(3, 20, 3, 3, 'k');
  c.set(4, 19, 'k');
  const props = townProps(c, 61).filter((p) => !(p.x > 8 && p.x < 19 && p.y > 19 && p.y < 27));
  return {
    id: 'town_invaded', name: 'Gravity Falls sob intrusão dimensional', arc: 2, theme: 'town', music: 'invaded', reference: 'town_invaded',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#2a1438', strange: true, darkness: 0.3 },
    buildings: BUILDINGS,
    props: [
      ...props,
      { prop: 'rifts/void_portal', x: 36, y: 22.6 },
      { prop: 'rifts/broken_piece_a', x: 27.5, y: 9.6 }, { prop: 'rifts/broken_piece_b', x: 15, y: 18.4 },
      { prop: 'rifts/eye_sigil', x: 22, y: 4.4, solid: false },
      { prop: 'rifts/floating_rock', x: 40, y: 6, layer: 'ground' },
    ],
    spawns: {
      default: { x: 2.5, y: 15, dir: 'east' },
      west: { x: 2.5, y: 15, dir: 'east' },
      east: { x: 41.5, y: 15, dir: 'west' },
      portal: { x: 33, y: 22.5, dir: 'west' },
    },
    exits: [
      { id: 'to_shack', x: 0, y: 13, w: 1, h: 4, to: 'shack_exterior', spawn: 'east' },
      { id: 'to_workshop', x: 43, y: 13, w: 1, h: 4, to: 'mcgucket_workshop', spawn: 'west' },
    ],
    npcs: [
      { id: 'soos_trapped', character: 'soos', x: 4.5, y: 22, dialogue: 'rescue_soos', if: { not: { event: 'rescued', value: 'soos' } } },
      { id: 'pacifica_trapped', character: 'pacifica', x: 13.5, y: 23.2, dialogue: 'rescue_pacifica', if: { not: { event: 'rescued', value: 'pacifica' } } },
      { id: 'wendy_fight', character: 'wendy', x: 30.5, y: 21.4, dialogue: 'rescue_wendy', if: { not: { event: 'rescued', value: 'wendy' } } },
      { id: 'blendin', character: 'blendin', x: 33.5, y: 21.2, dialogue: 'blendin', if: { event: 'rescued', countGte: 1 } },
      { id: 'hectorgon_ally', character: 'hectorgon', x: 22, y: 8.4, dialogue: 'hectorgon_ally', if: { flag: 'bill_ally' } },
    ],
    enemies: [
      { id: 'inv_teeth_1', type: 'teeth', x: 28, y: 22 },
      { id: 'inv_teeth_2', type: 'teeth', x: 33, y: 24 },
      { id: 'inv_pyronica', type: 'pyronica', x: 21, y: 15, dialogue: 'pyronica_town', if: { any: [{ flag: 'bill_threat' }, { flag: 'bill_ambiguous' }] } },
      { id: 'inv_bola8', type: 'bola8', x: 11, y: 15, dialogue: 'bola8_town', if: { flag: 'bill_threat' } },
      { id: 'inv_shard', type: 'shard', x: 37, y: 15 },
    ],
    interactables: [
      { id: 'soos_weak', kind: 'examine', x: 4.5, y: 18.6, hidden: true, reveal: 'flashlight', text: 'A lanterna mostra uma fissura na laje de cima: um empurrão no sítio certo e tudo cede para o lado.', effects: [{ setFlag: 'soos_weakpoint' }] },
      { id: 'soos_slab', kind: 'door', x: 4.5, y: 19.9, prop: 'rifts/broken_piece_b', label: 'Empurrar a laje', requires: { flag: 'soos_weakpoint' }, requiresText: 'A laje é demasiado pesada para empurrar às cegas. Procura o ponto fraco — a lanterna do Dipper ajuda.', effects: [{ toast: 'A laje tomba para o lado!' }] },
      { id: 'park_post_a', kind: 'grapple', x: 15.5, y: 19.4, landing: { x: 15.5, y: 18.6 } },
      { id: 'park_post_b', kind: 'grapple', x: 13.5, y: 22.3, landing: { x: 12.6, y: 22.9 } },
      { id: 'park_hint', kind: 'examine', x: 17.5, y: 18.6, text: 'A Pacifica está numa ilhota no meio do vazio. Há postes amarelos dos dois lados: o gancho da Mabel chega lá.' },
      { id: 'time_gate', kind: 'portal', x: 36, y: 22.4, label: 'Entrar no portal temporal', requires: { item: 'time_tape' }, requiresText: 'Um portal instável. Sem a fita temporal do Blendin não tem destino.', effects: [{ teleport: { map: 'time_city', spawn: 'default' } }] },
      { id: 'inv_bench', kind: 'save', x: 24.5, y: 12.2, prop: 'nature/bench', solid: true },
    ],
    triggers: [
      { id: 'inv_intro', x: 0, y: 12, w: 6, h: 6, once: true, effects: [{ toast: 'A cidade foi invadida. Há pessoas encurraladas: Soos, Pacifica e Wendy.' }, { journal: 'j_invaded' }] },
    ],
    onEnter: [{ questStart: 'b_q6' }],
  };
}
