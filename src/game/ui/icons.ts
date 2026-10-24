/**
 * Hand-drawn glyph set for the interface, in the spirit of the cipher wheel
 * and the journals' margins. Stroke icons on a 24x24 grid, coloured by
 * `currentColor`. No emoji anywhere in the game.
 */
const G: Record<string, string> = {
  // actions
  strike: '<path d="M5 19 L17 7"/><path d="M14 5 L19 5 L19 10"/><path d="M4 15 L9 20"/>',
  ability: '<path d="M12 3 L21 19 L3 19 Z"/><circle cx="12" cy="13" r="2.4"/>',
  eye: '<path d="M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12 Z"/><circle cx="12" cy="12" r="3"/>',
  hand: '<path d="M7 13 V6.5 a1.5 1.5 0 0 1 3 0 V11 V4.5 a1.5 1.5 0 0 1 3 0 V11 V5.5 a1.5 1.5 0 0 1 3 0 V12 V8.5 a1.5 1.5 0 0 1 3 0 V15 c0 4 -3 6 -6 6 h-1 c-3 0 -4 -1.5 -6 -4 L4 13.5 a1.5 1.5 0 0 1 2.2 -2 Z"/>',
  jump: '<path d="M5 14 L12 7 L19 14"/><path d="M8 19 h8"/>',
  dodge: '<path d="M4 16 C8 16 9 8 14 8 h6"/><path d="M17 5 L20 8 L17 11"/><path d="M4 20 h5"/>',
  swap: '<path d="M8 4 L3 12 h10 Z"/><path d="M16 20 L21 12 h-10 Z"/>',
  cycle: '<path d="M19 12 a7 7 0 1 1 -2.05 -4.95"/><path d="M19 3 v5 h-5"/>',
  run: '<path d="M4 6 L10 12 L4 18"/><path d="M12 6 L18 12 L12 18"/>',
  // menus
  journal: '<path d="M5 3 h12 a2 2 0 0 1 2 2 v16 H7 a2 2 0 0 1 -2 -2 Z"/><path d="M5 19 a2 2 0 0 1 2 -2 h12"/><path d="M11 8 l1.5 -2.5 l1.5 2.5 l-1.5 3 z"/>',
  bag: '<path d="M5 9 h14 l-1 11 H6 Z"/><path d="M9 9 V7 a3 3 0 0 1 6 0 v2"/>',
  map: '<path d="M3 6 l6 -2 l6 2 l6 -2 v14 l-6 2 l-6 -2 l-6 2 Z"/><path d="M9 4 v14"/><path d="M15 6 v14"/>',
  pause: '<path d="M8 5 v14"/><path d="M16 5 v14"/>',
  close: '<path d="M6 6 L18 18"/><path d="M18 6 L6 18"/>',
  // abilities
  perceive: '<path d="M12 2 L22 20 L2 20 Z"/><path d="M6 14 C9 10 15 10 18 14 C15 18 9 18 6 14 Z"/><circle cx="12" cy="14" r="1.6"/>',
  telekinesis: '<rect x="8" y="8" width="8" height="8"/><path d="M4 12 h2"/><path d="M18 12 h2"/><path d="M12 4 v2"/><path d="M12 18 v2"/>',
  energy_bolt: '<path d="M13 2 L6 13 h5 l-1 9 l8 -12 h-5 Z"/>',
  flashlight: '<path d="M4 10 h6 l8 -5 v14 l-8 -5 H4 Z"/><path d="M20 8 l2 -1"/><path d="M20 16 l2 1"/>',
  journal_scan: '<path d="M4 4 h7 v16 H4 Z"/><path d="M13 4 h7 v16 h-7 Z"/><path d="M7 9 l1.5 -2.5 l1.5 2.5 l-1.5 3 z"/>',
  grapple: '<path d="M12 3 v13"/><path d="M5 12 a7 7 0 0 0 14 0"/><path d="M9 6 h6"/><circle cx="12" cy="3" r="1"/>',
  charm: '<path d="M12 3 l2.6 5.6 6 .7 -4.4 4.1 1.2 6 -5.4 -3 -5.4 3 1.2 -6 -4.4 -4.1 6 -.7 Z"/>',
  // time of day
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2 v3"/><path d="M12 19 v3"/><path d="M2 12 h3"/><path d="M19 12 h3"/><path d="M4.9 4.9 l2.1 2.1"/><path d="M17 17 l2.1 2.1"/><path d="M4.9 19.1 l2.1 -2.1"/><path d="M17 7 l2.1 -2.1"/>',
  dusk: '<path d="M3 17 h18"/><path d="M6.5 17 a5.5 5.5 0 0 1 11 0"/><path d="M12 6 v2.5"/><path d="M5 9.5 l1.7 1.7"/><path d="M19 9.5 l-1.7 1.7"/><path d="M7 21 h10"/>',
  moon: '<path d="M20 14.5 A8.5 8.5 0 1 1 9.5 4 a6.8 6.8 0 0 0 10.5 10.5 Z"/>',
  // vitality pips
  pip_tri: '<path d="M12 3 L22 20 H2 Z"/>',
  pip_pine: '<path d="M12 2 L19 12 h-3 l4 6 H4 l4 -6 H5 Z"/><path d="M12 18 v4"/>',
  pip_star: '<path d="M12 2 l2.9 6.2 6.7 .8 -5 4.6 1.4 6.6 -6 -3.4 -6 3.4 1.4 -6.6 -5 -4.6 6.7 -.8 Z"/>',
  pip_dot: '<circle cx="12" cy="12" r="8"/>',
};

export function icon(id: string, cls = ''): string {
  const body = G[id] ?? G.ability;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/** Health pips use the character's own sign. */
export function pipFor(character: string): string {
  if (character === 'bill_child' || character === 'bill') return 'pip_tri';
  if (character === 'dipper') return 'pip_pine';
  if (character === 'mabel') return 'pip_star';
  return 'pip_dot';
}
