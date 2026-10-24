/**
 * Day and night. The clock counts minutes of the day (0..1440). Darkness is 0
 * in full day and 1 in full night, with a dawn from 05:00 to 07:30 and a long
 * dusk from 18:00 to 21:00 (Gravity Falls belongs to dusk).
 */
export const DAY_MINUTES = 1440;

export type Phase = 'madrugada' | 'manha' | 'tarde' | 'entardecer' | 'noite';

export const PHASE_NAMES: Record<Phase, string> = {
  madrugada: 'Madrugada', manha: 'Manhã', tarde: 'Tarde', entardecer: 'Entardecer', noite: 'Noite',
};

const smooth = (t: number) => t * t * (3 - 2 * t);

export function normClock(m: number): number {
  return ((m % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

export function darknessAt(m: number): number {
  const h = normClock(m) / 60;
  if (h < 5) return 1;
  if (h < 7.5) return 1 - smooth((h - 5) / 2.5);
  if (h < 18) return 0;
  if (h < 21) return smooth((h - 18) / 3);
  return 1;
}

export function phaseAt(m: number): Phase {
  const h = normClock(m) / 60;
  if (h < 5) return 'noite';
  if (h < 7.5) return 'madrugada';
  if (h < 12.5) return 'manha';
  if (h < 18) return 'tarde';
  if (h < 21) return 'entardecer';
  return 'noite';
}

/** Warm light at the edges of the day: 0 at noon and midnight, 1 at the heart of dawn and dusk. */
export function twilightAt(m: number): number {
  const d = darknessAt(m);
  return Math.max(0, 1 - Math.abs(d - 0.45) / 0.45) * (phaseAt(m) === 'noite' ? 0 : 1);
}

export function clockLabel(m: number): string {
  const n = Math.floor(normClock(m));
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}
