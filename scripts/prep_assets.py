#!/usr/bin/env python3
"""Extract the LOOP wordmark and the tagline from IMG_loop.PNG.

The file is an opaque screenshot (black bars, white card). The dark ink is
keyed off the white card into alpha and split into the wordmark and the
"Travel & Tourism" tagline, keeping their original relative position.
Writes public/assets/wordmark.png, tagline.png and src/assets.json.
The props are prepared by scripts/prep_stencils.py.
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets')
os.makedirs(OUT, exist_ok=True)
meta = {}


def load(name):
    return np.asarray(Image.open(os.path.join(ROOT, name)).convert('RGBA')).astype(np.float64)


def save(name, arr):
    Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8), 'RGBA').save(
        os.path.join(OUT, name), optimize=True)


def bbox(alpha, thr=8, pad=4):
    ys, xs = np.where(alpha > thr)
    h, w = alpha.shape
    return (max(xs.min() - pad, 0), max(ys.min() - pad, 0),
            min(xs.max() + 1 + pad, w), min(ys.max() + 1 + pad, h))


# ---------------------------------------------------------------- wordmark
def wordmark():
    lum = np.asarray(Image.open(os.path.join(ROOT, 'IMG_loop.PNG')).convert('L')).astype(np.float64)
    ink = 27.0                                   # measured ink level; card is 255
    alpha = np.clip((255.0 - lum) / (255.0 - ink), 0, 1)
    alpha[alpha < 0.04] = 0                      # screenshot noise on the card
    rows = np.where((lum > 128).mean(axis=1) > 0.5)[0]   # the white card only
    card = np.zeros_like(alpha)
    card[rows.min():rows.max() + 1] = 1
    alpha *= card

    def cut(y0, y1, name):
        a = alpha[y0:y1]
        xs = np.where(a.max(axis=0) > 0.3)[0]
        x0, x1 = xs.min() - 6, xs.max() + 7
        a = alpha[y0 - 6:y1 + 6, x0:x1]
        rgba = np.zeros(a.shape + (4,))
        rgba[..., :3] = ink
        rgba[..., 3] = a * 255
        save(name, rgba)
        return dict(x=int(x0), y=int(y0 - 6), w=int(x1 - x0), h=int(a.shape[0]))

    ys = np.where((alpha > 0.5).any(axis=1))[0]
    gaps = np.where(np.diff(ys) > 10)[0]         # blank band between LOOP and tagline
    split = ys[gaps[0]] + 1
    wm = cut(ys.min(), split, 'wordmark.png')
    tg = cut(ys[gaps[0] + 1], ys.max() + 1, 'tagline.png')
    # tagline placed relative to the wordmark, exactly as in the supplied lockup
    meta['wordmark'] = dict(w=wm['w'], h=wm['h'])
    meta['tagline'] = dict(w=tg['w'], h=tg['h'], dx=tg['x'] - wm['x'], dy=tg['y'] - wm['y'])


def main():
    wordmark()
    with open(os.path.join(ROOT, 'src', 'assets.json'), 'w') as f:
        json.dump(meta, f, indent=2)
    print(json.dumps(meta, indent=2))


if __name__ == '__main__':
    main()
