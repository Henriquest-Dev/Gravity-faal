/**
 * The Mystery Shack, painted pixel by pixel after the show's composition: a
 * tall A-frame on the left with its lit triangular window and the name painted
 * over the door; behind it the mossy main roof carrying the two-board sign
 * (MYSTERY in black, SHACK in red, the S hanging crooked); the gift shop on the
 * right with its dark roof plate and GIFTS board; a plank porch along the
 * front; the question-mark weathervane and the stove pipe on the roof.
 *
 * Four versions: as the twins find it, during Weirdmageddon, wrecked, and
 * rebuilt after the summer.
 */
export type ShackVariant = 'normal' | 'weird' | 'ruined' | 'rebuilt';

// 5x7 capitals for the big sign
const F5: Record<string, string[]> = {
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function h32(x: number, y: number): number {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function paintShack(c: CanvasRenderingContext2D, W: number, H: number, ax: number, v: ShackVariant): void {
  c.imageSmoothingEnabled = false;
  const r = (col: string, x: number, y: number, w: number, h: number) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const poly = (col: string, pts: [number, number][]) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(Math.round(pts[0][0]), Math.round(pts[0][1]));
    for (const p of pts.slice(1)) c.lineTo(Math.round(p[0]), Math.round(p[1]));
    c.closePath();
    c.fill();
  };
  const text5 = (s: string, x: number, y: number, sc: number, col: string, wobble = 0) => {
    let cx = x;
    for (const [i, ch] of [...s].entries()) {
      const g = F5[ch] ?? F5[' '];
      const dy = wobble ? Math.round(Math.sin(i * 1.7) * wobble) : 0;
      for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) if (g[row][col] === '1') r(col_(col), cx + col * sc, y + dy + row * sc, sc, sc);
      cx += 6 * sc;
    }
    function col_(_c: number) { return col; }
  };
  const base = H;
  const deck = base - 12;
  const bright = v === 'rebuilt';
  const P = {
    plankA: bright ? '#80583a' : '#6b4a32', plankB: bright ? '#6f4c32' : '#5c3f2a', gap: '#2b1a10',
    slope: bright ? '#54392a' : '#46301f', moss: bright ? '#788a3c' : '#66763a', mossB: '#56652e', mossD: '#3f4a22',
    log: bright ? '#c49870' : '#ad845e', logB: bright ? '#b08660' : '#9a7350', logLine: '#5a3c26',
    deck: bright ? '#d2aa7c' : '#bd956a', deckLine: '#7a5838', cream: '#eadcb8', creamB: '#d7c69e',
    plate: '#3a3634', plateB: '#2c2826', glow: v === 'weird' ? '#ff7ad0' : '#ffd46a', glowHi: v === 'weird' ? '#ffc2ec' : '#fff0b0',
    signY: '#ecc94e', signYB: '#c9a43a', ink: '#2a1c12', red: '#c8382a',
  };
  const lit = v !== 'ruined';

  // ------------------------------------------------ main body (behind the A-frame)
  const mx0 = ax + 40, mx1 = ax + 262, wallTop = base - 98, ridge = base - 196;
  // stove pipe and weathervane behind the roof
  r('#2c2a2a', ax + 206, ridge - 54, 7, 70);
  r('#3e3b3a', ax + 206, ridge - 54, 2, 70);
  r('#1e1c1c', ax + 202, ridge - 58, 15, 6);
  if (v !== 'ruined') {
    r('#1c1410', ax + 240, ridge - 56, 3, 60);
    text5('?', ax + 232, ridge - 96, 4, '#1c1410');
    r('#1c1410', ax + 226, ridge - 44, 32, 3);
  }
  // log wall
  for (let y = wallTop; y < deck; y += 7) {
    r(((y - wallTop) / 7) % 2 ? P.log : P.logB, mx0, y, mx1 - mx0, 7);
    r(P.logLine, mx0, y + 6, mx1 - mx0, 1);
  }
  // mossy roof: a big slanted mass with shingles showing through
  poly(P.mossD, [[mx0 - 14, wallTop + 6], [mx0 + 26, ridge], [mx1 - 30, ridge], [mx1 + 16, wallTop + 6]]);
  for (let y = ridge + 2; y < wallTop + 4; y += 3) {
    const t = (y - ridge) / (wallTop - ridge);
    const x0 = mx0 + 26 - t * 40, x1 = mx1 - 30 + t * 46;
    for (let x = x0; x < x1; x += 3) {
      const n = h32(Math.floor(x / 5), Math.floor(y / 4));
      r(n < 0.45 ? P.moss : n < 0.75 ? P.mossB : n < 0.9 ? '#7a5a3a' : P.mossD, x, y, 3, 3);
    }
  }
  r('#2a1d12', mx0 - 14, wallTop + 4, mx1 - mx0 + 30, 4);
  // window on the main wall, lamp-lit
  const wx = ax + 128, wy = wallTop + 22;
  r('#2a1a10', wx - 3, wy - 3, 44, 36);
  r(lit ? P.glow : '#1a120c', wx, wy, 38, 30);
  if (lit) r(P.glowHi, wx + 3, wy + 3, 12, 10);
  r('#2a1a10', wx + 18, wy, 2, 30);
  r('#2a1a10', wx, wy + 14, 38, 2);
  // "?" plaque on the wall
  r('#3a2414', ax + 190, wallTop + 26, 26, 30);
  text5('?', ax + 195, wallTop + 30, 3, P.cream);

  // ------------------------------------------------ gift shop (right)
  const gx0 = mx1 - 6, gx1 = W - 4, gTop = base - 82;
  for (let y = gTop; y < deck; y += 6) {
    r(((y - gTop) / 6) % 2 ? P.cream : P.creamB, gx0, y, gx1 - gx0, 6);
    r('#a8987a', gx0, y + 5, gx1 - gx0, 1);
  }
  if (v !== 'ruined') {
    // dark roof plate with the oval sign
    poly(P.plateB, [[gx0 - 30, gTop + 4], [gx0 - 6, gTop - 56], [gx1 - 4, gTop - 56], [gx1 + 2, gTop + 4]]);
    poly(P.plate, [[gx0 - 24, gTop + 1], [gx0 - 2, gTop - 52], [gx1 - 8, gTop - 52], [gx1 - 2, gTop + 1]]);
    const ox = gx0 + 22, oy = gTop - 40;
    c.fillStyle = '#c9b48a';
    c.beginPath(); c.ellipse(ox + 30, oy + 13, 30, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8a7350';
    c.beginPath(); c.ellipse(ox + 30, oy + 13, 25, 8, 0, 0, Math.PI * 2); c.fill();
  }
  // GIFTS board on a little awning, red vending machine at the door
  r('#3a2414', gx0 + 50, gTop + 6, 4, 22);
  r('#e8a7a0', gx0 + 30, gTop - 6, 58, 20);
  r('#b86e66', gx0 + 30, gTop + 12, 58, 2);
  text5('GIFTS', gx0 + 33, gTop - 3, 2, P.red);
  r('#e9e2d0', gx0 + 12, gTop + 34, 26, deck - gTop - 34);
  r('#c8382a', gx0 + 12, gTop + 34, 26, 10);
  r('#c8382a', gx0 + 12, gTop + 56, 26, 6);
  r(lit ? P.glow : '#1a120c', gx0 + 50, gTop + 34, 34, 24);
  r('#5a4632', gx0 + 66, gTop + 34, 2, 24);

  // ------------------------------------------------ the A-frame (left)
  const half = 92, peak = base - 282;
  const halfAt = (y: number) => ((y - peak) / (deck - peak)) * half;
  // roof slopes
  poly(P.slope, [[ax, peak - 6], [ax + half + 16, deck], [ax - half - 16, deck]]);
  for (let y = peak; y < deck; y += 5) {
    const hw = halfAt(y) + 14;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 14; k += 2) {
        const x = ax + s * (hw - k);
        if (h32(Math.floor(x / 3), Math.floor(y / 5)) < 0.18) r(P.mossB, x, y, 2, 4);
      }
    }
    r('#2e1f14', ax - hw, y + 4, hw * 2, 1);
  }
  // board face
  for (let y = peak + 22; y < deck; y++) {
    const hw = halfAt(y) - 8;
    if (hw <= 0) continue;
    for (let x = ax - hw; x < ax + hw; x += 2) {
      const plank = Math.floor((x - ax + 200) / 9);
      r(plank % 2 ? P.plankA : P.plankB, x, y, 2, 1);
      if ((x - ax + 200) % 9 < 1) r(P.gap, x, y, 1, 1);
    }
  }
  // lit triangular attic window
  const ty = peak + 58;
  for (let i = 0; i < 26; i++) {
    r('#2a1a10', ax - i / 2 - 2, ty + i, i + 4, 1);
    if (i > 2) r(lit ? (i < 10 ? P.glowHi : P.glow) : '#1a120c', ax - i / 2 + 1, ty + i, i - 2, 1);
  }
  // painted name over the door
  const nby = deck - 98;
  r('#3a2618', ax - 46, nby, 92, 40);
  text5('MYSTERY', ax - 41, nby + 4, 2, P.cream);
  text5('SHACK', ax - 29, nby + 22, 2, P.cream);
  // door with porch roof
  r('#2a1a10', ax - 18, deck - 52, 36, 52);
  r(v === 'rebuilt' ? '#3f6a4a' : '#5a2a22', ax - 14, deck - 48, 28, 48);
  r('#e0b860', ax + 8, deck - 26, 3, 3);
  poly('#3a2a1c', [[ax - 34, deck - 56], [ax + 34, deck - 56], [ax + 28, deck - 64], [ax - 28, deck - 64]]);

  // ------------------------------------------------ porch along the front
  r(P.deckLine, 14, deck, gx1 - 30, 3);
  for (let x = 14; x < gx1 - 16; x += 6) {
    r(((x / 6) | 0) % 2 ? P.deck : '#b08a62', x, deck + 3, 6, 9);
    r(P.deckLine, x + 5, deck + 3, 1, 9);
  }
  for (const px of [20, ax + 60, mx0 + 150, gx0 - 6]) r('#4a3220', px, deck - 4, 5, 16);
  // little steps in front of the door
  r('#a07a52', ax - 20, base - 6, 40, 6);

  // ------------------------------------------------ the sign
  const sx = ax + 52, sy = ridge - 74;
  const board = (x: number, y: number, w: number, h: number) => {
    r('#2a1a10', x - 2, y - 2, w + 4, h + 4);
    r(P.signYB, x, y, w, h);
    r(P.signY, x + 2, y + 2, w - 4, h - 5);
    for (let i = 0; i < 8; i++) r('rgba(150,100,30,0.25)', x + 6 + h32(i, 7) * (w - 16), y + 4 + h32(i, 3) * (h - 10), 5, 1);
  };
  if (v === 'ruined') {
    // the sign lies broken in front of the porch
    c.save();
    c.translate(mx0 + 40, base - 14);
    c.rotate(-0.12);
    board(0, -30, 150, 28);
    text5('MYSTERY', 10, -26, 3, P.ink);
    c.restore();
    c.save();
    c.translate(gx0 - 60, base - 8);
    c.rotate(0.35);
    board(0, -24, 92, 24);
    text5('HACK', 8, -21, 3, P.red);
    c.restore();
  } else {
    const tilt = v === 'weird' ? -0.07 : 0;
    // posts down into the moss
    r('#2a1a10', sx + 30, sy + 40, 5, 60);
    r('#2a1a10', sx + 150, sy + 40, 5, 60);
    c.save();
    c.translate(sx, sy);
    c.rotate(tilt);
    board(0, 0, 196, 42);
    text5('MYSTERY', 14, 5, 4, P.ink);
    board(36, 46, 168, 42);
    if (v === 'rebuilt') text5('SHACK', 50, 51, 4, P.red);
    else {
      // the S hangs from one nail
      c.save();
      c.translate(56, 56);
      c.rotate(0.5);
      text5('S', -10, -14, 4, P.red);
      c.restore();
      text5('HACK', 74, 51, 4, P.red);
    }
    c.restore();
  }

  // ------------------------------------------------ string lights
  if (v !== 'ruined') {
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = mx1 - 10 + t * (gx1 - mx1), y = gTop - 70 + Math.sin(t * Math.PI) * 14 + t * 30;
      r('#2a1a10', x, y, 1, 1);
      if (i % 2 === 0) r(v === 'weird' ? '#ff6ac8' : '#ffd879', x - 1, y + 1, 3, 3);
    }
  }

  // ------------------------------------------------ versions
  if (v === 'weird') {
    // Weirdmageddon: magenta cracks, chunks of roof floating loose
    c.globalCompositeOperation = 'source-atop';
    r('rgba(140,40,120,0.18)', 0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 9; k++) {
      let x = 30 + h32(k, 1) * (W - 60), y = base - 30 - h32(k, 2) * 200;
      for (let s = 0; s < 14; s++) {
        r('#ff4fa8', x, y, 2, 2);
        r('rgba(255,160,220,0.5)', x - 1, y - 1, 4, 4);
        x += (h32(k, s) - 0.5) * 8;
        y += 3;
      }
    }
    for (let k = 0; k < 7; k++) {
      const x = mx0 + h32(k, 9) * (mx1 - mx0), y = ridge - 40 - h32(k, 8) * 70;
      r(P.mossD, x, y, 10 + h32(k, 5) * 12, 6);
      r('#ff7ad0', x, y + 6, 10, 1);
    }
  }
  if (v === 'ruined') {
    // the top of the A-frame is torn off and the roof is holed
    c.globalCompositeOperation = 'destination-out';
    poly('#000', [[ax - 60, peak - 10], [ax + 70, peak - 10], [ax + 40, peak + 70], [ax + 8, peak + 52], [ax - 10, peak + 84], [ax - 30, peak + 60]]);
    c.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 5; k++) {
      const x = mx0 + 20 + h32(k, 4) * (mx1 - mx0 - 60), y = ridge + 20 + h32(k, 6) * 40;
      c.fillStyle = '#140d08';
      c.beginPath(); c.ellipse(x, y, 14 + h32(k, 2) * 12, 8 + h32(k, 3) * 6, h32(k, 9), 0, Math.PI * 2); c.fill();
    }
    for (let k = 0; k < 10; k++) r(h32(k, 1) < 0.5 ? P.plankA : P.log, 10 + h32(k, 2) * (W - 40), base - 8 - h32(k, 3) * 6, 14 + h32(k, 4) * 20, 4);
  }
  if (v === 'rebuilt') {
    // bunting over the porch for the reopening
    const cols = ['#c8382a', '#ecc94e', '#3f6a4a', '#7a5ab8'];
    for (let i = 0; i < 18; i++) {
      const x = 24 + i * ((gx1 - 60) / 18), y = deck - 72 + Math.sin((i / 17) * Math.PI) * 10;
      poly(cols[i % 4], [[x, y], [x + 10, y], [x + 5, y + 9]]);
    }
  }
}

export const SHACK_SIZE = { W: 492, H: 330 };
