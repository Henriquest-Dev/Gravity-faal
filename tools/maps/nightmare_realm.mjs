import { Canvas } from './lib.mjs';

/**
 * Floating platforms over the void. Gaps of one tile can be jumped (run for
 * margin); wider gaps need a rift pair or the narrow rune walkway.
 */
export default function build() {
  const W = 44, H = 34;
  const c = new Canvas(W, H, 'v');
  const plat = (x, y, w, h, code = 'n') => c.rect(x, y, w, h, code);
  plat(18, 27, 8, 5); // P1 arrival
  plat(17, 19, 10, 7); // P2 (one-tile gap at row 26)
  c.rect(19, 23, 6, 1, 'r');
  plat(3, 15, 8, 9); // P3 west (rift)
  plat(31, 14, 9, 9); // P4 east (walkway)
  c.rect(27, 21, 4, 1, 'r'); // narrow rune walkway P2 -> P4
  plat(20, 11, 4, 8); // P5 corridor north
  c.rect(21, 10, 2, 9, 'r'); // row 10: the only link to the heart, closed by the rune door
  plat(13, 2, 18, 7); // P6 heart platform (rows 2-8): two void rows beside the door, no jump around it
  c.rect(21, 9, 2, 1, 'r');
  c.ellipse(22, 5, 4, 2.6, 'r');
  // pillars of nightmare stone give cover
  c.rect(15, 4, 1, 1, '#');
  c.rect(28, 4, 1, 1, '#');
  return {
    id: 'nightmare_realm', name: 'Reino dos Pesadelos', arc: 1, theme: 'nightmare', music: 'nightmare', reference: 'nightmare_realm',
    width: W, height: H, terrain: c.rows(),
    ambient: { tint: '#0b0618', strange: true, darkness: 0.3 },
    props: [
      { prop: 'rifts/floating_rock', x: 8, y: 6, layer: 'ground' },
      { prop: 'rifts/floating_rock', x: 37, y: 7, layer: 'ground', flip: true },
      { prop: 'rifts/floating_rock', x: 4, y: 30, layer: 'ground' },
      { prop: 'rifts/eye_sigil', x: 22, y: 3.2, solid: false },
      { prop: 'rifts/pillar', x: 17.5, y: 9.6 }, { prop: 'rifts/pillar', x: 26.5, y: 9.6 },
      { prop: 'rifts/rune_obelisk', x: 4.5, y: 16.4 }, { prop: 'rifts/rune_obelisk', x: 38.5, y: 15.4 },
      { prop: 'rifts/pink_crystal', x: 33, y: 21.6 }, { prop: 'rifts/blue_crystal', x: 9.5, y: 22.6 },
      { prop: 'rifts/chains', x: 25.5, y: 31.6, solid: false },
      { prop: 'rifts/spiral_stone', x: 37.5, y: 21.4 },
    ],
    spawns: { default: { x: 22, y: 30, dir: 'north' } },
    exits: [],
    enemies: [
      { id: 'nm_teeth_1', type: 'teeth', x: 19.5, y: 21 },
      { id: 'nm_teeth_2', type: 'teeth', x: 24.5, y: 20.5 },
      { id: 'nm_hectorgon', type: 'hectorgon', x: 7, y: 18.5 },
      { id: 'nm_pyronica', type: 'pyronica', x: 35.5, y: 17.5, dialogue: 'pyronica' },
      { id: 'nm_keyhole', type: 'keyhole', x: 22, y: 15.5 },
      { id: 'nm_bola8', type: 'bola8', x: 22, y: 7.6, dialogue: 'bola8' },
    ],
    interactables: [
      { id: 'nm_lantern', kind: 'save', x: 25.2, y: 29.4, prop: 'rifts/lantern', label: 'Descansar e gravar' },
      { id: 'gap_hint', kind: 'examine', x: 20.2, y: 27.4, text: 'O vazio entre as plataformas tem uma casa de largura. Corre (Shift) e salta (Espaço) para atravessar. Se caíres, voltas à última posição segura.' },
      { id: 'nm_rift_a', kind: 'rift', x: 17.6, y: 24.6, pair: 'nm_rift_b', requires: { ability: 'rift' }, label: 'Abrir fenda' },
      { id: 'nm_rift_b', kind: 'rift', x: 9.5, y: 20.4, pair: 'nm_rift_a', requires: { ability: 'rift' }, label: 'Abrir fenda' },
      { id: 'void_key_pickup', kind: 'pickup', x: 5.5, y: 16.4, item: 'void_key', prop: 'rifts/chains', label: 'Apanhar a chave do vazio' },
      { id: 'nm_shard', kind: 'pickup', x: 38.5, y: 19.4, item: 'geometry_shard', prop: 'rifts/pink_crystal' },
      { id: 'void_door', kind: 'door', x: 22, y: 10.95, prop: 'rifts/rune_door', label: 'Destrancar a porta rúnica', requires: { item: 'void_key' }, requiresText: 'Uma porta rúnica com uma fechadura que respira. Precisa da chave do vazio (procura a oeste, através de uma fenda, ou negocia com quem a guarde).' },
      { id: 'heart', kind: 'npcProxy', x: 22, y: 5.2, text: 'heart', label: 'Tocar no coração da fenda' },
    ],
    triggers: [
      { id: 'realm_intro', x: 18, y: 27, w: 8, h: 5, once: true, effects: [{ toast: 'Reino dos Pesadelos: o chão é escasso. Cada salto conta.' }, { journal: 'j_realm' }] },
      { id: 'heart_approach', x: 18, y: 4, w: 9, h: 4, once: true, if: { any: [{ defeated: 'nm_bola8' }, { flag: 'bola8_calm' }] }, effects: [{ cutscene: 'a1_heart' }] },
      { id: 'heart_near', x: 13, y: 2, w: 18, h: 8, once: true, if: { not: { flag: 'bola8_calm' } }, effects: [{ toast: 'Bola 8 guarda o coração da fenda.' }] },
    ],
    onEnter: [{ questStart: 'a1_q5' }, { cutscene: 'a1_nightmare' }],
  };
}
