import { Canvas } from './lib.mjs';

export default function build() {
  const W = 34, H = 26;
  const c = new Canvas(W, H, '#');
  c.rect(2, 9, 30, 13, 'T'); // main hall
  c.rect(15, 22, 4, 4, 't'); // entrance
  c.rect(4, 4, 6, 5, 't'); // cell 1 (Ford)
  c.rect(14, 4, 6, 5, 't'); // cell 2
  c.rect(24, 4, 6, 5, 't'); // storage
  c.rect(6, 9, 2, 1, 't');
  c.rect(16, 9, 2, 1, 't');
  c.rect(26, 9, 2, 1, 't');
  // shelves split the hall into aisles
  for (const y of [12, 16]) { c.rect(4, y, 9, 1, '#'); c.rect(21, y, 9, 1, '#'); }
  return {
    id: 'time_archive', name: 'Arquivo e prisão temporal', arc: 2, theme: 'temporal', music: 'temporal', reference: 'time_archive',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#061416', strange: true, darkness: 0.25 },
    props: [
      { prop: 'temporal/archive_shelf', x: 6, y: 12.9 }, { prop: 'temporal/archive_shelf', x: 10, y: 12.9 },
      { prop: 'temporal/archive_shelf', x: 23, y: 16.9 }, { prop: 'temporal/archive_shelf', x: 27, y: 16.9 },
      { prop: 'temporal/capsule', x: 15.5, y: 5.6 }, { prop: 'temporal/capsule', x: 18.5, y: 5.6 },
      { prop: 'temporal/lamp', x: 3, y: 20.6 }, { prop: 'temporal/lamp', x: 31, y: 20.6 },
      { prop: 'temporal/time_console', x: 17, y: 11.2 },
    ],
    spawns: { default: { x: 17, y: 23.6, dir: 'north' } },
    exits: [{ id: 'to_city', x: 15, y: 25, w: 4, h: 1, to: 'time_city', spawn: 'archive' }],
    npcs: [
      { id: 'ford_cell', character: 'ford', x: 7, y: 6, dialogue: 'rescue_ford', if: { not: { flag: 'ford_rescued' } } },
      { id: 'prisoner', character: 'felicia', x: 17, y: 6.2, dialogue: 'prisoner_felicia' },
    ],
    enemies: [
      { id: 'archive_agent', type: 'time_agent', x: 17, y: 14.5 },
      { id: 'archive_cyclock', type: 'cyclock', x: 29, y: 19 },
    ],
    interactables: [
      { id: 'cell_ford', kind: 'door', x: 7, y: 9.95, prop: 'temporal/cell_door', label: 'Cela', requires: { flag: 'never' }, requiresText: 'Uma cela trancada por um mecanismo de sequência. Os três terminais do salão controlam-na.' },
      { id: 'cell_felicia', kind: 'door', x: 17, y: 9.95, prop: 'temporal/cell_door', label: 'Cela', requires: { flag: 'archive_seq_solved' }, requiresText: 'Trancada pela mesma sequência.', effects: [{ record: 'rescued', value: 'felicia' }, { var: 'empathy', add: 1 }] },
      { id: 'storage_door', kind: 'door', x: 27, y: 9.95, prop: 'temporal/barrier', label: 'Armazém', requires: { any: [{ character: 'mabel' }, { flag: 'archive_seq_solved' }] }, requiresText: 'Uma barreira com um teclado cor-de-rosa e brilhantes. Parece feita para alguém com... estilo. (A Mabel consegue.)' },
      { id: 'term_clock', kind: 'sequence', x: 8, y: 19.6, prop: 'temporal/terminal', group: 'archive_seq', value: 1, label: 'Terminal do relógio', solid: true, onSolve: [{ setObject: 'cell_ford', state: 'open' }, { setObject: 'cell_felicia', state: 'open' }, { journal: 'j_archive_seq' }] },
      { id: 'term_hourglass', kind: 'sequence', x: 17, y: 19.6, prop: 'temporal/terminal', group: 'archive_seq', value: 2, label: 'Terminal da ampulheta', solid: true },
      { id: 'term_gear', kind: 'sequence', x: 26, y: 19.6, prop: 'temporal/terminal', group: 'archive_seq', value: 3, label: 'Terminal da engrenagem', solid: true },
      { id: 'seq_clue', kind: 'examine', x: 12, y: 14.6, hidden: true, reveal: 'flashlight', text: 'Riscado na estante, quase apagado: "relógio → ampulheta → engrenagem".', effects: [{ give: 'archive_code' }, { journal: 'j_archive_code' }] },
      { id: 'seq_clue_plain', kind: 'examine', x: 20, y: 20.6, text: 'Os três terminais têm símbolos: relógio, ampulheta e engrenagem. Há uma ordem certa — se errares, reiniciam. Procura uma pista nas estantes (a lanterna ajuda) ou pergunta ao Blendin.' },
      { id: 'bottle', kind: 'pickup', x: 27, y: 5.6, item: 'time_bottle', prop: 'temporal/time_bottle', label: 'Apanhar o biberão temporal', effects: [{ journal: 'j_bottle' }] },
      { id: 'archive_pad', kind: 'save', x: 15.5, y: 21, prop: 'temporal/pad', label: 'Ponto de controlo' },
    ],
    onEnter: [{ questStart: 'b_q8' }],
  };
}
