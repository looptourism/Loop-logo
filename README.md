# Loop Travel & Tourism — 7-second logo sting

Animated logo sting for Instagram ads, built in code with [Remotion](https://www.remotion.dev) 4.

| File | Size | Use |
|---|---|---|
| `out/loop_16x9.mp4` | 1920×1080 | landscape feed, YouTube |
| `out/loop_9x16.mp4` | 1080×1920 | Reels, Stories |
| `out/loop_1x1.mp4` | 1080×1080 | square feed |
| `out/frames/` | 48 PNG stills | one per story beat, per format |
| `out/stems/` | `music.wav`, `effects.wav` | the two halves of the soundtrack |

All three are 7.00 s, 60 fps, H.264 (yuv420p, BT.709) with AAC stereo 48 kHz. Each format has its own layout; none is a crop of another.

## Read this first: problems with the supplied assets

**Three of the pictures should not go into a paid ad as they are.** I have used them unaltered so you can judge the animation, but they need replacing or licensing first.

| Asset | Problem |
|---|---|
| `IMG_racket…png` | **Stock watermarks are still in the art** ("alamy" on the grip, small "a" marks on the frame). This is an unlicensed preview image. I did not remove the watermarks. |
| `Img_ball…png` (soccer ball) | **"dreamstime" watermark across the middle.** Same issue; not removed. |
| `IMG_f1…png` (car) | It is a **Ferrari F1 car with sponsor logos** (Shell, Santander, AWS and others). Those are third-party trademarks; using them in advertising needs permission. Also only 550 px, so it is shown slightly above native size as it leaves the frame (motion blur covers this). |
| `IMG_loop.PNG` | **Not transparent.** It is a screenshot: white card with black bars above and below. I keyed the dark ink off the white to get a transparent wordmark. It is also slightly soft (it looks upscaled); a vector (SVG/AI/PDF) logo would be sharper. |
| `IMG_road…png` | Only **498×228 px**, with ragged edges and pin-holes in the lane dashes, and its near end is **cut off flat**, so it could not run out of frame as it was. See "What I did to the road" below. |
| `IMG_tennis…png` | Fine. Small (250 px), with a rough dark outline that is part of the drawing. |
| Racket | Background removal had punched small holes in the string bed; these are filled back to white. |

Other things you should know:

- **"Travel & Tourism" is not a separate file**, but it is part of `IMG_loop.PNG`. I used your own lettering from that file, in its original position under LOOP, instead of re-setting it in a different font.
- **There was no reference for where the props sit in the logo.** The repo has the wordmark and five loose props, but no picture of the whole logo assembled. I composed the opening myself from your brief (road starting by the P, car at the start of the road, sports props grouped together). If your real logo arranges them differently, send it and I will match it: the positions are a handful of numbers in `src/layouts.ts`.

### What I did to the road

The road is the only asset I changed beyond trimming, because at 498 px it could not fill a 1080p frame cleanly:

1. Auto-traced to vector outlines (potrace), so its edges stay clean at any size. Same shapes, no redrawing by hand.
2. Continued past its cut end along the asset's own edge lines, with the last lane dash repeated at the spacing measured from the art, so the road leaves the frame and no end is visible.
3. Stretched differently per format (it is a flat ground plane, so this reads as a change of camera height).

The far tip of the road is a thin sliver in the original and stays that way. A proper vector road from your designer would still be better.

## The film

| Time | What happens |
|---|---|
| 0.0–0.6 s | Logo fades in; everything still |
| 0.66–1.9 s | Car sinks back a touch, launches, drives the road toward the viewer growing with perspective, exits. Motion blur and a soft shadow |
| 1.95–3.3 s | Racket winds back, swings, hits at 2.50 s. Ball hits the ground once (2.65 s) and flies out. Racket follows through and returns to rest |
| 2.95–4.9 s | Soccer ball presses down, hops twice in place (landing 3.5 s and 4.0 s, small squash each time), then bounces out spinning (4.5 s) |
| 4.6–5.5 s | Road and racket fade away; the lockup glides to centre and settles |
| 5.5–7.0 s | Hold: LOOP and the tagline only |

The road never moves. Actions are staggered so one thing has the eye at a time. Background is `#FFEEC0`. No glow, particles or gradient cards.

**Sound** is original and synthesised from scratch by `scripts/make_audio.py` (nothing sampled or licensed): a short D-major mallet-and-pad score at 120 BPM that resolves as the lockup settles, with a car pass, racket hit, tennis bounce and three soccer bounces placed on the frames where they happen.

## What was tested

Automatic checks (`npm run check`), all passing for all three formats:

- car starts fully in frame and is fully out by 1.9 s
- tennis ball touches the ground exactly once, and has left before the soccer ball hops
- racket is back at its rest angle
- soccer ball does not drift during its two in-place hops; its travelling bounce lands in view; it is gone before the props finish fading
- lockup ends exactly centred and holds 1.5 s
- no pops: nothing jumps between adjacent tenth-of-a-frame samples
- opening and hold are completely still

Measured on the delivered files (see the table at the end of this section):

- resolution, frame rate, frame count and duration of each MP4
- loudness and true peak of each MP4's audio
- background colour is exactly `#FFEEC0` on every exported still, including motion-blurred frames

Checked by eye: all 48 stills in `out/frames/` (16 beats × 3 formats), plus contact sheets through each action.

| File | Picture | Frames | Duration | Loudness | True peak |
|---|---|---|---|---|---|
| `loop_16x9.mp4` | 1920×1080, 60 fps | 420 | 7.000 s | −16.0 LUFS | −2.1 dBTP |
| `loop_9x16.mp4` | 1080×1920, 60 fps | 420 | 7.000 s | −16.0 LUFS | −2.1 dBTP |
| `loop_1x1.mp4` | 1080×1080, 60 fps | 420 | 7.000 s | −16.0 LUFS | −2.1 dBTP |

Two things the eye check caught and I fixed before the final render: on blurred frames the first motion-blur method shifted the cream by a few levels (it would have flickered), so blur is now averaged outside the browser; and in 9:16 the tennis ball's bounce landed on the tip of the racket's follow-through, so the ball travels faster in the two narrow formats.

The stills are the exact frames that were encoded, saved losslessly before compression. The one exception is `09_ball_flies_out`, which is pulled from the finished MP4.

**Not tested:** I cannot hear audio, so the sound was checked by measurement only (loudness, peak, event timing), not by listening. Please listen once before publishing. The films were also not test-uploaded to Instagram.

## How the cinetic skill was used

`npx skills add Leonxlnx/cinetic` installed without problems. The skill itself (19 MB of third-party files in `.agents/`) is not committed; `skills-lock.json` pins the version, and the same command restores it. It is written for product launch films, and several of its house rules contradict this brief, so the brief won wherever they differ:

- **Followed:** its logo-sting format (lockup readable for the last 1.5 s, −16 LUFS, tail to digital silence), one timeline file driving picture and sound, no linear motion, everything a pure function of time, exact sub-frame motion blur averaged outside the browser, lossless PNG frames, BT.709 tagging, audio muxed separately so it sits on frame 0, separate layouts per aspect ratio.
- **Overridden by the brief:** it bans cream backgrounds and generated music, and wants frame 0 already moving. You asked for cream `#FFEEC0`, an original score, and a still fade-in.
- **Not used:** its scaffolding, scene bank, stock-music and stock-effects fetchers, which are for multi-scene product films.

## Rebuild

Needs Node 22+, Python 3.11+ (`pip install numpy scipy pillow soundfile pyloudnorm potracer shapely`) and ffmpeg.

```bash
npm install
npm run assets    # originals in the repo root -> public/assets/
npm run audio     # -> public/audio/loop_sting.wav, out/stems/
npm run check     # type-check + choreography checks
npm run render    # -> out/*.mp4 and out/frames/   (about 15 minutes)
npm run studio    # live preview (sharp, no motion blur)
```

Where things live: timing in `src/timeline.json` (shared by picture and sound), per-format layout in `src/layouts.ts`, all motion in `src/motion.ts`, the picture in `src/Sting.tsx`.
