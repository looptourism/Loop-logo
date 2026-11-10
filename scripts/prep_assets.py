#!/usr/bin/env python3
"""Prepare the supplied logo PNGs for the film.

Reads the untouched originals from the repo root and writes film-ready
files to public/assets/ plus src/assets.json (sizes and anchor points).

What it does, and nothing more:
  wordmark/tagline  IMG_loop.PNG is an opaque screenshot (black bars, white
                    card). The dark ink is keyed off the white card into
                    alpha and split into the LOOP wordmark and the tagline.
  car, balls        trimmed to their bounding box.
  racket            trimmed; pin-holes the background remover punched in
                    the string bed are filled back to white.
  road              498x228 only. Pin-holes in the lane dashes are filled,
                    the art is re-sampled 4x with re-sharpened edges, and
                    the near end (cut flat in the asset) is continued along
                    its own vanishing lines so it can leave the frame.
Watermarks on the racket and soccer ball are NOT removed.
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

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


# ------------------------------------------------------------ simple trims
def trim(src, dst, key, extra=None, scale=1.0):
    """Crop to the art; optionally pre-shrink (Lanczos) art that is shown far
    below its native size, so the renderer never has to minify by more than 2x."""
    im = load(src)
    x0, y0, x1, y1 = bbox(im[..., 3])
    im = im[y0:y1, x0:x1]
    if extra:
        im = extra(im)
    if scale != 1.0:
        pil = Image.fromarray(np.clip(np.rint(im), 0, 255).astype(np.uint8), 'RGBA')
        # premultiplied resize keeps edge colours clean
        pm = np.asarray(pil).astype(np.float64)
        pm[..., :3] *= pm[..., 3:4] / 255.0
        size = (round(pil.width * scale), round(pil.height * scale))
        chans = [np.asarray(Image.fromarray(pm[..., c].astype(np.float32), 'F').resize(size, Image.LANCZOS))
                 for c in range(4)]
        im = np.stack(chans, axis=-1).astype(np.float64)
        al = np.clip(im[..., 3:4], 1e-6, 255)
        im[..., :3] = np.clip(im[..., :3] / (al / 255.0), 0, 255)
        im[..., 3] = np.clip(im[..., 3], 0, 255)
    save(dst, im)
    meta[key] = dict(w=int(im.shape[1]), h=int(im.shape[0]))
    return im, (x0, y0)


def fill_string_holes(im):
    """Background removal left pin-holes inside the string bed. Fill every
    enclosed transparent pocket smaller than the throat opening with white."""
    solid = im[..., 3] > 128
    holes = ndi.binary_fill_holes(solid) & ~solid
    lab, n = ndi.label(holes)
    sizes = ndi.sum(holes, lab, range(1, n + 1))
    small = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s < 4000])
    soft = ndi.gaussian_filter(small.astype(float), 1.0) > 0.15
    soft &= ndi.binary_fill_holes(solid)
    out = im.copy()
    a = out[..., 3:4] / 255.0
    white = np.array([255.0, 255.0, 251.0])
    out[soft, :3] = (out[..., :3] * a + white * (1 - a))[soft]
    out[soft, 3] = 255
    return out


def car_shadow(im):
    """Soft contact shadow baked from the car's own silhouette."""
    a = im[..., 3] / 255.0
    h, w = a.shape
    pad = 60
    big = np.zeros((h + 2 * pad, w + 2 * pad))
    big[pad:pad + h, pad:pad + w] = a
    # weight toward the underside so the wing tops do not cast upward
    ramp = np.clip((np.arange(big.shape[0]) - pad) / h, 0, 1)[:, None] ** 0.8
    sh = ndi.gaussian_filter(big * ramp, 13)
    rgba = np.zeros(sh.shape + (4,))
    rgba[..., :3] = (38, 28, 14)
    rgba[..., 3] = np.clip(sh * 1.15, 0, 1) * 255 * 0.5
    save('car_shadow.png', rgba)
    meta['car']['shadowPad'] = pad


# -------------------------------------------------------------------- road
# The road asset is 498x228 with ragged, half-keyed edges, far too small to
# fill a 1080p frame. It is auto-traced to vector outlines (potrace) so its
# edges stay clean at any size, and its near end, which the asset cuts off
# flat, is continued along the asset's own edge lines so that it can run
# out of frame. Canvas is in asset pixels.
ROAD_X0, ROAD_X1 = -640, 500
ROAD_Y0, ROAD_Y1 = 0, 560
ROAD_UP = 1                      # bicubic upsample before tracing (sub-pixel edges)
GRAY_HEX, GRAY, WHITE = '#636363', 99.0, 255.0


def trace(mask):
    """potrace a boolean mask -> shapely geometry in asset pixel coordinates."""
    import potrace
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
    polys = []
    for curve in potrace.Bitmap(~mask).trace(turdsize=6, alphamax=1.1, opttolerance=0.6):
        P = lambda q: np.array([q.x, q.y], float)
        pts = [P(curve.start_point)]
        for seg in curve.segments:
            p0 = pts[-1]
            if seg.is_corner:
                pts += [P(seg.c), P(seg.end_point)]
            else:
                c1, c2, e = P(seg.c1), P(seg.c2), P(seg.end_point)
                for t in np.linspace(0, 1, 13)[1:]:
                    pts.append((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t ** 2 * c2 + t ** 3 * e)
        ring = np.array(pts) / ROAD_UP - 0.5 + 0.5 / ROAD_UP
        if len(ring) >= 4:
            polys.append(Polygon(ring).buffer(0))
    # even-odd combine (holes are traced as their own curves)
    polys.sort(key=lambda g: -g.area)
    out = None
    for g in polys:
        out = g if out is None else out.symmetric_difference(g)
    out = out.buffer(0)
    want = mask.sum() / ROAD_UP ** 2
    assert abs(out.area - want) < 0.03 * want + 20, (out.area, want)   # trace must match the mask
    return out


def road():
    from shapely import affinity
    from shapely.geometry import box, LineString, Polygon
    from shapely.ops import unary_union
    from shapely import transform

    im = load('IMG_road Background Removed.png')
    a = im[..., 3] / 255.0
    lum = im[..., :3].mean(axis=2)
    filled = ndi.binary_fill_holes(a > 0.5)             # also fills pin-holes in the dashes
    hole = filled & ~(a > 0.5)
    w = np.clip((lum - GRAY) / (WHITE - GRAY), 0, 1) * a
    w = np.where(ndi.binary_dilation(hole, iterations=2) & filled, 1.0, w)
    a = np.where(filled, 1.0, a)

    def up(f):
        return ndi.zoom(np.pad(f, 4), ROAD_UP, order=3)[4 * ROAD_UP:-4 * ROAD_UP, 4 * ROAD_UP:-4 * ROAD_UP]

    road_g = trace(up(a) > 0.5)
    white_g = trace((up(w) > 0.5) & (up(a) > 0.5)).intersection(road_g)

    cut = 195.0                                         # last clean row above the ragged cut

    def crossings(g, y):
        hit = g.intersection(LineString([(-10, y), (600, y)]))
        return sorted((seg.bounds[0], seg.bounds[2]) for seg in getattr(hit, 'geoms', [hit]) if seg.length > 0.5)

    # Continue the near end. Both outer edges are followed along their tangent
    # at the cut; where those two lines meet is the vanishing point, and every
    # painted line crossing the cut is carried on along its ray from that point.
    ys = np.arange(150, cut + 0.01, 1.0)
    E = np.array([(crossings(road_g, y)[0][0], crossings(road_g, y)[-1][1]) for y in ys])
    (sl, il), (sr, ir) = np.polyfit(ys, E[:, 0], 1), np.polyfit(ys, E[:, 1], 1)
    xl, xr = sl * cut + il, sr * cut + ir
    vy = cut - (xr - xl) / (sr - sl)
    vx = xl + sl * (vy - cut)
    far = ROAD_Y1 + 40

    def ray(x):                                         # point on the ray through (x, cut), at y = far
        return (vx + (x - vx) * (far - vy) / (cut - vy), far)

    def quad(x0, x1):
        return Polygon([(x0, cut - 0.3), (x1, cut - 0.3), ray(x1), ray(x0)])

    keep = box(-2000, -50, 2000, cut)
    road_parts = [road_g.intersection(keep), quad(xl, xr)]
    white_parts = [white_g.intersection(keep)] + [quad(a0, a1) for a0, a1 in crossings(white_g, cut - 0.5)]

    # Lane dashes: the gap between the last two fixes the repeat ratio seen from
    # the vanishing point; the last dash is repeated outward at that ratio.
    dashes = [g for g in white_g.geoms
              if g.bounds[3] < cut - 2 and g.bounds[1] > 80 and g.area > 30
              and crossings(road_g, g.centroid.y)[0][0] + 20 < g.centroid.x < crossings(road_g, g.centroid.y)[-1][1] - 20]
    dashes.sort(key=lambda g: g.centroid.y)
    d1, d2 = dashes[-2], dashes[-1]
    k = (d2.bounds[1] - vy) / (d1.bounds[1] - vy)
    n = 1
    while vy + k ** n * (d2.bounds[1] - vy) < far:
        white_parts.append(affinity.scale(d2, k ** n, k ** n, origin=(vx, vy)))
        n += 1

    canvas = box(ROAD_X0, ROAD_Y0, ROAD_X1, ROAD_Y1)
    road_e = unary_union(road_parts).buffer(0).intersection(canvas)
    white_e = unary_union(white_parts).buffer(0).intersection(road_e)

    def d(g):
        out = []
        for poly in getattr(g, 'geoms', [g]):
            for ring in [poly.exterior, *poly.interiors]:
                c = np.array(ring.coords)
                out.append('M' + 'L'.join(f'{x - ROAD_X0:.2f} {y - ROAD_Y0:.2f}' for x, y in c) + 'Z')
        return ''.join(out)

    W, H = ROAD_X1 - ROAD_X0, ROAD_Y1 - ROAD_Y0
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="none">'
           f'<path fill="{GRAY_HEX}" fill-rule="evenodd" d="{d(road_e.simplify(0.05))}"/>'
           f'<path fill="#ffffff" fill-rule="evenodd" d="{d(white_e.simplify(0.05))}"/></svg>')
    with open(os.path.join(OUT, 'road.svg'), 'w') as f:
        f.write(svg)

    meta['road'] = dict(
        w=W, h=H, x0=ROAD_X0, y0=ROAD_Y0, tip=[235.0, 5.0], assetCut=cut,
        vp=[float(vx), float(vy)],
        # the near straight, measured at the cut: its centre and half width
        cutCentre=float((xl + xr) / 2), cutHalfWidth=float((xr - xl) / 2),
        dashRatio=float(k))


def main():
    wordmark()
    car, _ = trim('IMG_f1 Background Removed.png', 'car.png', 'car')
    car_shadow(car)
    RS = 0.5
    _, (rx, ry) = trim('IMG_racket Background Removed.png', 'racket.png', 'racket', fill_string_holes, RS)
    # anchors measured on the original 1300x1359 art
    meta['racket']['grip'] = [(1178 - int(rx)) * RS, (1066 - int(ry)) * RS]      # where a hand would hold it
    meta['racket']['strings'] = [(392 - int(rx)) * RS, (425 - int(ry)) * RS]     # centre of the string bed
    trim('IMG_tennis Background Removed.png', 'tennis.png', 'tennis', None, 0.75)
    trim('Img_ball Background Removed.png', 'soccer.png', 'soccer', None, 0.6)
    road()
    with open(os.path.join(ROOT, 'src', 'assets.json'), 'w') as f:
        json.dump(meta, f, indent=2)
    print(json.dumps(meta, indent=2))


if __name__ == '__main__':
    main()
