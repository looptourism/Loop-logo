#!/usr/bin/env python3
"""Original score and sound effects for the Loop sting, synthesised from
scratch (no samples, nothing licensed) and locked to src/timeline.json.

  score    D major at the timeline's tempo: a soft mallet line over a warm
           pad, D -> G -> A, resolving to D exactly as the logo is revealed.
  effects  soccer bounces, racket swish + hit, tennis bounces, the car
           lapping the loop and leaving: each on the frame the picture shows it.
  master   -16 LUFS integrated, true peak below -1.5 dBTP, 48 kHz stereo.

Writes public/audio/loop_sting.wav and the two stems to out/stems/.
"""
import json
import os

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
SR = 48000
DUR = T['duration']
N = int(SR * DUR)
BEAT = 60.0 / T['bpm']
rng = np.random.default_rng(7)          # seeded: the file is reproducible


def hz(note):                           # midi note -> Hz
    return 440.0 * 2 ** ((note - 69) / 12)


def place(buf, sig, at, pan=0.0, gain=1.0):
    """Mix a mono signal into the stereo buffer at time `at` (equal-power pan)."""
    i = int(round(at * SR))
    if i >= N:
        return
    sig = sig[:N - i]
    a = (pan + 1) * np.pi / 4
    buf[i:i + len(sig), 0] += sig * np.cos(a) * gain
    buf[i:i + len(sig), 1] += sig * np.sin(a) * gain


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lowpass(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x)


def bandpass(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def fade(x, a=0.004, r=0.02):
    x = x.copy()
    na, nr = int(a * SR), int(r * SR)
    x[:na] *= np.linspace(0, 1, na) ** 2
    x[-nr:] *= np.linspace(1, 0, nr) ** 2
    return x


# ------------------------------------------------------------------- score
def mallet(note, dur=1.6, bright=1.0):
    """A soft marimba-like tone: fundamental, a 4th-partial knock, short felt click."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(note)
    tone = np.sin(2 * np.pi * f * t) * env_exp(n, 0.42)
    tone += 0.28 * bright * np.sin(2 * np.pi * f * 3.93 * t) * env_exp(n, 0.07)
    tone += 0.10 * np.sin(2 * np.pi * f * 2 * t) * env_exp(n, 0.25)
    click = lowpass(rng.standard_normal(n), 2500) * env_exp(n, 0.004) * 0.25
    return fade(tone + click, 0.002, 0.05)


def pad(notes, dur, attack=0.5, release=0.9):
    """Warm, slow pad: detuned sines with a little 2nd harmonic."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for note in notes:
        f = hz(note)
        for det in (-0.25, 0.22):
            ph = rng.uniform(0, 2 * np.pi)
            out += np.sin(2 * np.pi * f * (1 + det / 100) * t + ph)
            out += 0.18 * np.sin(2 * np.pi * 2 * f * (1 + det / 100) * t + ph)
    e = np.minimum(1, t / attack) ** 1.5 * np.minimum(1, (dur - t) / release) ** 1.5
    return lowpass(out * e / len(notes), 1800)


def bass(note, dur=1.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(note)
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) * env_exp(n, 0.3)
    return fade(x * env_exp(n, 0.7), 0.012, 0.15)


def reverb(x, wet=0.22, decay=1.1):
    """Small plate: exponentially decaying noise, different per ear."""
    n = int(decay * 2.2 * SR)
    out = x.copy()
    for ch in range(2):
        ir = rng.standard_normal(n) * env_exp(n, decay / 4.5)
        ir = bandpass(ir, 300, 6000)
        ir[:int(0.012 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        out[:, ch] += wet * signal.fftconvolve(x[:, ch], ir)[:len(x)]
    return out


def score():
    s = np.zeros((N, 2))
    land = T['resolve']                         # the resolve lands as the finished logo is revealed
    hit, car = T['tennis']['hit'], 2.5            # chord changes: on the serve, then mid-lap
    # harmony: D (add9) -> G -> A sus -> D, changing with the action
    place(s, pad([50, 57, 64, 66], hit + 0.3, attack=0.6), 0.0, 0, 0.30)
    place(s, pad([55, 59, 62, 66], car - hit + 0.3, attack=0.35), hit, 0, 0.30)
    place(s, pad([57, 61, 62, 64], land - car + 0.25, attack=0.3), car, 0, 0.32)
    place(s, pad([50, 57, 62, 66, 69], DUR - land, attack=0.2, release=1.6), land, 0, 0.36)
    for note, at in ((38, T['soccer']['bounces'][0]), (43, hit), (45, car), (38, land)):
        place(s, bass(note, 1.6), at, 0, 0.42)
    # melody: sparse, on the beat, climbing toward the reveal
    line = [(0.5, 66), (1.0, 69), (1.5, 74), (2.0, 71), (2.5, 74), (3.0, 76), (3.5, 78)]
    for i, (at, note) in enumerate(line):
        place(s, mallet(note), at, pan=(-0.25 if i % 2 else 0.25), gain=0.30)
    # the resolve: a rolled D major chord, low to high, left ringing through the hold
    for i, note in enumerate((62, 66, 69, 74, 78)):
        place(s, mallet(note, 2.6, bright=0.8), land + i * 0.022, pan=-0.4 + 0.2 * i, gain=0.32)
    place(s, mallet(81, 2.0, bright=0.6), land + 1.0, pan=0.2, gain=0.14)   # one soft echo in the hold
    return reverb(s, 0.24)


# ----------------------------------------------------------------- effects
def car_pass():
    """Engine rising under power, a doppler drop as it passes, air rushing by."""
    go, out = T['car']['in'], T['car']['offLoop'] + 0.2   # doppler as it leaves the loop
    t0 = T['car']['in'] - 0.2
    dur = out - t0 + 0.9
    n = int(dur * SR)
    t = np.arange(n) / SR + t0
    k = np.clip((t - go) / (out - go), 0, 1.6)
    idle = 62.0
    f = idle + 150 * k ** 1.3                              # revs climb
    f *= 1 - 0.28 / (1 + np.exp(-(t - (out - 0.08)) / 0.035))   # doppler as it goes by
    ph = 2 * np.pi * np.cumsum(f) / SR
    eng = sum(np.sin(h * ph + i) / h ** 1.1 for i, h in enumerate((1, 2, 3, 4, 6, 8)))
    eng = np.tanh(1.6 * eng) * (0.55 + 0.45 * np.sin(ph / 2))
    eng = lowpass(eng, 2600)
    near = np.exp(-((t - (out - 0.1)) / 0.3) ** 2)         # loudest as it fills the frame
    rev = 0.10 * np.exp(-((t - (go - 0.12)) / 0.09) ** 2)  # a small blip of throttle before it goes
    amp = 0.34 * np.clip((t - t0) / 0.3, 0, 1) + rev + 0.6 * near   # present all the way round the lap
    amp *= np.clip((t0 + dur - t) / 0.5, 0, 1)
    air = bandpass(rng.standard_normal(n), 500, 5000) * near ** 1.5 * 0.55
    mono = fade(eng * amp + air, 0.02, 0.2)
    pan = np.clip(0.6 - 1.1 * k, -0.6, 0.6)                # top right of frame -> out bottom-left
    a = (pan + 1) * np.pi / 4
    buf = np.zeros((N, 2))
    i = int(t0 * SR)
    m = min(n, N - i)
    buf[i:i + m, 0] = mono[:m] * np.cos(a[:m])
    buf[i:i + m, 1] = mono[:m] * np.sin(a[:m])
    return buf * 0.5


def swish(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    sweep = signal.sosfilt(signal.butter(2, [1200, 7000], 'band', fs=SR, output='sos'), x)
    return fade(sweep * (t / dur) ** 3, 0.01, 0.012)


def racket_hit():
    """String-bed 'pock': a tight pitched thump plus the snap of the strings."""
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = 330 + 420 * np.exp(-t / 0.012)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.028)
    snap = bandpass(rng.standard_normal(n), 1800, 6500) * env_exp(n, 0.007)
    return fade(body + 0.7 * snap, 0.0005, 0.03)


def ball_bounce(f0, f1, tau, noise, dur=0.22, noise_fc=900):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.02)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, tau)
    slap = lowpass(rng.standard_normal(n), noise_fc) * env_exp(n, 0.012)
    return fade(body + noise * slap, 0.0008, 0.04)


def road_draw(dur):
    """The loop being laid down: a soft rising brush of air."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bandpass(rng.standard_normal(n), 700, 4200)
    shape = np.sin(np.pi * t / dur) ** 1.5
    return fade(x * shape, 0.03, 0.05)


def effects():
    e = car_pass()
    tn, so = T['tennis'], T['soccer']
    thud = lambda: ball_bounce(170, 82, 0.06, 0.55)
    for at, g in zip(so['bounces'], (0.62, 0.5, 0.3)):
        place(e, thud(), at, pan=-0.4, gain=g)
    place(e, swish(tn['hit'] - tn['swing']), tn['swing'], pan=0.45, gain=0.2)
    place(e, racket_hit(), tn['hit'], pan=0.4, gain=0.66)
    for at, g in zip(tn['bounces'], (0.4, 0.2)):
        place(e, ball_bounce(520, 260, 0.03, 0.5, 0.14, 2500), at, pan=0.25, gain=g)
    place(e, road_draw(T['car']['offLoop'] - T['car']['onLoop']), T['car']['onLoop'], pan=0.0, gain=0.05)
    dry = e.copy()
    return dry + 0.35 * (reverb(e, 0.5, 0.6) - e)


# ------------------------------------------------------------------ master
def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-12)


def main():
    music, fx = score(), effects()
    mix = music + fx
    # ends in digital silence; starts clean
    tail = int(0.35 * SR)
    for buf in (mix, music, fx):
        buf[-tail:] *= (np.linspace(1, 0, tail) ** 2)[:, None]
        buf[-int(0.012 * SR):] = 0
        buf[:int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))[:, None]
    meter = pyln.Meter(SR)
    target, ceiling = -16.0, -1.5
    gain = 10 ** ((target - meter.integrated_loudness(mix)) / 20)
    out = mix * gain
    tp = true_peak_db(out)
    if tp > ceiling:                                       # gentle peak control, then re-level
        thr = 10 ** ((ceiling - 1.0) / 20)
        out = np.where(np.abs(out) > thr, np.sign(out) * (thr + (1 - thr) * np.tanh((np.abs(out) - thr) / (1 - thr)) * 0.6), out)
        out *= 10 ** ((target - meter.integrated_loudness(out)) / 20)
    os.makedirs(os.path.join(ROOT, 'public', 'audio'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'out', 'stems'), exist_ok=True)
    sf.write(os.path.join(ROOT, 'public', 'audio', 'loop_sting.wav'), out, SR, subtype='PCM_24')
    sf.write(os.path.join(ROOT, 'out', 'stems', 'music.wav'), music * gain, SR, subtype='PCM_24')
    sf.write(os.path.join(ROOT, 'out', 'stems', 'effects.wav'), fx * gain, SR, subtype='PCM_24')
    print(f'integrated {meter.integrated_loudness(out):.2f} LUFS, true peak {true_peak_db(out):.2f} dBTP, '
          f'music {meter.integrated_loudness(music * gain):.1f} LUFS, effects {meter.integrated_loudness(fx * gain):.1f} LUFS')


if __name__ == '__main__':
    main()
