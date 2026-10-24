/**
 * Bill's cipher: one rune per letter, drawn as strokes on a 24x24 grid after
 * the alphabet table in the reference. Text in the cipher is rendered as
 * inline SVG; letters the player has not learned stay untranslated.
 */
const R: Record<string, string> = {
  A: '<circle cx="8" cy="6" r="2"/><path d="M9.5 7.5 C13 10 6 11 6.5 14"/><ellipse cx="12" cy="16" rx="6" ry="3.5"/>',
  B: '<path d="M3 12 H8"/><circle cx="14" cy="12" r="5.5"/><path d="M14 5 V12"/>',
  C: '<path d="M5 7 V18 H19 V7"/><path d="M12 10 V18"/>',
  D: '<path d="M15 4 V12 H10 V19"/><circle cx="7" cy="18" r="0.9" fill="currentColor"/>',
  E: '<path d="M7 19 V5 L17 19 V5"/>',
  F: '<path d="M5 7 V18 H19 V7"/><path d="M9 14 V10 H15 V14"/>',
  G: '<path d="M6 5 H18 V10 H6 Z"/><path d="M6 14 H18 V19 H6 Z"/><path d="M12 10 V14"/>',
  H: '<path d="M5 6 H19"/><path d="M12 6 V18"/><path d="M5 18 H19"/><circle cx="8" cy="12" r="0.9" fill="currentColor"/><circle cx="16" cy="12" r="0.9" fill="currentColor"/>',
  I: '<path d="M12 4 L19 19 H5 Z"/><path d="M12 4 V19"/>',
  J: '<path d="M6 5 H18 L6 19 H18 Z"/>',
  K: '<path d="M3 6 L11 12 L3 18 Z"/><path d="M11 12 H21"/><path d="M15 9 V15"/><path d="M18 9 V15"/>',
  L: '<rect x="6" y="6" width="12" height="12"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  M: '<rect x="9" y="4" width="6" height="6"/><rect x="9" y="14" width="6" height="6"/>',
  N: '<path d="M11 5 H14 V10"/><path d="M10 14 V19 H14"/><circle cx="8" cy="12" r="0.9" fill="currentColor"/><circle cx="16" cy="12" r="0.9" fill="currentColor"/>',
  O: '<path d="M5 11 A7 7 0 0 1 19 11 Z"/><path d="M12 11 V20"/>',
  P: '<circle cx="6" cy="7" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="17" r="2"/><path d="M7.5 8.5 L10.5 10.5"/><path d="M13.5 13.5 L16.5 15.5"/>',
  Q: '<path d="M15 6 H9 V12 H16 V18 H11"/><circle cx="6" cy="9" r="0.9" fill="currentColor"/>',
  R: '<path d="M6 12 L12 6 L18 12 L12 18 L8.5 14.5 L12 11"/>',
  S: '<path d="M4 6 H20 L12 19 Z"/>',
  T: '<path d="M12 3 L15.5 9 H8.5 Z"/><path d="M12 13 L15.5 19 H8.5 Z"/>',
  U: '<path d="M7 5 H17 V19 H7"/><path d="M10 12 H17"/>',
  V: '<circle cx="9" cy="5.5" r="2"/><path d="M9 7.5 V18 H17"/>',
  W: '<path d="M12 4 L20 12 L12 20 L4 12 Z"/>',
  X: '<path d="M6 6 H18 V19 H6"/><path d="M10 6 V14 H14"/>',
  Y: '<circle cx="6" cy="16" r="2"/><circle cx="18" cy="16" r="2"/><path d="M7.4 14.4 L12 8 L16.6 14.4"/>',
  Z: '<path d="M7 4 L10 7 L7 10 L10 13 L7 16 L10 19"/><path d="M11 4 L14 7 L11 10 L14 13 L11 16 L14 19"/><path d="M15 4 L18 7 L15 10 L18 13 L15 16 L18 19"/>',
};

export const ALPHABET = Object.keys(R);

/** Folds accents away: the cipher only knows plain capitals. */
export function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

export function rune(letter: string, cls = ''): string {
  const body = R[letter];
  if (!body) return '';
  return `<svg class="rune ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/** A whole line in runes; spaces become gaps, anything else is dropped. */
export function runeLine(text: string): string {
  return plain(text).split(' ').map((w) => `<span class="rune-word">${[...w].map((c) => rune(c)).join('')}</span>`).join('');
}

/** Transliteration with unknown letters left as a blank mark. */
export function translate(text: string, known: (l: string) => boolean): string {
  return [...plain(text)].map((c) => (R[c] ? (known(c) ? c : '·') : c)).join('');
}
