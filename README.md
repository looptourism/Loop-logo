# Loop Travel & Tourism — 7-second logo sting

Animated logo sting for Instagram ads, built in code with [Remotion](https://www.remotion.dev) 4.

| File | Size | Use |
|---|---|---|
| `out/loop_16x9.mp4` | 1920×1080 | landscape feed, YouTube |
| `out/loop_9x16.mp4` | 1080×1920 | Reels, Stories |
| `out/loop_1x1.mp4` | 1080×1080 | square feed |
| `out/frames/` | 45 PNG stills | one per story beat, per format |
| `out/stems/` | `music.wav`, `effects.wav` | the two halves of the soundtrack |

All three are 7.00 s, 60 fps, H.264 (yuv420p, BT.709) with AAC stereo 48 kHz. Each format has its own layout; none is a crop of another.

## The idea

**Sport builds the logo.** Loop sells travel to sport, and its mark is an infinity loop holding two globes, so the film lets the props become the mark instead of moving around it:

| Time | What happens |
|---|---|
| 0.0–1.8 s | A football drops in, bounces on the beat with a little squash, and rolls to rest |
| 0.9–2.3 s | A tennis ball is tossed up; an oversized racket sweeps through the corner of the frame and serves it. It bounces and rolls to rest beside the football |
| 2.15–2.95 s | The infinity loop of the wordmark is drawn around the two balls like a road being laid, lane markings and all |
| 2.96–3.86 s | The car passes close to the lens, motion-blurred. Behind it the balls have become the two globes and the full LOOP wordmark is there. The camera pulls back as it goes |
| 3.9–4.55 s | "Travel & Tourism" rises in |
| 4.55–7.0 s | Hold on the lockup (2.45 s), with a slow 1.5 % push that comes to rest on the last frame |

Every prop is redrawn in the wordmark's own ink on cream `#FFEEC0`, so the car, racket and balls read as one family with the logo instead of four unrelated pictures. No glow, no particles, no gradient cards.

This replaces the first version, which followed the original shot list literally (props scattered around the logo, each doing its own move). **It departs from that brief on purpose** in three places, so say if you want any of them back: the props do not start in "logo positions" (there was no reference for those anyway); they are single-colour, not full colour; and the road picture is not used, because the loop itself is now the road.

**Sound** is original and synthesised from scratch by `scripts/make_audio.py` (nothing sampled or licensed): a short D-major mallet-and-pad score at 120 BPM that resolves at 4.0 s as the logo is revealed, with ball bounces, the racket hit, the loop being drawn and the car pass placed on the frames where they happen.

## Your source files

| Asset | State | What I did |
|---|---|---|
| `IMG_loop.PNG` | **Not transparent**: a screenshot on a white card with black bars. Slightly soft. | Keyed the ink off the white. "Travel & Tourism" is not a separate file but is inside this one, so I used your own lettering, in its original position. A vector logo (SVG/AI/PDF) would be sharper. |
| `IMG_racket…png` | **Stock watermarks in the art** ("alamy"). An unlicensed preview. | Traced to a one-colour stencil. The watermarks do not survive the tracing, but the drawing is still derived from that stock image: license it or swap it before the ad runs. |
| `Img_ball…png` | **"dreamstime" watermark** across the middle. | Same treatment, same caveat. |
| `IMG_f1…png` | A **Ferrari F1 car with sponsor logos**; only 550 px. | Traced to a two-tone stencil with the sponsor lettering painted out. The silhouette is still recognisably that car. |
| `IMG_tennis…png` | Fine. | Traced; only its seam is kept. |
| `IMG_road…png` | 498×228 px, ragged, cut off flat at one end. | **Not used** in this version. |

All tracing is automatic (potrace) from your files; nothing was drawn by hand. The originals are untouched in the repo root.

## What was tested

Automatic checks (`npm run check`), all passing for all three formats:

- the football starts out of frame and comes to rest exactly centred in the left ring; the tennis ball likewise in the right ring
- the serve is struck fully inside the frame, and the ball is tossed in from below it
- the beats are staggered: football, serve, loop, car
- the car is out of frame at the moments it appears and is removed
- the lockup ends exactly centred, and the full lockup with tagline holds at least 1.5 s
- no pops: nothing jumps between adjacent tenth-of-a-frame samples
- the hold is still enough to need no motion blur

Measured on the delivered files:

| File | Picture | Frames | Duration | Loudness | True peak |
|---|---|---|---|---|---|
| `loop_16x9.mp4` | 1920×1080, 60 fps | 420 | 7.000 s | −16.0 LUFS | −2.2 dBTP |
| `loop_9x16.mp4` | 1080×1920, 60 fps | 420 | 7.000 s | −16.0 LUFS | −2.2 dBTP |
| `loop_1x1.mp4` | 1080×1080, 60 fps | 420 | 7.000 s | −16.0 LUFS | −2.2 dBTP |

Checked by eye: all 45 stills in `out/frames/` (15 beats × 3 formats). They are the exact frames that were encoded, saved losslessly before compression, except `01_ball_drops_in`, which is pulled from the finished MP4. The cream is exactly `#FFEEC0` on every one. Two things the eye check caught and I fixed before the final render: the racket swing and the car pass were first so fast that motion blur turned them into unreadable ghosts, so both were slowed and given more blur samples.

**Not tested:** I cannot hear audio, so the sound was checked by measurement only (loudness, peak, event timing), not by listening. Please listen once before publishing. The films were not test-uploaded to Instagram.

## How the cinetic skill was used

`npx skills add Leonxlnx/cinetic` installed without problems. The skill itself (19 MB of third-party files in `.agents/`) is not committed; `skills-lock.json` pins the version, and the same command restores it.

- **Followed:** its logo-sting shape (build the mark from its own parts, a reveal on the beat, lockup readable for the last 1.5 s and still gently moving, −16 LUFS, tail to digital silence), one timeline file driving picture and sound, no linear motion, everything a pure function of time, exact sub-frame motion blur averaged outside the browser, lossless PNG frames, BT.709 tagging, audio muxed separately so it sits on frame 0, a separate layout per aspect ratio.
- **Overridden by the brief:** it bans cream backgrounds and generated music. You asked for cream `#FFEEC0` and an original score.
- **Not used:** its scaffolding, scene bank and stock-music and stock-effects fetchers, which are for multi-scene product films.

## Rebuild

Needs Node 22+, Python 3.11+ (`pip install numpy scipy pillow soundfile pyloudnorm potracer`) and ffmpeg.

```bash
npm install
npm run assets    # originals in the repo root -> public/assets/
npm run audio     # -> public/audio/loop_sting.wav, out/stems/
npm run check     # type-check + choreography checks
npm run render    # -> out/*.mp4 and out/frames/   (about 20 minutes)
npm run studio    # live preview (sharp, no motion blur)
```

Where things live: timing in `src/timeline.json` (shared by picture and sound), per-format framing in `src/layouts.ts`, all motion in `src/motion.ts`, the picture in `src/Sting.tsx`.
