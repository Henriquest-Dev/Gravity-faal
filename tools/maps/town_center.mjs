import { decorate } from './lib.mjs';
import { BUILDINGS, H, W, townCanvas, townProps } from './town_layout.mjs';

export default function build() {
  const c = townCanvas();
  return {
    id: 'town_center', name: 'Centro de Gravity Falls', arc: 2, theme: 'town', music: 'town', reference: 'town_center',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#ffe9c4' },
    buildings: BUILDINGS,
    props: [...townProps(c, 61), ...decorate(c, '.', ['nature/flower', 'nature/fern'], 10, 3, [5, 19, 16, 8])],
    spawns: {
      default: { x: 3, y: 15, dir: 'east' },
      west: { x: 2.5, y: 15, dir: 'east' },
      east: { x: 41.5, y: 15, dir: 'west' },
    },
    exits: [
      { id: 'to_shack', x: 0, y: 13, w: 1, h: 4, to: 'shack_exterior', spawn: 'east' },
      { id: 'to_workshop', x: 43, y: 13, w: 1, h: 4, to: 'mcgucket_workshop', spawn: 'west' },
    ],
    npcs: [
      { id: 'pacifica', character: 'pacifica', x: 12, y: 21.4, dialogue: 'pacifica', wander: 2 },
      { id: 'felicia', character: 'felicia', x: 31.5, y: 21.6, dialogue: 'felicia', wander: 2 },
      { id: 'wendy_town', character: 'wendy', x: 8.5, y: 12.6, dir: 'south', dialogue: 'wendy_town', if: { quest: 'b_q4', state: 'active' } },
    ],
    interactables: [
      { id: 'notice_board', kind: 'examine', x: 18.5, y: 12.2, prop: 'nature/signpost', label: 'Ler o quadro', text: 'Avisos: "Luzes verdes sobre o lago — terceira noite seguida." "Perdido: porco chamado Waddles, responde a bolachas de milho." "Oficina McGucket: compram-se peças."', effects: [{ setFlag: 'rumor_cave' }, { questStart: 'b_s1' }, { journal: 'j_notice' }] },
      { id: 'hardware_crate', kind: 'chest', x: 34.5, y: 12.2, prop: 'interiors/crate', item: 'wire_coil', label: 'Procurar no caixote', requires: { quest: 'b_q4', state: ['active', 'done'] }, requiresText: 'Caixotes de material da loja de ferragens. Por agora não precisas de nada.', solid: true },
      { id: 'park_bench', kind: 'save', x: 16.5, y: 23.6, prop: 'nature/bench', solid: true },
      { id: 'diner_menu', kind: 'examine', x: 11.5, y: 11.6, text: 'Menu do Greasy\'s: panquecas com forma de cara. A Lazy Susan pisca um olho a quem passa.' },
      { id: 'town_snack', kind: 'pickup', x: 26.5, y: 24, item: 'energy_snack', prop: 'interiors/barrel', label: 'Apanhar Pitt Cola' },
    ],
    onEnter: [{ questStart: 'b_q2' }],
  };
}
