"""Builds "Cipher Hand", the game's typeface: angular capitals of thin even
strokes, in the style of Bill Cipher's handwriting (C as an angle, O as a
diamond, dots as small triangles). Every glyph is a set of straight strokes on
a 4 x 7 grid; strokes become filled outlines. Lowercase maps to the capitals.

    pip install fonttools brotli
    python3 tools/make_font.py   ->  src/fonts/cipher-hand.woff2 (+ .ttf)
"""
import math
import os

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UX, UY = 120, 100          # grid unit (x, y): caps are 4 x 7 units
STROKE = 78                # stroke thickness in font units
SIDE = 70                  # side bearing
EM = 1000

# Strokes: each glyph is a list of polylines of (x, y) grid points, y up from the baseline.
# A "dot" is written as ('dot', x, y): a small filled triangle.
G = {
    'A': [[(0, 0), (2, 7), (4, 0)], [(0.9, 2.6), (3.1, 2.6)]],
    'B': [[(0, 0), (0, 7), (3.4, 5.4), (0, 3.6), (4, 1.8), (0, 0)]],
    'C': [[(4, 7), (0, 3.5), (4, 0)]],
    'D': [[(0, 0), (0, 7), (4, 3.5), (0, 0)]],
    'E': [[(4, 7), (0, 7), (0, 0), (4, 0)], [(0, 3.6), (3, 3.6)]],
    'F': [[(4, 7), (0, 7), (0, 0)], [(0, 3.6), (3, 3.6)]],
    'G': [[(4, 7), (0, 3.5), (4, 0), (4, 2.6), (2.4, 2.6)]],
    'H': [[(0, 0), (0, 7)], [(4, 0), (4, 7)], [(0, 3.6), (4, 3.6)]],
    'I': [[(0, 7), (2, 7)], [(1, 7), (1, 0)], [(0, 0), (2, 0)]],
    'J': [[(1.4, 7), (4, 7)], [(3.2, 7), (3.2, 1.4), (1.6, 0), (0, 1.4)]],
    'K': [[(0, 0), (0, 7)], [(4, 7), (0, 3.2)], [(1.2, 4.3), (4, 0)]],
    'L': [[(0, 7), (0, 0), (4, 0)]],
    'M': [[(0, 0), (0, 7), (2, 3), (4, 7), (4, 0)]],
    'N': [[(0, 0), (0, 7), (4, 0), (4, 7)]],
    'O': [[(2, 7), (4, 3.5), (2, 0), (0, 3.5), (2, 7)]],
    'P': [[(0, 0), (0, 7), (4, 5.2), (0, 3.4)]],
    'Q': [[(2, 7), (4, 3.5), (2, 0), (0, 3.5), (2, 7)], [(2.6, 1.6), (4.2, -0.8)]],
    'R': [[(0, 0), (0, 7), (4, 5.2), (0, 3.4)], [(1.6, 2.7), (4, 0)]],
    'S': [[(4, 7), (0, 5.2), (4, 1.8), (0, 0)]],
    'T': [[(0, 7), (4, 7)], [(2, 7), (2, 0)]],
    'U': [[(0, 7), (0, 0), (4, 0), (4, 7)]],
    'V': [[(0, 7), (2, 0), (4, 7)]],
    'W': [[(0, 7), (1, 0), (2, 4.6), (3, 0), (4, 7)]],
    'X': [[(0, 7), (4, 0)], [(4, 7), (0, 0)]],
    'Y': [[(0, 7), (2, 3.6), (4, 7)], [(2, 3.6), (2, 0)]],
    'Z': [[(0, 7), (4, 7), (0, 0), (4, 0)]],
    '0': [[(2, 7), (4, 4.6), (4, 2.4), (2, 0), (0, 2.4), (0, 4.6), (2, 7)]],
    '1': [[(0.8, 5.2), (2.4, 7), (2.4, 0)], [(1, 0), (3.8, 0)]],
    '2': [[(0, 5.4), (2, 7), (4, 5.4), (0, 0), (4, 0)]],
    '3': [[(0, 7), (4, 7), (1.6, 4), (4, 2), (2, 0), (0, 1)]],
    '4': [[(3, 0), (3, 7), (0, 2.2), (4, 2.2)]],
    '5': [[(4, 7), (0.4, 7), (0, 4.2), (4, 3), (2, 0), (0, 1)]],
    '6': [[(3.6, 7), (0, 3), (2, 0), (4, 2), (2, 4.2), (0.4, 3)]],
    '7': [[(0, 7), (4, 7), (1.4, 0)]],
    '8': [[(2, 7), (3.6, 5.4), (2, 3.8), (0.4, 5.4), (2, 7)], [(2, 3.8), (4, 1.9), (2, 0), (0, 1.9), (2, 3.8)]],
    '9': [[(0.4, 0), (4, 4), (2, 7), (0, 5), (2, 2.8), (3.6, 4)]],
    '.': [('dot', 0.6, 0)],
    ',': [[(1, 0.7), (0.3, -1.1)]],
    ':': [('dot', 0.6, 0), ('dot', 0.6, 3.8)],
    ';': [[(1, 0.7), (0.3, -1.1)], ('dot', 0.7, 3.8)],
    '!': [[(0.6, 7), (0.6, 2)], ('dot', 0.6, 0)],
    '?': [[(0, 5.4), (2, 7), (4, 5.4), (2, 3.6), (2, 2)], ('dot', 2, 0)],
    '-': [[(0.4, 3.2), (2.6, 3.2)]],
    '—': [[(0, 3.2), (5, 3.2)]],
    '–': [[(0, 3.2), (3.6, 3.2)]],
    "'": [[(0.5, 7), (0.3, 5)]],
    '’': [[(0.6, 7), (0.2, 5)]],
    '"': [[(0.3, 7), (0.2, 5)], [(1.5, 7), (1.4, 5)]],
    '«': [[(1.6, 5), (0, 3.4), (1.6, 1.8)], [(3.2, 5), (1.6, 3.4), (3.2, 1.8)]],
    '»': [[(0, 5), (1.6, 3.4), (0, 1.8)], [(1.6, 5), (3.2, 3.4), (1.6, 1.8)]],
    '(': [[(1.6, 7.6), (0, 3.5), (1.6, -0.6)]],
    ')': [[(0, 7.6), (1.6, 3.5), (0, -0.6)]],
    '[': [[(1.6, 7.6), (0, 7.6), (0, -0.6), (1.6, -0.6)]],
    ']': [[(0, 7.6), (1.6, 7.6), (1.6, -0.6), (0, -0.6)]],
    '/': [[(0, -0.4), (3, 7.4)]],
    '+': [[(0, 3.4), (3.4, 3.4)], [(1.7, 1.7), (1.7, 5.1)]],
    '=': [[(0, 4.4), (3.4, 4.4)], [(0, 2.4), (3.4, 2.4)]],
    '*': [[(1.6, 6.8), (1.6, 3.6)], [(0.2, 6), (3, 4.4)], [(3, 6), (0.2, 4.4)]],
    '%': [[(0, 0), (4, 7)], ('dot', 0.6, 5.6), ('dot', 3.4, 0.2)],
    '&': [[(4, 0), (0.6, 5.4), (2, 7), (3.2, 5.6), (0, 2.2), (1.6, 0), (4, 3)]],
    '#': [[(1, 0), (1.6, 7)], [(2.6, 0), (3.2, 7)], [(0, 2.4), (4, 2.4)], [(0, 4.8), (4, 4.8)]],
    '$': [[(4, 6), (0, 4.6), (4, 2.4), (0, 1)], [(2, 7.4), (2, -0.4)]],
    '@': [[(3, 2), (2, 4.4), (1, 2), (3, 2), (4, 3.5), (2, 7), (0, 3.5), (2, 0), (4, 0.6)]],
    '|': [[(0.6, 7.6), (0.6, -0.6)]],
    '_': [[(0, -0.6), (4, -0.6)]],
    '…': [('dot', 0.6, 0), ('dot', 2.2, 0), ('dot', 3.8, 0)],
    '·': [('dot', 0.6, 3.2)],
    'º': [[(1, 7), (2, 6), (1, 5), (0, 6), (1, 7)]],
    'ª': [[(0, 5), (1, 7), (2, 5)]],
}

# accents drawn above (or below) the capitals
ACC = {
    'acute': [[(1.4, 8.2), (2.8, 9.4)]],
    'grave': [[(1.2, 9.4), (2.6, 8.2)]],
    'circ': [[(1, 8.2), (2, 9.4), (3, 8.2)]],
    'tilde': [[(0.8, 8.4), (1.6, 9.2), (2.4, 8.4), (3.2, 9.2)]],
    'diaer': [('dot', 1.2, 8.4), ('dot', 2.8, 8.4)],
    'ring': [[(2, 9.6), (2.7, 8.9), (2, 8.2), (1.3, 8.9), (2, 9.6)]],
}
COMPOSED = {
    'Á': ('A', 'acute'), 'À': ('A', 'grave'), 'Â': ('A', 'circ'), 'Ã': ('A', 'tilde'), 'Ä': ('A', 'diaer'), 'Å': ('A', 'ring'),
    'É': ('E', 'acute'), 'È': ('E', 'grave'), 'Ê': ('E', 'circ'), 'Ë': ('E', 'diaer'),
    'Í': ('I', 'acute'), 'Ì': ('I', 'grave'), 'Î': ('I', 'circ'), 'Ï': ('I', 'diaer'),
    'Ó': ('O', 'acute'), 'Ò': ('O', 'grave'), 'Ô': ('O', 'circ'), 'Õ': ('O', 'tilde'), 'Ö': ('O', 'diaer'),
    'Ú': ('U', 'acute'), 'Ù': ('U', 'grave'), 'Û': ('U', 'circ'), 'Ü': ('U', 'diaer'),
    'Ñ': ('N', 'tilde'),
}


def width_of(strokes):
    xs = [0.0]
    for s in strokes:
        if isinstance(s, tuple):
            xs.append(s[1] + 0.6)
        else:
            xs += [p[0] for p in s]
    return max(xs)


def seg_poly(p, q, w):
    """Rectangle around segment p-q, extended by half the stroke at both ends (clockwise)."""
    (x1, y1), (x2, y2) = p, q
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    h = w / 2
    a = (x1 - ux * h + nx * h, y1 - uy * h + ny * h)
    b = (x2 + ux * h + nx * h, y2 + uy * h + ny * h)
    c = (x2 + ux * h - nx * h, y2 + uy * h - ny * h)
    d = (x1 - ux * h - nx * h, y1 - uy * h - ny * h)
    return [a, b, c, d]


def clockwise(poly):
    area = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
    return poly if area < 0 else list(reversed(poly))


def draw(pen, strokes, ox=0.0):
    for s in strokes:
        if isinstance(s, tuple):
            _, x, y = s
            cx, cy = ox + x * UX, y * UY
            r = STROKE * 1.15
            tri = [(cx, cy + r * 1.3), (cx + r, cy), (cx - r, cy)]
            poly = clockwise(tri)
        else:
            pts = [(ox + x * UX, y * UY) for x, y in s]
            for i in range(len(pts) - 1):
                poly = clockwise(seg_poly(pts[i], pts[i + 1], STROKE))
                pen.moveTo(tuple(round(v) for v in poly[0]))
                for v in poly[1:]:
                    pen.lineTo(tuple(round(c) for c in v))
                pen.closePath()
            continue
        pen.moveTo(tuple(round(v) for v in poly[0]))
        for v in poly[1:]:
            pen.lineTo(tuple(round(c) for c in v))
        pen.closePath()


def main():
    glyphs = dict(G)
    for ch, (base, acc) in COMPOSED.items():
        glyphs[ch] = G[base] + ACC[acc]
    glyphs['Ç'] = G['C'] + [[(2.6, 0), (2.6, -0.8), (1.4, -1.6)]]
    glyphs[' '] = []
    order = ['.notdef'] + [f'g{ord(c):04X}' for c in glyphs]
    cmap = {}
    for c in glyphs:
        name = f'g{ord(c):04X}'
        cmap[ord(c)] = name
        low = c.lower()
        if low != c and len(low) == 1 and low not in glyphs:
            cmap[ord(low)] = name
    fb = FontBuilder(EM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    gl, metrics = {}, {}
    pen = TTGlyphPen(None)
    pen.moveTo((0, 0)); pen.lineTo((0, 700)); pen.lineTo((400, 700)); pen.lineTo((400, 0)); pen.closePath()
    gl['.notdef'] = pen.glyph()
    metrics['.notdef'] = (500, 0)
    for c, strokes in glyphs.items():
        name = f'g{ord(c):04X}'
        pen = TTGlyphPen(None)
        draw(pen, strokes, ox=SIDE + STROKE / 2)
        gl[name] = pen.glyph()
        adv = 300 if c == ' ' else int(SIDE * 2 + STROKE + width_of(strokes) * UX)
        metrics[name] = (adv, SIDE)
    fb.setupGlyf(gl)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=980, descent=-260)
    fb.setupNameTable({'familyName': 'Cipher Hand', 'styleName': 'Regular'})
    fb.setupOS2(sTypoAscender=980, sTypoDescender=-260, sTypoLineGap=0, usWinAscent=980, usWinDescent=260, sxHeight=700, sCapHeight=700)
    fb.setupPost()
    os.makedirs('src/fonts', exist_ok=True)
    fb.save('src/fonts/cipher-hand.ttf')
    fb.font.flavor = 'woff2'
    fb.save('src/fonts/cipher-hand.woff2')
    print('glyphs', len(glyphs))


if __name__ == '__main__':
    main()
