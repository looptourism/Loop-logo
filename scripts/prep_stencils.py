#!/usr/bin/env python3
"""Redraws nothing: converts the supplied props into flat, single-ink vector
stencils (auto-traced with potrace) so that the car, racket and balls share
one visual language with the LOOP wordmark, and stay crisp at any size.

  car     dark parts -> ink, bodywork -> mid tone, highlights left open
  racket  frame, grip and strings -> ink, string bed left open
  soccer  coloured panels -> ink
  tennis  the seam -> ink
Also measures the infinity loop inside the wordmark (two ring centres and
radius) so the animation can draw it. Output: public/assets/*.svg and
src/stencils.json.
"""
import json
import os

import numpy as np
import potrace
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets')
INK = '#1b1b1b'
meta = {}


def load(name):
    return np.asarray(Image.open(os.path.join(ROOT, name)).convert('RGBA')).astype(np.float64)


def path_d(mask, scale=1.0, turd=8, ox=0.0, oy=0.0):
    """potrace a boolean mask into an SVG path string (even-odd)."""
    out = []
    f = lambda p: f'{(p.x - ox) * scale:.2f} {(p.y - oy) * scale:.2f}'
    for curve in potrace.Bitmap(~mask).trace(turdsize=turd, alphamax=1.0, opttolerance=0.4):
        out.append('M' + f(curve.start_point))
        for s in curve.segments:
            out.append(f'L{f(s.c)}L{f(s.end_point)}' if s.is_corner else f'C{f(s.c1)} {f(s.c2)} {f(s.end_point)}')
        out.append('Z')
    return ''.join(out)


def up(f, k):
    return ndi.zoom(f, k, order=3)


def write_svg(name, w, h, body):
    with open(os.path.join(OUT, name), 'w') as fh:
        fh.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}">{body}</svg>')


def crop(im, pad=6):
    ys, xs = np.where(im[..., 3] > 40)
    return im[max(ys.min() - pad, 0):ys.max() + pad, max(xs.min() - pad, 0):xs.max() + pad]


def car():
    im = crop(load('IMG_f1 Background Removed.png'))
    k = 3
    a = up(im[..., 3] / 255, k) > 0.5
    rgb = np.stack([up(im[..., c], k) for c in range(3)], -1)
    lum = rgb @ [0.299, 0.587, 0.114] / 255
    sat = (rgb.max(-1) - rgb.min(-1)) / 255
    dark = a & (lum < 0.2)
    body = a & ~dark & ((sat > 0.25) | (lum < 0.62))        # the red bodywork and mid greys
    dark = ndi.binary_opening(dark, iterations=1)

    def close_small(m, area):                               # paint over lettering and specks
        holes = ndi.binary_fill_holes(m) & ~m
        lab, n = ndi.label(holes)
        sizes = ndi.sum(holes, lab, range(1, n + 1))
        return m | np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v < area])

    solid = close_small(body | dark, 2600)                  # sponsor logos are not reproduced
    dark = close_small(dark, 500)
    body = solid
    h, w = a.shape
    write_svg('car.svg', w / k, h / k,
              f'<path fill="{INK}" fill-opacity="0.56" fill-rule="evenodd" d="{path_d(body, 1 / k)}"/>'
              f'<path fill="{INK}" fill-rule="evenodd" d="{path_d(dark, 1 / k)}"/>')
    meta['car'] = dict(w=w / k, h=h / k)


def racket():
    im = crop(load('IMG_racket Background Removed.png'))
    a = im[..., 3] / 255 > 0.5
    lum = im[..., :3] @ [0.299, 0.587, 0.114] / 255
    sat = (im[..., :3].max(-1) - im[..., :3].min(-1)) / 255
    ink = a & ((lum < 0.5) | (sat > 0.35))                  # outline, orange frame, grip wrap lines
    strings = a & (lum < 0.82) & ~ink                       # the grey string lines
    strings = ndi.binary_dilation(strings, iterations=1)
    h, w = a.shape
    write_svg('racket.svg', w, h, f'<path fill="{INK}" fill-rule="evenodd" d="{path_d(ink | strings, turd=12)}"/>')
    ys, xs = np.where(im[..., 3] > 40)
    full = load('IMG_racket Background Removed.png')
    fy, fx = np.where(full[..., 3] > 40)
    ox, oy = max(fx.min() - 6, 0), max(fy.min() - 6, 0)
    meta['racket'] = dict(w=w, h=h, grip=[1178 - int(ox), 1066 - int(oy)], strings=[392 - int(ox), 425 - int(oy)])


def ball(src, dst, key, pattern):
    im = crop(load(src), pad=0)
    a = im[..., 3] / 255 > 0.5
    ys, xs = np.where(a)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    r = min(xs.max() - xs.min(), ys.max() - ys.min()) / 2
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    inside = (xx - cx) ** 2 + (yy - cy) ** 2 < (r * 0.93) ** 2
    k = 2 if r > 200 else 4
    pat = pattern(im) & inside
    lab, n = ndi.label(pat)
    sizes = ndi.sum(pat, lab, range(1, n + 1))
    pat = np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v > 0.004 * np.pi * r * r])   # drop specks
    m = up(pat.astype(float), k) > 0.5
    # unit ball: radius 100 centred on 100,100; outline drawn as a true circle
    s = 100 / r
    d = path_d(m, s / k, turd=20, ox=(cx - r) * k, oy=(cy - r) * k)
    write_svg(dst, 200, 200,
              f'<circle cx="100" cy="100" r="96" fill="#FFEEC0" stroke="{INK}" stroke-width="8"/>'
              f'<path fill="{INK}" fill-rule="evenodd" d="{d}"/>')


def soccer_pattern(im):
    sat = (im[..., :3].max(-1) - im[..., :3].min(-1)) / 255
    return ndi.binary_opening(sat > 0.45, iterations=2)


def tennis_pattern(im):
    lum = im[..., :3] @ [0.299, 0.587, 0.114] / 255
    sat = (im[..., :3].max(-1) - im[..., :3].min(-1)) / 255
    seam = (sat < 0.3) & (lum > 0.7)                        # the white seam only
    seam = ndi.binary_opening(seam, iterations=1)
    lab, n = ndi.label(seam)
    sizes = ndi.sum(seam, lab, range(1, n + 1))
    seam = lab == (1 + int(np.argmax(sizes)))               # the seam itself, not the highlight
    return ndi.binary_dilation(seam, iterations=3)


def loop_geometry():
    """Fit the two rings of the infinity sign in the wordmark."""
    a = np.asarray(Image.open(os.path.join(OUT, 'wordmark.png')))[..., 3] > 128
    h, w = a.shape
    rings = []
    for x0, x1, side in ((250, 560, 'L'), (1050, 1330, 'R')):
        pts_o, pts_i = [], []
        for y in range(30, 470, 6):
            xs = np.where(a[y, x0:x1])[0]
            if len(xs) < 5:
                continue
            xs = xs + x0
            if side == 'L':
                o = xs.min(); run = xs[xs < o + 120]; i = o + np.argmax(~a[y, o:o + 120]) if (~a[y, o:o + 120]).any() else None
            else:
                o = xs.max(); seg = a[y, o - 120:o + 1][::-1]; i = o - np.argmax(~seg) if (~seg).any() else None
            if i is not None and 30 < abs(i - o) < 110:
                pts_o.append((o, y)); pts_i.append((i, y))
        mid = (np.array(pts_o) + np.array(pts_i)) / 2.0
        A = np.c_[2 * mid, np.ones(len(mid))]
        sol = np.linalg.lstsq(A, (mid ** 2).sum(1), rcond=None)[0]
        cx, cy = sol[0], sol[1]
        r = np.sqrt(sol[2] + cx * cx + cy * cy)
        thick = float(np.median(np.abs(np.array(pts_o)[:, 0] - np.array(pts_i)[:, 0])))
        rings.append(dict(cx=float(cx), cy=float(cy), r=float(r), thick=thick))
    meta['loop'] = dict(left=rings[0], right=rings[1])


car(); racket()
ball('Img_ball Background Removed.png', 'soccer.svg', 'soccer', soccer_pattern)
ball('IMG_tennis Background Removed.png', 'tennis.svg', 'tennis', tennis_pattern)
loop_geometry()
json.dump(meta, open(os.path.join(ROOT, 'src', 'stencils.json'), 'w'), indent=2)
print(json.dumps(meta))
