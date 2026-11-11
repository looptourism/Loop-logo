# Loop Travel & Tourism — 7-second logo sting

Animated logo sting for Instagram ads, built in code with [Remotion](https://www.remotion.dev) 4.

| File | Size | Use |
|---|---|---|
| `out/loop_16x9.mp4` | 1920×1080 | landscape feed, YouTube |
| `out/loop_9x16.mp4` | 1080×1920 | Reels, Stories |
| `out/loop_1x1.mp4` | 1080×1080 | square feed |
| `out/frames/` | 42 PNG stills | one per story beat, per format |
| `out/stems/` | `music.wav`, `effects.wav` | the two halves of the soundtrack |

All three are 7.00 s, 60 fps, H.264 (yuv420p, BT.709) with AAC stereo 48 kHz. Each format has its own layout; none is a crop of another.

## The idea

**Sport builds the logo, in 3D.** The lockup lies flat on a cream floor like a race track, and the film is one continuous camera move that ends looking straight down at the finished logo:

| Time | What happens |
|---|---|
| 0.0–1.8 s | A football drops in, bounces on the beat with a little squash, and rolls to rest |
| 0.55–1.95 s | A tennis ball drops in; an oversized racket sweeps through and serves it. It bounces and rolls to rest beside the football |
| 1.85–3.9 s | A red racing car arrives, laps the infinity loop once and lays the road down behind it, lane markings and all, then sprints away |
| 3.25–4.05 s | The camera rises to look straight down |
| 3.45–4.15 s | The two balls spin and become the two globes of the logo; the letters L and P rise out of the floor |
| 4.15–4.8 s | "Travel & Tourism" comes in |
| 4.8–7.0 s | Hold on the lockup (2.2 s), with a slow push that comes to rest on the last frame |

Real geometry, real light and shadow (Three.js inside Remotion): the balls, globes, track, letters, car and racket are all 3D objects. Colour comes from the objects themselves: a classic black-and-white football, an optic-yellow tennis ball, blue-and-green globes, a red car, an orange racket, on cream `#FFEEC0` with the wordmark in its own dark ink.

**What I designed myself, beyond your files:** the football and tennis ball (generated), the car and the racket (built from simple solids, toy-like on purpose), the lane markings, the lighting, and the camera move. **What is still yours:** the continents on the globes are your logo's own drawings wrapped onto spheres, the L and P are traced from your wordmark, the loop follows your logo's measured rings, and the tagline is your lettering.

Two honest caveats about the ending. The loop in the film is a clean ribbon, so where the two strokes cross it does not reproduce the small "over-under" gap your flat logo has. And the globes are coloured; your flat logo is one colour. If the lockup has to end as the exact brand mark, say so and I will cross-fade to the flat logo for the hold.

This replaces the two earlier 2D versions. Your supplied prop pictures are no longer used in the film at all, which also removes the watermark and trademark problems listed below.

**Sound** is original and synthesised from scratch by `scripts/make_audio.py` (nothing sampled or licensed): a short D-major mallet-and-pad score at 120 BPM that resolves at 4.0 s as the logo forms, with ball bounces, the racket hit and the car's lap placed on the frames where they happen.

## Your source files

| Asset | State | Used in the film? |
|---|---|---|
| `IMG_loop.PNG` | **Not transparent**: a screenshot on a white card with black bars, slightly soft. | Yes: the letters, the loop's measurements, the continents and the tagline all come from it. A vector logo (SVG/AI/PDF) would give sharper letters. |
| `IMG_racket…png` | Stock watermarks in the art ("alamy"): an unlicensed preview. | No. The racket is modelled from scratch. |
| `Img_ball…png` | "dreamstime" watermark across the middle. | No. The football is generated. |
| `IMG_f1…png` | A Ferrari F1 car with sponsor logos; only 550 px. | No. The car is a generic model with no branding. |
| `IMG_tennis…png` | Fine. | No. The tennis ball is generated. |
| `IMG_road…png` | 498×228 px, ragged, cut off at one end. | No. The loop itself is the road. |

The originals are untouched in the repo root.

## What was tested

Automatic checks (`npm run check`), all passing:

- the football and the tennis ball each come to rest exactly centred in their ring
- the racket meets the ball exactly at the hit time
- the car does exactly one lap; the loop closes on itself and is complete once the car leaves it; the car never snaps its heading
- the beats are staggered: football, serve, car, transformation
- the globes are in place and the car has gone before the lockup is complete
- the full lockup with tagline holds at least 1.5 s, and the hold needs no motion blur
- no pops: nothing jumps between adjacent tenth-of-a-frame samples
- in every format the camera never jumps and ends straight above the centre of the lockup

Measured on the delivered files:

| File | Picture | Frames | Duration | Loudness | True peak |
|---|---|---|---|---|---|
| `loop_16x9.mp4` | 1920×1080, 60 fps | 420 | 7.000 s | −16.0 LUFS | −2.6 dBTP |
| `loop_9x16.mp4` | 1080×1920, 60 fps | 420 | 7.000 s | −16.0 LUFS | −2.6 dBTP |
| `loop_1x1.mp4` | 1080×1080, 60 fps | 420 | 7.000 s | −16.0 LUFS | −2.6 dBTP |

Checked by eye: all 42 stills in `out/frames/` (14 beats × 3 formats). They are the exact frames that were encoded, saved losslessly before compression. The cream is exactly `#FFEEC0` in the corners of every one.

**Not tested:** I cannot hear audio, so the sound was checked by measurement only (loudness, peak, event timing), not by listening. Please listen once before publishing. The films were not test-uploaded to Instagram. Rendering here uses software WebGL (no GPU), which is slower but gives the same picture.

## How the cinetic skill was used

`npx skills add Leonxlnx/cinetic` installed without problems. The skill itself (19 MB of third-party files in `.agents/`) is not committed; `skills-lock.json` pins the version, and the same command restores it.

- **Followed:** its logo-sting shape (build the mark from its own parts, a reveal on the beat, lockup readable for the last 1.5 s and still gently moving, −16 LUFS, tail to digital silence), one timeline file driving picture and sound, no linear motion, everything a pure function of time, its Three.js scene approach, exact sub-frame motion blur averaged outside the browser, lossless PNG frames, BT.709 tagging, audio muxed separately so it sits on frame 0, a separate layout per aspect ratio.
- **Overridden by the brief:** it bans cream backgrounds and generated music. You asked for cream `#FFEEC0` and an original score.
- **Not used:** its scaffolding, scene bank and stock-music and stock-effects fetchers, which are for multi-scene product films.

## Rebuild

Needs Node 22+, Python 3.11+ (`pip install numpy scipy pillow soundfile pyloudnorm potracer shapely`) and ffmpeg.

```bash
npm install
npm run assets    # originals in the repo root -> public/assets/
npm run audio     # -> public/audio/loop_sting.wav, out/stems/
npm run check     # type-check + choreography checks
npm run render    # -> out/*.mp4 and out/frames/   (about 25 minutes without a GPU)
npm run studio    # live preview (sharp, no motion blur)
```

Where things live: timing in `src/timeline.json` (shared by picture and sound), per-format camera framing in `src/layouts.ts`, all motion and the camera in `src/motion.ts`, the 3D scene in `src/Sting.tsx`.
