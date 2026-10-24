import { describe, expect, it } from 'vitest';
import { applyEffects, CIPHER_LETTERS } from '../src/core/rules';
import { createState } from '../src/core/state';
import { MAPS, RULES } from '../src/game/data';

describe("Bill's cipher", () => {
  const stones = Object.values(MAPS).flatMap((m) => (m.interactables ?? []).filter((i) => i.runes).map((i) => ({ map: m.id, ...i })));

  it('the key stones together teach all 26 letters', () => {
    const taught = new Set(stones.flatMap((s) => [...(s.teaches ?? '')]));
    for (const l of CIPHER_LETTERS) expect(taught.has(l), l).toBe(true);
  });

  it('inscriptions use only letters and spaces', () => {
    for (const s of stones) expect(s.runes, s.id).toMatch(/^[A-Z ]+$/);
  });

  it('learning every letter completes the cipher once and writes the journal', () => {
    const s = createState(1);
    let sigs = applyEffects(s, [{ learnRunes: 'ABCDEFGHIJKLM' }], RULES);
    expect(sigs.some((x) => x.type === 'runes' && !x.complete)).toBe(true);
    sigs = applyEffects(s, [{ learnRunes: 'NOPQRSTUVWXYZ' }], RULES);
    expect(sigs.some((x) => x.type === 'runes' && x.complete)).toBe(true);
    expect(s.flags.cipher_complete).toBe(true);
    expect(s.journal.some((j) => j.id === 'j_cipher')).toBe(true);
    expect(applyEffects(s, [{ learnRunes: 'ABC' }], RULES).some((x) => x.type === 'runes')).toBe(false);
  });
});
