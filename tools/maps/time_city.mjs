import { Canvas } from './lib.mjs';

/**
 * City of the time domain. A time lever switches the district between
 * present and past: the past has the bridge to the archive, the present
 * has the walkway to the arena. Both states are map variants.
 */
export default function build() {
  const W = 46, H = 32;
  const c = new Canvas(W, H, 'v');
  c.rect(18, 25, 10, 5, 'T'); // arrival platform
  c.rect(21, 17, 4, 8, 't'); // avenue
  c.rect(12, 9, 22, 8, 'T'); // central plaza
  c.ellipse(23, 13, 5, 2.6, 'g');
  c.rect(5, 11, 7, 4, 't'); // west terrace with the lever
  c.rect(4, 8, 6, 3, 'T');
  c.rect(20, 1, 6, 5, 'T'); // archive gate (north)
  c.rect(37, 10, 7, 7, 'T'); // arena gate (east)
  c.rect(28, 19, 6, 5, 't'); // agents' checkpoint
  c.rect(25, 20, 3, 2, 't');
  const presentWalk = { x: 34, y: 12, rows: ['ttt', 'ttt'] };
  const pastBridge = { x: 22, y: 6, rows: ['tt', 'tt', 'tt'] };
  return {
    id: 'time_city', name: 'Cidade do domínio temporal', arc: 2, theme: 'temporal', music: 'temporal', reference: 'time_city',
    width: W, height: H, terrain: c.rows(),
    variants: [
      { when: { not: { flag: 'time_past' } }, patches: [presentWalk] },
      { when: { flag: 'time_past' }, patches: [pastBridge] },
    ],
    ambient: { tint: '#061416', strange: true, darkness: 0.2 },
    props: [
      { prop: 'temporal/clock_tower', x: 23, y: 12.4 },
      { prop: 'temporal/lamp', x: 13.5, y: 10.4 }, { prop: 'temporal/lamp', x: 32.5, y: 10.4 },
      { prop: 'temporal/lamp', x: 13.5, y: 16.4 }, { prop: 'temporal/lamp', x: 32.5, y: 16.4 },
      { prop: 'temporal/checkpoint_booth', x: 31, y: 21.6 },
      { prop: 'temporal/hourglass_frame', x: 6.5, y: 9.6 },
      { prop: 'temporal/gear', x: 41, y: 12.4 },
      { prop: 'temporal/wheel', x: 17, y: 3, layer: 'ground' },
      { prop: 'temporal/railing', x: 19.5, y: 29.6 }, { prop: 'temporal/railing', x: 26.5, y: 29.6 },
      { prop: 'temporal/hover_platform', x: 7, y: 26, layer: 'ground' },
      { prop: 'temporal/hover_platform', x: 40, y: 27, layer: 'ground' },
    ],
    spawns: {
      default: { x: 23, y: 27.4, dir: 'north' },
      archive: { x: 23, y: 4.6, dir: 'south' },
      arena: { x: 40, y: 13.6, dir: 'west' },
      lever: { x: 8, y: 13.4, dir: 'east' },
    },
    exits: [
      { id: 'to_archive', x: 21, y: 1, w: 4, h: 1, to: 'time_archive', spawn: 'default', requires: { flag: 'archive_pass' }, lockedText: 'Portão do Arquivo: "acesso só com passe de agente". O Blendin pode arranjar um.' },
      { id: 'to_arena', x: 43, y: 12, w: 1, h: 3, to: 'time_baby_arena', spawn: 'default', requires: { flag: 'ford_rescued' }, lockedText: 'A Arena do Bebé do Tempo. Entrar sem plano é loucura — o Ford, preso no Arquivo, conhece o ponto fraco.' },
    ],
    npcs: [
      { id: 'blendin_city', character: 'blendin', x: 26.5, y: 21.4, dialogue: 'blendin_city' },
    ],
    enemies: [
      { id: 'agent_lolph', type: 'time_agent', x: 16, y: 14 },
      { id: 'agent_dundgren', type: 'time_agent', x: 30, y: 12 },
      { id: 'city_cyclock', type: 'cyclock', x: 23, y: 3 },
    ],
    interactables: [
      { id: 'time_lever', kind: 'switch', x: 8.5, y: 12.4, label: 'Alavanca do tempo', effects: [{ setFlag: 'time_past' }, { toast: 'O bairro recua para o passado…' }, { teleport: { map: 'time_city', spawn: 'lever' } }], offEffects: [{ setFlag: 'time_past', value: false }, { toast: 'O bairro regressa ao presente…' }, { teleport: { map: 'time_city', spawn: 'lever' } }] },
      { id: 'lever_note', kind: 'examine', x: 6.5, y: 10.6, text: 'Placa: "Alavanca de manutenção cronológica. Passado: a ponte do Arquivo existia. Presente: o passadiço da Arena." Mudar o tempo muda o caminho.' },
      { id: 'return_gate', kind: 'portal', x: 23, y: 29.2, prop: 'temporal/time_gate', label: 'Voltar a Gravity Falls', effects: [{ teleport: { map: 'town_invaded', spawn: 'portal' } }] },
      { id: 'city_pad', kind: 'save', x: 19.5, y: 26.4, prop: 'temporal/pad', label: 'Ponto de controlo' },
      { id: 'city_bottle_hint', kind: 'examine', x: 34, y: 23.4, prop: 'temporal/terminal', solid: true, text: 'Terminal dos agentes: "Sujeito: Bebé do Tempo. Acalma-se com biberões de areia temporal (armazém do Arquivo). NÃO ACORDAR."', effects: [{ journal: 'j_bottle_hint' }] },
    ],
    triggers: [
      { id: 'city_intro', x: 18, y: 25, w: 10, h: 5, once: true, effects: [{ toast: 'Os agentes do tempo não ferem: a estase devolve-te ao último ponto de controlo — mas aumenta a dívida temporal.' }, { journal: 'j_time_city' }] },
    ],
    onEnter: [{ questStart: 'b_q7' }],
  };
}
