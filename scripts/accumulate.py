#!/usr/bin/env python3
"""Average rendered sub-frames into the final picture (exact motion blur).

  accumulate.py <subframe dir> <plan.json> <out.mp4> [--stills DIR PREFIX name:frame ...]

Each output frame is the mean of its group of sub-frames, taken in linear
light and rounded once. A frame with a single sample passes through
untouched, so still frames are bit-identical to what the browser drew.
Frames are piped straight to x264 (BT.709, yuv420p, CRF 14).
"""
import glob
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

sub_dir, plan_path, out = sys.argv[1:4]
stills = {}
if '--stills' in sys.argv:
    i = sys.argv.index('--stills')
    still_dir, prefix = sys.argv[i + 1], sys.argv[i + 2]
    os.makedirs(still_dir, exist_ok=True)
    stills = {int(a.split(':')[1]): a.split(':')[0] for a in sys.argv[i + 3:]}

plan = json.load(open(plan_path))
files = sorted(glob.glob(os.path.join(sub_dir, '*.png')))
assert len(files) == sum(plan['groups']), (len(files), sum(plan['groups']))

v = np.arange(256) / 255.0
TO_LIN = np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
lin_grid = np.linspace(0, 1, 4096)
TO_SRGB = np.where(lin_grid <= 0.0031308, lin_grid * 12.92, 1.055 * lin_grid ** (1 / 2.4) - 0.055) * 255

enc = subprocess.Popen([
    'ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f"{plan['w']}x{plan['h']}",
    '-r', str(plan['fps']), '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', out], stdin=subprocess.PIPE)

pos = 0
for f, n in enumerate(plan['groups']):
    group = files[pos:pos + n]
    pos += n
    first = np.asarray(Image.open(group[0]).convert('RGB'))
    if n == 1:
        frame = first
    else:
        acc = TO_LIN[first]
        for path in group[1:]:
            acc = acc + TO_LIN[np.asarray(Image.open(path).convert('RGB'))]
        mean = acc / n
        frame = np.rint(np.interp(mean, lin_grid, TO_SRGB)).astype(np.uint8)
        same = (np.ptp(np.stack([first, np.asarray(Image.open(group[-1]).convert('RGB'))]), axis=0) == 0)
        frame = np.where(same & (np.abs(frame.astype(int) - first) <= 1), first, frame)  # untouched pixels stay exact
    enc.stdin.write(frame.tobytes())
    if f in stills:
        Image.fromarray(frame).save(os.path.join(still_dir, f'{prefix}_{stills[f]}.png'), optimize=True)
enc.stdin.close()
assert enc.wait() == 0
print(f'{out}: {len(plan["groups"])} frames')
