import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import A from './assets.json';
import S from './stencils.json';
import T from './timeline.json';
import type { Layout } from './layouts';
import {
  BALL_R, CAR_DIR, GROUND, LOCKUP_W, LOOP_LENGTH, RACKET, RING_T, carPose, drawProgress, lockupPose, loopPath,
  prog, racketRot, racketVisible, soccerBall, taglinePose, tennisBall, travel,
} from './motion';

export const CREAM = '#FFEEC0';
const SHADOW = '58, 42, 18'; // warm dark, never pure black on cream
const abs: React.CSSProperties = { position: 'absolute', left: 0, top: 0, transformOrigin: '0 0' };

// The wipe works inside this box (lockup space), big enough to hold the lockup and both balls.
const BOX = { x: -320, y: -320, w: LOCKUP_W + 640, h: 1300 };
const WIPE_DEG = (Math.atan2(CAR_DIR.x, -CAR_DIR.y) * 180) / Math.PI; // CSS gradient angle along the car's heading
const WIPE_LEN = Math.abs(BOX.w * Math.sin((WIPE_DEG * Math.PI) / 180)) + Math.abs(BOX.h * Math.cos((WIPE_DEG * Math.PI) / 180));

type BallPose = { x: number; y: number; sx: number; sy: number; spin: number };
const BallSprite: React.FC<{ src: string; b: BallPose }> = ({ src, b }) => (
  <div style={{ ...abs, width: 0, height: 0, transform: `translate(${b.x}px, ${b.y}px) scale(${b.sx}, ${b.sy})` }}>
    <Img
      src={staticFile(src)}
      style={{
        ...abs, width: BALL_R * 2, height: BALL_R * 2, transformOrigin: '50% 50%',
        transform: `translate(${-BALL_R}px, ${-BALL_R}px) rotate(${b.spin}deg)`,
      }}
    />
  </div>
);

const GroundShadow: React.FC<{ x: number; k: number; opacity: number }> = ({ x, k, opacity }) => {
  const w = BALL_R * 2 * (0.55 + 0.45 * k);
  const h = w * 0.16;
  return (
    <div
      style={{
        ...abs, width: w, height: h, opacity: opacity * k,
        transform: `translate(${x - w / 2}px, ${GROUND + 4 - h / 2}px)`,
        background: `radial-gradient(closest-side, rgba(${SHADOW}, 0.5) 0%, rgba(${SHADOW}, 0.26) 50%, rgba(${SHADOW}, 0) 100%)`,
      }}
    />
  );
};

/** The whole picture at time t (seconds). Pure: the same t always draws the same frame. */
export const Scene: React.FC<{ L: Layout; t: number }> = ({ L, t }) => {
  const lock = lockupPose(L, t);
  const sb = soccerBall(L, t);
  const tb = tennisBall(L, t);
  const car = carPose(L, t);
  const tag = taglinePose(t);
  const drawn = drawProgress(t);
  const path = loopPath();
  const before = t < T.car.out;
  const after = t > T.car.in;

  // soft wipe edge that travels with the car, along its heading
  const edge = WIPE_LEN / 2 + (car.x - (BOX.x + BOX.w / 2)) * CAR_DIR.x + (car.y - (BOX.y + BOX.h / 2)) * CAR_DIR.y;
  const band = car.w * 0.3;
  const wiping = car.visible;
  const maskBefore = wiping ? `linear-gradient(${WIPE_DEG}deg, transparent ${edge - band / 2}px, #000 ${edge + band / 2}px)` : undefined;
  const maskAfter = wiping ? `linear-gradient(${WIPE_DEG}deg, #000 ${edge - band / 2}px, transparent ${edge + band / 2}px)` : undefined;
  const box: React.CSSProperties = { ...abs, width: BOX.w, height: BOX.h, transform: `translate(${BOX.x}px, ${BOX.y}px)` };
  const inner: React.CSSProperties = { ...abs, transform: `translate(${-BOX.x}px, ${-BOX.y}px)` };
  const dash = `${(drawn * LOOP_LENGTH).toFixed(2)} ${(LOOP_LENGTH * 2).toFixed(2)}`;
  const reveal = (id: string) => (
    <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={A.wordmark.w} height={A.wordmark.h}>
      <path d={path} fill="none" stroke="#fff" strokeWidth={RING_T + 10} strokeDasharray={dash} />
    </mask>
  );
  const shadowFade = (rest: number) => 1 - prog(t, rest, rest + 0.5);

  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      <div style={{ ...abs, width: LOCKUP_W, transform: `translate(${lock.x}px, ${lock.y}px) scale(${lock.s})` }}>
        {/* the infinity loop of the wordmark, drawn on like a road being laid */}
        {drawn > 0 ? (
          <svg style={{ ...abs, overflow: 'visible' }} width={A.wordmark.w} height={A.wordmark.h} viewBox={`0 0 ${A.wordmark.w} ${A.wordmark.h}`}>
            <defs>{reveal('ring')}</defs>
            <g mask="url(#ring)">
              <image href={staticFile('assets/wordmark.png')} width={A.wordmark.w} height={A.wordmark.h} />
            </g>
          </svg>
        ) : null}

        {/* the serve: an oversized racket sweeping through the corner of the frame */}
        {racketVisible(t) ? (
          <Img
            src={staticFile('assets/racket.svg')}
            style={{
              ...abs, width: S.racket.w, height: S.racket.h,
              transform: `translate(${RACKET.grip.x}px, ${RACKET.grip.y}px) rotate(${racketRot(t)}deg) scale(${RACKET.scale}) translate(${-S.racket.grip[0]}px, ${-S.racket.grip[1]}px)`,
            }}
          />
        ) : null}

        {/* before the car: the two balls, and lane markings on the loop */}
        {before ? (
          <div style={{ ...box, maskImage: maskBefore, WebkitMaskImage: maskBefore }}>
            <div style={inner}>
              {drawn > 0 ? (
                <svg style={{ ...abs, overflow: 'visible' }} width={A.wordmark.w} height={A.wordmark.h} viewBox={`0 0 ${A.wordmark.w} ${A.wordmark.h}`}>
                  <defs>{reveal('lane')}</defs>
                  <g mask="url(#lane)">
                    <path d={path} fill="none" stroke={CREAM} strokeWidth={6} strokeDasharray="30 30" />
                  </g>
                </svg>
              ) : null}
              <GroundShadow x={sb.x} k={sb.shadow} opacity={shadowFade(T.soccer.rest)} />
              {tb.visible ? <GroundShadow x={tb.x} k={tb.shadow} opacity={shadowFade(T.tennis.rest)} /> : null}
              <BallSprite src="assets/soccer.svg" b={sb} />
              {tb.visible ? <BallSprite src="assets/tennis.svg" b={tb} /> : null}
            </div>
          </div>
        ) : null}

        {/* after the car: the finished wordmark, globes where the balls were */}
        {after ? (
          <div style={{ ...box, maskImage: maskAfter, WebkitMaskImage: maskAfter }}>
            <div style={inner}>
              <Img src={staticFile('assets/wordmark.png')} style={{ ...abs, width: A.wordmark.w, height: A.wordmark.h }} />
            </div>
          </div>
        ) : null}

        {tag.opacity > 0 ? (
          <Img
            src={staticFile('assets/tagline.png')}
            style={{
              ...abs, width: A.tagline.w, height: A.tagline.h, opacity: tag.opacity,
              transform: `translate(${A.tagline.dx}px, ${A.tagline.dy + tag.dy}px)`,
            }}
          />
        ) : null}

        {car.visible ? (
          <Img
            src={staticFile('assets/car.svg')}
            style={{ ...abs, width: car.w, height: car.h, transform: `translate(${car.x - car.w / 2}px, ${car.y - car.h / 2}px)` }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// Motion blur: a 180 degree shutter, done exactly. Each output frame is drawn
// at several instants across the shutter interval ("sub-frames"); those are
// rendered as their own images and averaged afterwards by
// scripts/accumulate.py. Frames where nothing moves get one sample, so
// everything at rest stays pin-sharp and the flat cream stays one exact colour.
const SHUTTER = 0.5; // fraction of a frame
const PX_PER_SAMPLE = 2.2;
const MAX_SAMPLES = 40;

export const sampleCount = (L: Layout, t: number, fps: number) => {
  const px = travel(L, t, SHUTTER / fps);
  return px < 0.6 ? 1 : Math.min(MAX_SAMPLES, Math.max(2, Math.ceil(px / PX_PER_SAMPLE)));
};

/** every sub-frame of the film, in order: which output frame it belongs to and its instant */
export const subFramePlan = (L: Layout, fps: number, frames: number) => {
  const groups: number[] = [];
  const times: number[] = [];
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    const n = sampleCount(L, t, fps);
    groups.push(n);
    for (let i = 0; i < n; i++) times.push(n === 1 ? t : t + (SHUTTER / fps) * ((i + 0.5) / n - 0.5));
  }
  return { groups, times };
};

/** Preview / sharp version: one sample per frame, with sound. */
export const Sting: React.FC<{ layout: Layout }> = ({ layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Scene L={layout} t={frame / fps} />
      <Audio src={staticFile('audio/loop_sting.wav')} />
    </AbsoluteFill>
  );
};

/** Master picture: one frame of this composition per sub-frame. */
export const StingSub: React.FC<{ layout: Layout; times: number[] }> = ({ layout, times }) => {
  const frame = useCurrentFrame();
  return <Scene L={layout} t={times[Math.min(frame, times.length - 1)]} />;
};
