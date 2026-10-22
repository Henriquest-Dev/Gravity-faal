import type { Dir } from './types';

export type ActorStateName =
  | 'idle' | 'walk' | 'run' | 'interact' | 'ability' | 'hurt' | 'dodge' | 'jump'
  | 'climb' | 'swim' | 'dialogue' | 'transition' | 'downed';

/**
 * Priority of each state. A request is accepted when the target priority is
 * >= the current one, or when the current state is interruptible and finished.
 * Locomotion states (idle/walk/run/swim/climb) are always freely interchangeable.
 */
export const STATE_PRIORITY: Record<ActorStateName, number> = {
  idle: 0, walk: 0, run: 0, swim: 0, climb: 0,
  interact: 1, ability: 2, jump: 2, dodge: 3, hurt: 4,
  dialogue: 5, transition: 6, downed: 7,
};

const LOCOMOTION = new Set<ActorStateName>(['idle', 'walk', 'run', 'swim', 'climb']);

/** Explicitly incompatible combinations regardless of priority. */
const FORBIDDEN: Partial<Record<ActorStateName, ActorStateName[]>> = {
  swim: ['jump', 'ability', 'dodge', 'run'],
  climb: ['jump', 'ability', 'dodge', 'run', 'interact'],
  jump: ['interact', 'climb', 'swim'],
  dialogue: ['ability', 'jump', 'dodge', 'run', 'walk', 'interact'],
  transition: ['ability', 'jump', 'dodge', 'run', 'walk', 'interact', 'hurt', 'dialogue'],
  downed: ['ability', 'jump', 'dodge', 'run', 'walk', 'interact', 'hurt', 'swim', 'climb', 'dialogue'],
};

export function isLocomotion(s: ActorStateName): boolean {
  return LOCOMOTION.has(s);
}

export function canEnter(current: ActorStateName, next: ActorStateName, currentFinished: boolean): boolean {
  if (current === next) return true;
  if (FORBIDDEN[current]?.includes(next)) return false;
  if (current === 'downed') return false;
  if (isLocomotion(current)) return true;
  if (currentFinished) return true;
  return STATE_PRIORITY[next] > STATE_PRIORITY[current];
}

/**
 * Stable 4-direction facing for 8-way input: keeps the current facing while it
 * is still one of the pressed components, otherwise picks the dominant axis
 * (horizontal wins exact ties). Prevents flicker between rows on diagonals.
 */
export function facingFor(dx: number, dy: number, current: Dir): Dir {
  if (dx === 0 && dy === 0) return current;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const h: Dir = dx < 0 ? 'west' : 'east';
  const v: Dir = dy < 0 ? 'north' : 'south';
  const diagonal = ax > 0.3 * Math.max(ax, ay) && ay > 0.3 * Math.max(ax, ay);
  if (diagonal && (current === h || current === v)) return current;
  if (ax >= ay) return dx === 0 ? v : h;
  return v;
}

export function dirVector(d: Dir): { x: number; y: number } {
  switch (d) {
    case 'south': return { x: 0, y: 1 };
    case 'north': return { x: 0, y: -1 };
    case 'west': return { x: -1, y: 0 };
    case 'east': return { x: 1, y: 0 };
  }
}

/** Normalises an input vector so diagonals are not faster; preserves analog magnitude up to 1. */
export function normalizeInput(x: number, y: number): { x: number; y: number; mag: number } {
  const m = Math.hypot(x, y);
  if (m < 1e-6) return { x: 0, y: 0, mag: 0 };
  const mag = Math.min(1, m);
  return { x: (x / m) * mag, y: (y / m) * mag, mag };
}

/** Animation playback rate tied to ground speed so feet do not slide. */
export function animRate(speed: number, nominalSpeed: number): number {
  if (nominalSpeed <= 0) return 1;
  return Math.max(0.35, Math.min(1.6, speed / nominalSpeed));
}
