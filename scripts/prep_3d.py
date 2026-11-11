#!/usr/bin/env python3
"""Builds everything the 3D film needs from the logo art.

  textures  sphere maps (equirectangular) for the football, the tennis ball
            and the two globes. The balls are generated; the globes are the
            wordmark's own continent drawings wrapped onto spheres.
  shapes    vector outlines of the letters L and P, traced from the wordmark,
            for extrusion.
Writes public/assets/tex_*.png and src/shapes.json.
"""
import json
import os

import numpy as np
import potrace
from PIL import Image
from scipy import ndimage as ndi
from shapely.geometry import Polygon

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets')
S = json.load(open(os.path.join(ROOT, 'src', 'stencils.json')))
W, H = 2048, 1024

# direction of every texel, in three.js SphereGeometry's convention
v, u = np.mgrid[0:H, 0:W]
theta = (v + 0.5) / H * np.pi                  # 0 at the north pole (row 0)
phi = (u + 0.5) / W * 2 * np.pi
D = np.stack([-np.cos(phi) * np.sin(theta), np.cos(theta), np.sin(phi) * np.sin(theta)], -1)


def save(name, rgb):
    Image.fromarray(np.clip(np.rint(rgb), 0, 255).astype(np.uint8), 'RGB').save(os.path.join(OUT, name), optimize=True)


def hex3(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)


def mix(a, b, k):
    return a + (b - a) * k[..., None]


def smooth(d, edge, w):
    """1 inside (d < edge), 0 outside, with an antialiased edge of width w."""
    return np.clip((edge - d) / w + 0.5, 0, 1)


# ---------------------------------------------------------------- football
def football():
    g = (1 + 5 ** 0.5) / 2
    V = np.array([[0, s1, s2 * g] for s1 in (1, -1) for s2 in (1, -1)]
                 + [[s1, s2 * g, 0] for s1 in (1, -1) for s2 in (1, -1)]
                 + [[s2 * g, 0, s1] for s1 in (1, -1) for s2 in (1, -1)], float)
    V /= np.linalg.norm(V[0])
    dots = D @ V.T
    near = dots.argmax(-1)
    ang = np.arccos(np.clip(dots.max(-1), -1, 1))
    edge_len = np.arccos(np.clip(np.sort(V @ V.T, axis=1)[:, -2].max(), -1, 1))   # icosahedron edge angle
    R = edge_len / 3                                   # pentagon corner distance
    # angle around the nearest vertex, measured from one of its neighbours
    nb = np.array([np.argsort(-(V @ V[i]))[1] for i in range(12)])
    c = V[near]
    ref = V[nb][near]
    e1 = ref - (ref * c).sum(-1, keepdims=True) * c
    e1 /= np.linalg.norm(e1, axis=-1, keepdims=True)
    e2 = np.cross(c, e1)
    p = D - (D * c).sum(-1, keepdims=True) * c
    az = np.arctan2((p * e2).sum(-1), (p * e1).sum(-1))
    seg = 2 * np.pi / 5
    local = (az + seg / 2) % seg - seg / 2             # corners point at the neighbours
    rad = R * np.cos(np.pi / 5) / np.cos(np.abs(np.abs(local) - np.pi / 5))
    penta = smooth(ang, rad, 0.006)
    # seams between the white panels: the middle of every icosahedron edge
    seam = np.zeros((H, W))
    for i in range(12):
        for j in range(i + 1, 12):
            if V[i] @ V[j] > 0.4:
                n = np.cross(V[i], V[j]); n /= np.linalg.norm(n)
                dist = np.abs(D @ n)
                between = ((D @ V[i]) > np.cos(edge_len)) & ((D @ V[j]) > np.cos(edge_len))
                seam = np.maximum(seam, smooth(dist, 0.008, 0.006) * between)
    white, black = hex3('#F7F4EA'), hex3('#1B1B1B')
    rgb = mix(np.broadcast_to(white, D.shape).copy(), black, np.maximum(penta, seam * 0.55))
    save('tex_soccer.png', rgb)


# ------------------------------------------------------------------ tennis
def tennis():
    t = np.linspace(0, 2 * np.pi, 720, endpoint=False)
    a, b, c = 0.75, 0.25, 3 ** 0.5 / 2
    C = np.stack([a * np.cos(t) + b * np.cos(3 * t), a * np.sin(t) - b * np.sin(3 * t), c * np.sin(2 * t)], -1)
    best = np.full((H, W), -1.0)
    for i in range(0, len(C), 60):
        best = np.maximum(best, (D @ C[i:i + 60].T).max(-1))
    dist = np.arccos(np.clip(best, -1, 1))
    seam = smooth(dist, 0.045, 0.012)
    rng = np.random.default_rng(3)
    fuzz = ndi.gaussian_filter(rng.standard_normal((H, W)), 1.2) * 5        # felt
    felt = hex3('#CFE23F') + fuzz[..., None]
    save('tex_tennis.png', mix(felt, hex3('#FBFAF0'), seam))


# ------------------------------------------------------------------ globes
def globe(side, name):
    a = np.asarray(Image.open(os.path.join(OUT, 'wordmark.png')))[..., 3] / 255.0
    ring = S['loop'][side]
    cx, cy = ring['cx'], (S['loop']['left']['cy'] + S['loop']['right']['cy']) / 2
    rg = ring['r'] - ring['thick'] / 2 - 2             # the disc inside the ring
    # seen from straight above: screen right = +x, screen down = +z; both hemispheres carry the drawing
    px = cx + D[..., 0] * rg
    py = cy + D[..., 2] * rg
    land = ndi.map_coordinates(ndi.gaussian_filter(a, 0.8), [py, px], order=1, mode='nearest')
    r = np.hypot(D[..., 0], D[..., 2])
    land = np.clip((land - 0.5) * 6 + 0.5, 0, 1) * smooth(r, 0.93, 0.02)    # keep the ring itself out
    ocean, green = hex3('#2F7FD0'), hex3('#63BE6A')
    save(name, mix(np.broadcast_to(ocean, D.shape).copy(), green, land))


# ------------------------------------------------------------------ letters
def letters():
    a = np.asarray(Image.open(os.path.join(OUT, 'wordmark.png')))[..., 3] > 128
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    L, R = S['loop']['left'], S['loop']['right']
    outer = L['r'] + L['thick'] / 2 + 3
    masks = {
        'L': a & (xx < 362) & (np.hypot(xx - L['cx'], yy - L['cy']) > outer),
        'P': a & (xx > R['cx'] + R['r'] + R['thick'] / 2 + 6),
    }
    out = {}
    for key, m in masks.items():
        lab, n = ndi.label(m)
        m = lab == (1 + int(np.argmax(ndi.sum(m, lab, range(1, n + 1)))))       # the letter, not specks
        polys = []
        for curve in potrace.Bitmap(~m).trace(turdsize=20, alphamax=1.0, opttolerance=0.5):
            pts = [(curve.start_point.x, curve.start_point.y)]
            for s in curve.segments:
                p0 = np.array(pts[-1])
                if s.is_corner:
                    pts += [(s.c.x, s.c.y), (s.end_point.x, s.end_point.y)]
                else:
                    c1, c2, e = (np.array([q.x, q.y]) for q in (s.c1, s.c2, s.end_point))
                    for t in np.linspace(0, 1, 9)[1:]:
                        pts.append(tuple((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t ** 2 * c2 + t ** 3 * e))
            polys.append(Polygon(pts).buffer(0))
        polys.sort(key=lambda g: -g.area)
        shape = polys[0]
        for g in polys[1:]:
            shape = shape.symmetric_difference(g)
        shape = shape.buffer(0).simplify(0.5)
        geoms = getattr(shape, 'geoms', [shape])
        out[key] = [dict(outer=[[round(x, 2), round(y, 2)] for x, y in g.exterior.coords],
                         holes=[[[round(x, 2), round(y, 2)] for x, y in r.coords] for r in g.interiors]) for g in geoms]
    json.dump(out, open(os.path.join(ROOT, 'src', 'shapes.json'), 'w'))
    print({k: [(len(p['outer']), len(p['holes'])) for p in v] for k, v in out.items()})


football(); tennis(); globe('left', 'tex_globe_left.png'); globe('right', 'tex_globe_right.png'); letters()
