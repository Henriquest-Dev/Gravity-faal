import { ASSET_ROOT, sheetMeta } from '../assets';
import { CHARACTERS } from '../data';

/**
 * Dialogue portraits cut from the catalogue's own animation frames. Each
 * character has a few moods mapped to frames whose pose or face expresses it
 * (the idle, hurt and gesture sheets are full of them). The frame is trimmed
 * to its visible pixels and framed on head and shoulders.
 */
export type Mood = 'neutral' | 'happy' | 'surprised' | 'scared' | 'thinking' | 'angry' | 'sad' | 'smug';

type Frame = [sheet: string, row: number, col: number];

const P: Record<string, Partial<Record<Mood, Frame>>> = {
  bill_child: {
    neutral: ['protag_idle', 0, 0], thinking: ['protag_idle', 0, 3], smug: ['protag_idle', 0, 4], sad: ['protag_idle', 0, 2],
    surprised: ['protag_hurt', 0, 1], scared: ['protag_hurt', 0, 3], happy: ['protag_idle', 0, 4], angry: ['protag_idle', 0, 6],
  },
  bill: {
    neutral: ['protag_idle', 1, 0], smug: ['protag_idle', 1, 4], thinking: ['protag_idle', 1, 3], angry: ['protag_idle', 1, 6],
    surprised: ['protag_hurt', 1, 1], happy: ['protag_idle', 1, 4], sad: ['protag_idle', 1, 2], scared: ['protag_hurt', 1, 3],
  },
  dipper: {
    neutral: ['protag_idle', 2, 0], happy: ['protag_idle', 2, 2], thinking: ['protag_idle', 2, 7], angry: ['protag_idle', 2, 4],
    sad: ['protag_idle', 2, 6], smug: ['protag_idle', 2, 4], surprised: ['protag_hurt', 2, 1], scared: ['protag_hurt', 2, 3],
  },
  mabel: {
    neutral: ['protag_idle', 3, 0], happy: ['protag_idle', 3, 4], smug: ['protag_idle', 3, 2], thinking: ['protag_idle', 3, 6],
    sad: ['protag_idle', 3, 6], angry: ['protag_idle', 3, 7], surprised: ['protag_hurt', 3, 1], scared: ['protag_hurt', 3, 3],
  },
  stan: { neutral: ['characters/stan/walk', 0, 0], thinking: ['cast_a', 0, 3], happy: ['cast_a', 0, 2], angry: ['cast_a', 0, 5], smug: ['cast_a', 0, 1], surprised: ['cast_a', 0, 6] },
  soos: { neutral: ['characters/soos/walk', 0, 0], happy: ['cast_a', 1, 4], thinking: ['cast_a', 1, 5], smug: ['cast_a', 1, 6], surprised: ['cast_a', 1, 4] },
  wendy: { neutral: ['characters/wendy/walk', 0, 0], happy: ['cast_a', 2, 6], smug: ['cast_a', 2, 6], thinking: ['cast_a', 2, 0] },
  mcgucket: { neutral: ['characters/mcgucket/walk', 0, 0], happy: ['cast_a', 3, 6], surprised: ['cast_a', 3, 5], thinking: ['cast_a', 3, 3], scared: ['cast_a', 3, 5] },
  ford: { neutral: ['characters/ford/walk', 0, 0], thinking: ['cast_b', 0, 6], surprised: ['cast_b', 0, 3], angry: ['cast_b', 0, 4] },
  pacifica: { neutral: ['characters/pacifica/walk', 0, 0], smug: ['cast_b', 1, 2], happy: ['cast_b', 1, 6], angry: ['cast_b', 1, 1] },
  felicia: { neutral: ['characters/felicia/walk', 0, 0], thinking: ['cast_b', 2, 2], happy: ['cast_b', 2, 5] },
  waddles: { neutral: ['cast_b', 3, 0], happy: ['cast_b', 3, 6] },
  professor_circle: { neutral: ['euclydia_adults', 0, 0], thinking: ['euclydia_adults', 0, 5], happy: ['euclydia_adults', 0, 3], surprised: ['euclydia_adults', 0, 6] },
  artisan_triangle: { neutral: ['euclydia_adults', 1, 0], happy: ['euclydia_adults', 1, 3], thinking: ['euclydia_adults', 1, 5] },
  merchant_square: { neutral: ['euclydia_adults', 2, 0], happy: ['euclydia_adults', 2, 3], angry: ['euclydia_adults', 2, 5], thinking: ['euclydia_adults', 2, 7] },
  elder_hexagon: { neutral: ['euclydia_adults', 3, 0], thinking: ['euclydia_adults', 3, 5], sad: ['euclydia_adults', 3, 4], happy: ['euclydia_adults', 3, 3] },
  blendin: { neutral: ['time_agents', 0, 0] },
  lolph: { neutral: ['time_agents', 1, 0] },
  dundgren: { neutral: ['time_agents', 2, 0] },
  cyclock: { neutral: ['time_agents', 3, 0] },
  pyronica: { neutral: ['dimensional_presence', 0, 0], smug: ['dimensional_presence', 0, 3] },
  hectorgon: { neutral: ['dimensional_presence', 1, 0], angry: ['dimensional_presence', 1, 7] },
  keyhole: { neutral: ['dimensional_presence', 2, 0] },
  teeth: { neutral: ['dimensional_presence', 3, 0] },
  bola8: { neutral: ['bola8_move', 0, 0], angry: ['bola8_attack', 0, 3] },
  time_baby: { neutral: ['time_baby', 0, 0], angry: ['time_baby', 2, 3], sad: ['time_baby', 3, 0], surprised: ['time_baby', 3, 2] },
};

/** Speaker names used in dialogue files that are not a character's display name. */
const ALIAS: Record<string, string> = {
  'Bill': 'bill_child', 'Tri': 'bill_child', 'Bola 8': 'bola8', 'Stan': 'stan', 'Tio Stan': 'stan', 'Grunkle Stan': 'stan',
  'Ford': 'ford', 'Bill Cipher': 'bill', 'Blendin': 'blendin',
};

export function speakerId(speaker: string, arc: number): string | null {
  if (!speaker) return null;
  if (speaker === 'Bill' && arc === 2) return 'bill';
  if (ALIAS[speaker]) return ALIAS[speaker];
  for (const [id, c] of Object.entries(CHARACTERS)) if (c.name === speaker) return id;
  return null;
}

/** Guesses a mood from the line itself when the node does not name one. */
export function inferMood(text: string): Mood {
  const t = text.trim();
  if (/!\?|\?!/.test(t)) return 'surprised';
  if (/^(ah|oh|o quê|espera|quê)\b/i.test(t)) return 'surprised';
  if (/\.\.\.|…/.test(t) && t.length < 90) return 'thinking';
  if (/!$/.test(t)) return 'happy';
  return 'neutral';
}

const cache = new Map<string, Promise<string | null>>();
const images = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error(url));
      im.src = url;
    });
    images.set(url, p);
  }
  return p;
}

export function hasPortrait(id: string | null): boolean {
  return !!id && !!P[id];
}

/** Data URL of the portrait, or null when the character has none. */
export function portrait(id: string, mood: Mood, size = 128): Promise<string | null> {
  const set = P[id];
  if (!set) return Promise.resolve(null);
  const fr = set[mood] ?? set.neutral!;
  const key = `${id}|${fr.join(',')}|${size}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      try {
        const meta = sheetMeta(fr[0]);
        const im = await loadImage(ASSET_ROOT + meta.file);
        const cell = meta.cell;
        const src = document.createElement('canvas');
        src.width = src.height = cell;
        const sc = src.getContext('2d')!;
        sc.drawImage(im, fr[2] * cell, fr[1] * cell, cell, cell, 0, 0, cell, cell);
        const px = sc.getImageData(0, 0, cell, cell).data;
        let x0 = cell, y0 = cell, x1 = -1, y1 = -1;
        for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
          if (px[(y * cell + x) * 4 + 3] > 40) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
        if (x1 < 0) return null;
        // head and shoulders: centre on the top of the figure, so raised arms or held tools do not widen the frame
        const bh = y1 - y0 + 1;
        const headRows = Math.max(8, Math.round(bh * 0.26));
        let hx0 = cell, hx1 = -1;
        for (let y = y0; y < y0 + headRows; y++) for (let x = 0; x < cell; x++) {
          if (px[(y * cell + x) * 4 + 3] > 40) { if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }
        }
        const side = Math.max(Math.min(hx1 - hx0 + 10, Math.round(bh * 0.8)), Math.round(bh * 0.62));
        const cx = (hx0 + hx1) / 2;
        const sx = Math.round(cx - side / 2), sy = Math.max(0, y0 - 3);
        const out = document.createElement('canvas');
        out.width = out.height = size;
        const oc = out.getContext('2d')!;
        oc.imageSmoothingEnabled = false;
        oc.drawImage(src, sx, sy, side, side, 0, 0, size, size);
        return out.toDataURL();
      } catch {
        return null;
      }
    })();
    cache.set(key, p);
  }
  return p;
}

export function characterName(id: string): string {
  return CHARACTERS[id]?.name ?? id;
}
