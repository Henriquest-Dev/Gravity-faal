import { describe, expect, it } from 'vitest';
import { clockLabel, darknessAt, normClock, phaseAt, twilightAt } from '../src/core/daytime';
import { validateState } from '../src/core/save';
import { createState } from '../src/core/state';

describe('day and night', () => {
  it('is light at noon and dark at midnight, with soft edges', () => {
    expect(darknessAt(12 * 60)).toBe(0);
    expect(darknessAt(0)).toBe(1);
    const d = darknessAt(19.5 * 60);
    expect(d).toBeGreaterThan(0.2);
    expect(d).toBeLessThan(0.8);
    for (let m = 0; m < 1440; m += 5) expect(Math.abs(darknessAt(m + 5) - darknessAt(m))).toBeLessThan(0.1);
  });
  it('names the phases and wraps the clock', () => {
    expect(phaseAt(6 * 60)).toBe('madrugada');
    expect(phaseAt(10 * 60)).toBe('manha');
    expect(phaseAt(15 * 60)).toBe('tarde');
    expect(phaseAt(19 * 60)).toBe('entardecer');
    expect(phaseAt(23 * 60)).toBe('noite');
    expect(normClock(1440 + 30)).toBe(30);
    expect(clockLabel(19 * 60 + 5)).toBe('19:05');
    expect(twilightAt(12 * 60)).toBe(0);
    expect(twilightAt(19.2 * 60)).toBeGreaterThan(0.5);
  });
  it('starts each arc at its hour and fills the clock on old saves', () => {
    expect(createState(1).clock).toBe(600);
    expect(createState(2).clock).toBe(1140);
    const old = createState(2) as unknown as Record<string, unknown>;
    delete old.clock;
    old.version = 3;
    expect(validateState(old).clock).toBe(1140);
  });
});
