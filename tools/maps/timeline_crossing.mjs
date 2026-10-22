import { Canvas } from './lib.mjs';

/**
 * Crossing of timelines: three walkways lead to three gates. Echoes of both
 * arcs float around (Euclydia's crystals, Gravity Falls' pines and mailbox).
 */
export default function build() {
  const W = 40, H = 30;
  const c = new Canvas(W, H, 'v');
  c.rect(16, 23, 8, 5, 'r'); // arrival
  c.rect(18, 15, 4, 8, 'n'); // central causeway
  c.rect(12, 12, 16, 4, 'r'); // crossroads
  c.path([[13, 13], [6, 6]], 2, 'e', ['v']); // to the Euclydia-coloured gate
  c.path([[20, 12], [20, 5]], 2, 'T', ['v']); // to the temporal gate
  c.path([[27, 13], [34, 6]], 2, 'o', ['v']); // to the Gravity Falls gate
  c.rect(3, 2, 6, 4, 'e');
  c.rect(17, 1, 6, 4, 'T');
  c.rect(31, 2, 6, 4, 'o');
  return {
    id: 'timeline_crossing', name: 'Travessia das linhas temporais', arc: 2, theme: 'nightmare', music: 'temporal', reference: 'timeline_crossing',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#0b0618', strange: true, darkness: 0.15 },
    props: [
      { prop: 'euclydia/crystal_cluster', x: 5, y: 9, layer: 'ground' },
      { prop: 'euclydia/round_tree', x: 10, y: 25, layer: 'ground' },
      { prop: 'nature/pine', x: 33, y: 24, layer: 'ground' },
      { prop: 'nature/mailbox', x: 29, y: 20, layer: 'ground' },
      { prop: 'temporal/clock_tower', x: 37, y: 14, layer: 'ground' },
      { prop: 'rifts/floating_rock', x: 3, y: 19, layer: 'ground' },
      { prop: 'euclydia/portal_ring', x: 6, y: 4.2 },
      { prop: 'temporal/time_gate', x: 20, y: 3.2 },
      { prop: 'rifts/void_portal', x: 34, y: 4.2 },
    ],
    spawns: { default: { x: 20, y: 26, dir: 'north' } },
    exits: [{ id: 'back', x: 16, y: 27, w: 8, h: 1, to: 'time_baby_arena', spawn: 'north' }],
    npcs: [
      { id: 'bill_final_ally', character: 'bill', x: 16, y: 13.6, dialogue: 'bill_final', if: { any: [{ flag: 'bill_ally' }, { flag: 'bill_ambiguous' }] } },
      { id: 'bill_final_threat', character: 'bill', x: 24, y: 13.6, dialogue: 'bill_final_threat', if: { flag: 'bill_threat' } },
      { id: 'ford_final', character: 'ford', x: 22, y: 24.6, dialogue: 'ford_final', if: { flag: 'ford_rescued' } },
    ],
    interactables: [
      { id: 'gate_restore', kind: 'npcProxy', x: 20, y: 4.4, text: 'gate_restore', label: 'Portão do tempo restaurado' },
      { id: 'gate_sacrifice', kind: 'npcProxy', x: 34, y: 5.4, text: 'gate_sacrifice', label: 'Portão de Gravity Falls' },
      { id: 'gate_dominate', kind: 'npcProxy', x: 6, y: 5.4, text: 'gate_dominate', label: 'Portão de Euclydia' },
      { id: 'crossing_pad', kind: 'save', x: 17.5, y: 24.4, prop: 'temporal/pad', label: 'Ponto de controlo' },
      { id: 'echo_euclydia', kind: 'examine', x: 13.4, y: 14.8, text: 'Um eco de Euclydia: a fonte de cristal, tal como Bill a deixou. O que fizeste no primeiro arco ainda brilha (ou range) aqui.' },
    ],
    onEnter: [{ questStart: 'b_q10' }],
  };
}
