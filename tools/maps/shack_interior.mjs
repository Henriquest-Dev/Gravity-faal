import { Canvas } from './lib.mjs';

export default function build() {
  const W = 26, H = 16;
  const c = new Canvas(W, H, '#');
  c.rect(1, 3, 14, 10, 'f'); // gift shop
  c.rect(16, 3, 9, 10, 'f'); // living room
  c.rect(15, 7, 1, 2, 'f'); // doorway between rooms
  c.rect(7, 13, 2, 3, 'f'); // front door corridor
  c.rect(17, 9, 6, 3, 'q'); // kitchen tiles
  return {
    id: 'shack_interior', name: 'Interior da Cabana', arc: 2, theme: 'interior', music: 'interior', reference: 'shack_interior',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#1a120c' },
    props: [
      { prop: 'interiors/rug', x: 8, y: 10.6, layer: 'ground' },
      { prop: 'interiors/cash_register', x: 4, y: 7.4 },
      { prop: 'interiors/desk', x: 4, y: 8.2 },
      { prop: 'interiors/bookshelf', x: 2.4, y: 4.4 }, { prop: 'interiors/bookshelf', x: 12.4, y: 4.4 },
      { prop: 'interiors/barrel', x: 13.6, y: 11.6 }, { prop: 'interiors/crate', x: 1.8, y: 12.2 },
      { prop: 'interiors/sofa', x: 20, y: 6.4 },
      { prop: 'interiors/armchair', x: 23.6, y: 6.2 },
      { prop: 'interiors/floor_lamp', x: 17.2, y: 4.6 },
      { prop: 'interiors/round_table', x: 20, y: 11.4 },
      { prop: 'interiors/chair', x: 18.4, y: 11.4 }, { prop: 'interiors/chair', x: 21.6, y: 11.4, flip: true },
      { prop: 'interiors/rug', x: 20, y: 8.6, layer: 'ground' },
    ],
    spawns: { default: { x: 8, y: 12.4, dir: 'north' }, door: { x: 8, y: 12.4, dir: 'north' }, vending: { x: 13, y: 6.4, dir: 'south' } },
    exits: [
      { id: 'front_door', x: 7, y: 15, w: 2, h: 1, to: 'shack_exterior', spawn: 'door', kind: 'door' },
      { id: 'vending_passage', x: 9.6, y: 3, w: 0.8, h: 0.7, to: 'portal_bunker', spawn: 'stairs', kind: 'stairs', if: { object: 'shack_interior/vending', state: 'open' } },
    ],
    npcs: [
      { id: 'stan', character: 'stan', x: 6.5, y: 9.2, dialogue: 'stan', if: { not: { flag: 'town_invaded' } } },
      { id: 'ford_home', character: 'ford', x: 22.5, y: 9.4, dialogue: 'ford_home', if: { flag: 'game_complete' } },
    ],
    interactables: [
      { id: 'display_case', kind: 'examine', x: 9.5, y: 5.4, prop: 'interiors/display_case', solid: true, text: 'Atracções "autênticas" do Stan: um ovo de gnomo, um olho de vidro, um "dente de sasquatch". Etiquetas escritas à pressa.' },
      { id: 'desk_drawer', kind: 'chest', x: 4, y: 9.4, item: 'flashlight', label: 'Abrir a gaveta', character: 'dipper', effects: [{ unlock: 'flashlight' }, { journal: 'j_flashlight' }] },
      { id: 'mabel_box', kind: 'chest', x: 23, y: 10.6, prop: 'interiors/toolbox', item: 'grappling_hook', label: 'Abrir a caixa da Mabel', character: 'mabel', effects: [{ unlock: 'grapple' }, { unlock: 'charm' }, { journal: 'j_hook' }] },
      { id: 'armchair_rest', kind: 'save', x: 23.6, y: 7.2, label: 'Descansar e gravar' },
      { id: 'vending', kind: 'door', x: 10, y: 3.6, prop: 'interiors/bookshelf', label: 'Examinar a estante', requires: { item: 'bunker_key' }, requiresText: 'Atrás dos livros há uma ranhura para cartão. Precisa de um cartão de acesso.', effects: [{ toast: 'A estante desliza: há escadas para baixo!' }, { journal: 'j_vending' }] },
      { id: 'odd_slot', kind: 'examine', x: 11.4, y: 4.4, hidden: true, reveal: 'flashlight', text: 'A lanterna mostra riscos no chão em arco: a estante ao lado roda sobre si própria. Há uma ranhura de cartão entre os livros.', effects: [{ setFlag: 'knows_secret_shelf' }, { journal: 'j_secret_shelf' }] },
      { id: 'tv', kind: 'examine', x: 20, y: 4.4, text: '"Patos Detective" está a dar. Stan adormeceu a vê-lo três vezes esta semana.' },
    ],
    onEnter: [{ questStart: 'b_q1' }],
  };
}
