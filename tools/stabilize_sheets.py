"""Steadies the walk/run/ability sheets of every character.

The catalogue frames drift a few pixels sideways from one frame to the next,
so a character seems to wobble or walk crooked. For each row, every frame is
shifted horizontally so that the centre of the upper body (head and torso,
ignoring the swinging legs and arms below) sits on the row's median; feet stay
on the pivot line. Run after tools/extract_catalog.py:

    python3 tools/stabilize_sheets.py
"""
import glob
import numpy as np
from PIL import Image

CELL = 128


def body_centre(a):
    ys, xs = np.nonzero(a[:, :, 3] > 40)
    if len(xs) == 0:
        return None
    top, bot = ys.min(), ys.max()
    upper = ys < top + (bot - top) * 0.55
    return xs[upper].mean()


def main():
    for path in sorted(glob.glob('public/assets/characters/*/*.png')):
        if not path.endswith(('walk.png', 'run.png')):
            continue
        im = np.array(Image.open(path).convert('RGBA'))
        rows, cols = im.shape[0] // CELL, im.shape[1] // CELL
        out = np.zeros_like(im)
        moved = 0
        for r in range(rows):
            cells = [im[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] for c in range(cols)]
            cx = [body_centre(c) for c in cells]
            valid = [x for x in cx if x is not None]
            med = float(np.median(valid)) if valid else CELL / 2
            for c, cell in enumerate(cells):
                dx = 0 if cx[c] is None else int(round(med - cx[c]))
                dx = max(-8, min(8, dx))
                moved = max(moved, abs(dx))
                out[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = np.roll(cell, dx, axis=1)
        Image.fromarray(out).save(path)
        print(f'{path}: max shift {moved}px')


if __name__ == '__main__':
    main()
