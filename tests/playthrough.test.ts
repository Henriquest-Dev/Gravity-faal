import { describe, expect, it } from 'vitest';
import { applyEffects, evaluateEnding } from '../src/core/rules';
import { createState } from '../src/core/state';
import { RULES } from '../src/game/data';
import { Sim } from './helpers';

/** Arc 1 from the first step to the heart. `style` steers the choices. */
function arc1(style: 'kind' | 'ambitious' | 'loner', final: 'seal' | 'leave' | 'absorb'): Sim {
  const g = new Sim(createState(1));
  g.enter('euclydia_plaza');
  expect(g.quest('a1_q1')).toBe('active');
  g.talk('professor', style === 'loner' ? 'Não vejo' : 'Vejo coisas');
  g.use('fountain_core');
  expect(g.s.abilities).toContain('perceive');
  g.use('anomaly_1').use('anomaly_2').use('anomaly_3');
  g.talk('merchant', style === 'kind' ? 'Fui eu' : style === 'ambitious' ? '(o olho brilha)' : 'Foi o vento');
  expect(g.quest('a1_q1')).toBe('done');
  expect(g.s.abilities).toContain('geometry');

  g.enter('bill_house');
  g.use('drawings').use('family_portrait').use('bill_drawer');
  g.talk('tri_house', style === 'kind' ? 'Vou. Prometo' : 'Não sei');
  g.enter('euclydia_plaza');
  g.talk('elder', style === 'kind' ? 'Uma porta' : 'Nada');
  expect(g.quest('a1_q2')).toBe('done');
  g.use('north_gate');

  g.enter('observatory');
  g.use('terrace_gate').use('lens').solve('obs_rings');
  g.use('telescope');
  expect(g.s.abilities).toContain('rift');
  g.talk('telescope_vision', style === 'kind' ? 'Corro' : 'Guardo');
  expect(g.quest('a1_q3')).toBe('done');
  expect(g.s.flags.rupture_started).toBe(true);

  g.enter('euclydia_rupture');
  g.talk('elder_rupture', style === 'kind' ? 'Prometo' : style === 'ambitious' ? 'Vou ver' : 'Se eu for');
  g.use('shard_1').use('shard_2');
  if (style === 'kind') {
    g.use('broken_fountain');
    g.talk('rescue_professor', 'Venha');
    g.talk('rescue_merchant', 'Agarra-te');
    g.use('tri_glyph');
    expect(g.s.objects['euclydia_rupture/tri_rubble']).toBe('open');
    g.talk('rescue_tri', 'Vamos');
    expect(g.quest('a1_s1')).toBe('done');
  } else if (style === 'loner') {
    g.talk('rescue_professor', 'Venha');
  } else {
    g.use('shard_3');
  }
  g.use('heart_portal');
  expect(g.s.mapId).toBe('nightmare_realm');
  expect(g.quest('a1_q4')).toBe('done');

  if (style === 'ambitious') {
    g.s.vars.trust = Math.max(g.s.vars.trust, 3); // earned trust lets Pyronica deal
    g.talk('pyronica', 'Aceito');
    expect(g.s.inventory.void_key).toBe(1);
  } else {
    g.use('void_key_pickup');
  }
  g.use('void_door');
  if (g.s.vars.empathy >= 3) g.talk('bola8', 'Essas correntes');
  else g.defeat('nm_bola8');
  g.talk('heart', { seal: 'Selo', leave: 'Viro', absorb: 'Absorvo' }[final]);
  expect(g.quest('a1_q5')).toBe('done');
  return g;
}

describe('arc 1 playthroughs', () => {
  it('kind trajectory ends in repair (and a contrary final choice cannot erase it)', () => {
    expect(arc1('kind', 'seal').s.arc1Ending).toBe('repair');
    expect(arc1('kind', 'absorb').s.arc1Ending).toBe('repair');
  });

  it('ambitious trajectory ends in ascension even if the final choice is to seal', () => {
    expect(arc1('ambitious', 'absorb').s.arc1Ending).toBe('ascension');
    expect(arc1('ambitious', 'seal').s.arc1Ending).toBe('ascension');
  });

  it('a lonely, ambiguous trajectory ends in exile; the final choice tips balanced paths', () => {
    expect(arc1('loner', 'leave').s.arc1Ending).toBe('exile');
  });

  it('broken promises are recorded as concrete events', () => {
    const g = new Sim(createState(1));
    g.s.flags.promise_tri = true;
    g.s.defeated.push('nm_bola8');
    g.talk('heart', 'Viro');
    expect(g.s.events.promisesBroken).toContain('tri');
  });
});

function arc2(from: ReturnType<typeof arc1>, style: 'kind' | 'pragmatic' | 'greedy', gate: 'restore' | 'sacrifice' | 'dominate'): Sim {
  const g = from;
  applyEffects(g.s, [{ startArc2: true }], RULES);
  expect(g.s.arc).toBe(2);
  expect(g.s.party).toEqual(['dipper', 'mabel']);
  g.enter('shack_exterior');
  g.enter('shack_interior');
  g.talk('stan', style === 'kind' ? 'Podemos' : 'Que luzes');
  g.as('dipper').use('desk_drawer');
  g.as('mabel').use('mabel_box');
  g.as('dipper');
  expect(g.s.abilities).toEqual(expect.arrayContaining(['flashlight', 'grapple', 'journal_scan'].slice(0, 2)));
  g.enter('town_center');
  expect(g.quest('b_q1')).toBe('done');
  g.use('notice_board');
  g.as('mabel').talk('pacifica', style === 'greedy' ? 'Sei que' : 'Diz-me');
  g.talk('felicia');
  expect(g.quest('b_q2')).toBe('done');

  g.enter('forest_lake_cave');
  g.as('dipper').use('hollow_tree');
  expect(g.s.abilities).toContain('journal_scan');
  g.use('power_cell').use('cave_sym_1').use('cave_sym_2').use('cave_sym_3').use('cave_door').use('bunker_card');
  expect(g.quest('b_q3')).toBe('done');

  g.enter('mcgucket_workshop');
  g.talk('mcgucket', style === 'greedy' ? 'E o que' : 'Contamos');
  g.solve('yard_plates');
  g.use('yard_gate').use('gear');
  g.enter('town_center').use('hardware_crate');
  g.enter('mcgucket_workshop').use('mcg_machine');
  expect(g.s.inventory.stabilizer).toBe(1);
  expect(g.quest('b_q4')).toBe('done');

  g.enter('shack_interior').use('vending');
  g.enter('portal_bunker').solve('bunker_circuit');
  g.use('blast_door');
  if (g.s.flags.bill_ally) g.talk('bill_ally', style === 'kind' ? 'Então ajuda' : 'Porque');
  else if (g.s.flags.bill_ambiguous) g.talk('bill_deal', style === 'kind' ? 'Não fazemos' : 'Aceitamos');
  else g.talk('bill_threat', 'Não vais');
  g.use('portal_console');
  expect(g.s.mapId).toBe('town_invaded');
  expect(g.quest('b_q5')).toBe('done');

  g.as('dipper').use('soos_weak').use('soos_slab');
  g.talk('rescue_soos', 'Vamos');
  if (style !== 'greedy') {
    g.as('mabel').talk('rescue_pacifica', 'Claro');
    g.defeat('inv_teeth_1').defeat('inv_teeth_2').talk('rescue_wendy');
  }
  g.talk('blendin', style === 'greedy' ? 'Dá-nos' : 'Como');
  g.use('time_gate');
  expect(g.quest('b_q6')).toBe('done');

  expect(g.s.mapId).toBe('time_city');
  g.talk('blendin_city', ...(g.s.flags.blendin_helped ? [] : [style === 'kind' ? 'Desculpa' : 'Aceitamos']));
  expect(g.s.flags.archive_pass).toBe(true);
  g.use('time_lever');
  g.enter('time_archive');
  g.as('dipper').use('seq_clue');
  g.solve('archive_seq');
  g.talk('rescue_ford', 'Vamos');
  g.as('mabel').use('storage_door').use('bottle');
  expect(g.quest('b_q8')).toBe('done');

  g.enter('time_baby_arena');
  if (style === 'kind') g.as('mabel').talk('baby_intro', 'Trouxemos', 'Shhh');
  else if (style === 'greedy') g.talk('baby_intro', 'Um acordo');
  else { g.talk('baby_intro', 'Então lutamos'); g.defeat('time_baby'); }
  expect(g.quest('b_q9')).toBe('done');

  g.enter('timeline_crossing');
  g.talk({ restore: 'gate_restore', sacrifice: 'gate_sacrifice', dominate: 'gate_dominate' }[gate], 0);
  return g;
}

describe('arc 2 playthroughs and cross-arc consequences', () => {
  it('arc 1 result changes concrete world state for arc 2', () => {
    const repair = arc1('kind', 'seal');
    applyEffects(repair.s, [{ startArc2: true }], RULES);
    expect(repair.s.flags.bill_ally).toBe(true);
    const asc = arc1('ambitious', 'absorb');
    const realityBefore = asc.s.vars.reality;
    applyEffects(asc.s, [{ startArc2: true }], RULES);
    expect(asc.s.flags.bill_threat).toBe(true);
    expect(asc.s.vars.reality).toBe(realityBefore - 3);
    expect(asc.s.vars.timeDebt).toBeGreaterThanOrEqual(2);
    // personal traits were Bill's; the twins start neutral
    expect(asc.s.vars.ambition).toBe(0);
  });

  it('kind twins after a repaired Euclydia reach balance', () => {
    const g = arc2(arc1('kind', 'seal'), 'kind', 'restore');
    expect(g.s.arc2Ending).toBe('balance');
    expect(g.quest('b_q10')).toBe('done');
  });

  it('a pragmatic path with a forced fight and sacrifice ends in costly victory', () => {
    const g = arc2(arc1('loner', 'leave'), 'pragmatic', 'sacrifice');
    expect(g.s.arc2Ending).toBe('costly');
  });

  it('greedy twins after an ascended Bill end in rupture', () => {
    const g = arc2(arc1('ambitious', 'absorb'), 'greedy', 'dominate');
    expect(g.s.arc2Ending).toBe('rupture');
  });

  it('the same final gate gives different endings depending on the trajectory', () => {
    const a = arc2(arc1('kind', 'seal'), 'kind', 'sacrifice');
    const b = arc2(arc1('ambitious', 'absorb'), 'greedy', 'sacrifice');
    expect(a.s.arc2Ending).not.toBe(b.s.arc2Ending);
  });

  it('ending evaluation is deterministic', () => {
    const g = arc2(arc1('loner', 'leave'), 'pragmatic', 'restore');
    const r1 = evaluateEnding(RULES.endings.arc2, g.s);
    const r2 = evaluateEnding(RULES.endings.arc2, JSON.parse(JSON.stringify(g.s)));
    expect(r1).toEqual(r2);
  });
});
