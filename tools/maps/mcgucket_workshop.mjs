import { Canvas, decorate, forest } from './lib.mjs';

export default function build() {
  const W = 36, H = 26;
  const c = new Canvas(W, H, ';');
  c.frame(0, 0, W, H, 'x', 2);
  c.rect(0, 11, 3, 4, ':'); // road from town
  c.path([[2, 12.5], [22, 12.5]], 3, ':', [';']);
  // workshop: walls with a front door
  c.rect(12, 1, 21, 9, '#');
  c.rect(13, 4, 19, 4, 't');
  c.rect(21, 8, 2, 2, 't');
  // back yard walled by scrap, single gate gap
  c.rect(26, 14, 8, 1, 'R');
  c.rect(26, 15, 1, 8, 'R');
  c.rect(26, 23, 8, 1, 'R');
  c.rect(27, 15, 7, 8, ':');
  c.set(26, 18, ':');
  return {
    id: 'mcgucket_workshop', name: 'Oficina e sucata de McGucket', arc: 2, theme: 'workshop', music: 'workshop', reference: 'mcgucket_workshop',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#e8d7b0' },
    props: [
      ...forest(c, 'x', ['nature/pine', 'nature/dead_tree'], 71, { step: 2, gap: 0.25, skip: (x, y) => y >= 10 && y <= 15 && x < 3 }),
      ...decorate(c, ';', ['interiors/toolbox', 'interiors/barrel'], 5, 72, [3, 16, 20, 7]),
      { prop: 'interiors/scrap_pile', x: 5, y: 17.6 }, { prop: 'interiors/scrap_pile', x: 16, y: 23 },
      { prop: 'interiors/wrecked_car', x: 11, y: 17.4 }, { prop: 'interiors/wrecked_car', x: 22, y: 21.6, flip: true },
      { prop: 'interiors/gear', x: 30.5, y: 22.6 },
      { prop: 'interiors/lab_table', x: 15.5, y: 5.2 }, { prop: 'interiors/generator', x: 29, y: 5.2 },
      { prop: 'interiors/barrel', x: 13.4, y: 7.4 }, { prop: 'interiors/crate', x: 31.2, y: 7.4 },
      { prop: 'nature/signpost', x: 4.5, y: 10.6 },
    ],
    spawns: { default: { x: 2.5, y: 13, dir: 'east' }, west: { x: 2.5, y: 13, dir: 'east' } },
    exits: [
      { id: 'to_town', x: 0, y: 11, w: 1, h: 4, to: 'town_center', spawn: 'east', if: { not: { flag: 'town_invaded' } } },
      { id: 'to_town_invaded', x: 0, y: 11, w: 1, h: 4, to: 'town_invaded', spawn: 'east', if: { flag: 'town_invaded' } },
    ],
    npcs: [
      { id: 'mcgucket', character: 'mcgucket', x: 22.5, y: 6.4, dialogue: 'mcgucket', wander: 2 },
    ],
    interactables: [
      { id: 'plate_a', kind: 'plate', x: 4.5, y: 21.9, group: 'yard_plates', onSolve: [{ setObject: 'yard_gate', state: 'open' }, { journal: 'j_yard_gate' }] },
      { id: 'plate_b', kind: 'plate', x: 20.5, y: 17.9, group: 'yard_plates' },
      { id: 'plates_hint', kind: 'examine', x: 13.5, y: 15.6, prop: 'nature/signpost', text: 'Placa do McGucket: "PORTÃO DA SUCATA: duas placas, dois pesos ao mesmo tempo! Um de cada lado do pátio." (Põe um dos gémeos numa placa e alterna com Q — quem fica numa placa mantém-na premida.)' },
      { id: 'yard_gate', kind: 'door', x: 26.5, y: 18.9, prop: 'nature/gate', label: 'Portão da sucata', requires: { flag: 'yard_plates_solved' }, requiresText: 'O portão está trancado por um mecanismo de duas placas de pressão.' },
      { id: 'gear', kind: 'pickup', x: 31.5, y: 18.4, item: 'gear_part', prop: 'interiors/gear', label: 'Apanhar a engrenagem' },
      { id: 'mcg_machine', kind: 'repair', x: 25.5, y: 5.4, prop: 'interiors/control_console', solid: true, label: 'Montar o estabilizador', requires: { all: [{ item: 'gear_part' }, { item: 'power_cell' }, { item: 'wire_coil' }] }, requiresText: 'A máquina precisa de três peças: engrenagem (sucata), célula de energia (lago) e bobine de fio (ferragens na cidade).', effects: [{ take: 'gear_part' }, { take: 'power_cell' }, { take: 'wire_coil' }, { give: 'stabilizer' }, { setFlag: 'machine_fixed' }, { var: 'trust', add: 1 }, { journal: 'j_stabilizer' }] },
      { id: 'sw_1', kind: 'switch', x: 17.5, y: 4.6, group: 'mcg_circuit', value: 3, label: 'Alavanca A', onSolve: [{ give: 'medkit' }, { give: 'energy_snack' }, { record: 'repaired', value: 'circuito da oficina' }, { setFlag: 'mcg_circuit_done' }] },
      { id: 'sw_2', kind: 'switch', x: 19.5, y: 4.6, group: 'mcg_circuit', value: 6, label: 'Alavanca B' },
      { id: 'sw_3', kind: 'switch', x: 21.5, y: 4.6, group: 'mcg_circuit', value: 4, label: 'Alavanca C' },
      { id: 'sw_reset', kind: 'switch', x: 15, y: 7.4, group: 'mcg_circuit', value: -1, label: 'Repor alavancas' },
      { id: 'circuit_note', kind: 'examine', x: 19.5, y: 7.6, text: 'Rabisco do McGucket: "três lâmpadas, três alavancas; cada alavanca troca DUAS lâmpadas... ou só uma! Acende as três." Cada alavanca inverte as lâmpadas que comanda.', effects: [{ questStart: 'b_s2' }] },
      { id: 'cot', kind: 'save', x: 30, y: 7.6, prop: 'interiors/sofa', label: 'Descansar e gravar' },
    ],
    onEnter: [{ questStart: 'b_q4' }],
  };
}
