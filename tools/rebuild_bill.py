"""Bill's walk and run, recomposed so the triangle stays upright.

In the catalogue sheets the triangle tilts and changes shape from frame to
frame, so Bill looks crooked when he walks or runs. Here, for every
direction, the body of the row's first walk frame (the triangle with its eye,
bow tie and hat) is kept as the one body; each frame contributes only its arms
and legs, and the body follows that frame's height so the stride still bobs.

    python3 tools/rebuild_bill.py   (after extract_catalog.py and stabilize_sheets.py)
"""
import numpy as np
from PIL import Image

CELL = 128


def is_body(px):
    r, g, b, a = px[..., 0].astype(int), px[..., 1].astype(int), px[..., 2].astype(int), px[..., 3]
    # every light pixel is body: the yellow triangle and the white of the eye
    return (a > 40) & (r * 0.3 + g * 0.59 + b * 0.11 >= 95)


def body_mask(cell, hat):
    a = cell[..., 3] > 40
    y = is_body(cell)
    m = np.zeros_like(a)
    ys = np.nonzero(y.any(axis=1))[0]
    if not len(ys):
        return m
    for row in ys:
        xs = np.nonzero(y[row])[0]
        m[row, xs.min():xs.max() + 1] = True
    top, x0, x1 = ys.min(), np.nonzero(y.any(axis=0))[0].min(), np.nonzero(y.any(axis=0))[0].max()
    if hat:
        # the top hat sits above the apex
        m[max(0, top - 22):top, max(0, (x0 + x1) // 2 - 10):(x0 + x1) // 2 + 11] = True
    return m & a


def rebuild(char, hat):
    walk = np.array(Image.open(f'public/assets/characters/{char}/walk.png').convert('RGBA'))
    for kind in ('walk', 'run'):
        path = f'public/assets/characters/{char}/{kind}.png'
        sheet = np.array(Image.open(path).convert('RGBA'))
        out = np.zeros_like(sheet)
        for r in range(4):
            ref = walk[r * CELL:(r + 1) * CELL, 0:CELL]
            rm = body_mask(ref, hat)
            ry, rx = np.nonzero(rm)
            ref_bottom, ref_cx = ry.max(), rx.mean()
            for c in range(8):
                cell = sheet[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL]
                m = body_mask(cell, hat)
                ys, xs = np.nonzero(m)
                frame = np.zeros_like(cell)
                luma = cell[..., 0] * 0.3 + cell[..., 1] * 0.59 + cell[..., 2] * 0.11
                # arms and legs are the dark strokes; light slivers belong to the old tilted body
                limbs = (cell[..., 3] > 40) & ~m & (luma < 95)
                if len(xs):
                    # limbs keep their place relative to where this frame's body is
                    dx = int(round(ref_cx - xs.mean()))
                    frame[limbs] = 0
                    shifted = np.roll(np.where(limbs[..., None], cell, 0), dx, axis=1)
                    frame = shifted
                    # bob: the body rises with the stride, never tilts
                    bob = int(np.clip(ys.max() - ref_bottom, -3, 2)) if kind == 'run' else int(np.clip(ys.max() - ref_bottom, -1, 1))
                else:
                    bob = 0
                body = np.zeros_like(cell)
                body[rm] = ref[rm]
                body = np.roll(body, bob, axis=0)
                keep = body[..., 3] > 40
                frame[keep] = body[keep]
                out[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = frame
        Image.fromarray(out).save(path)
        print('rebuilt', path)


if __name__ == '__main__':
    rebuild('bill_child', hat=False)
    rebuild('bill', hat=True)
