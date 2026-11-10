import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import A from './assets.json';
import type { Layout } from './layouts';
import {
  CAR_ANCHOR, carPose, lockupPose, propsOpacity, racketPose, roadBox, sceneOpacity, soccerBall, tennisBall, travel,
} from './motion';

export const CREAM = '#FFEEC0';
const SHADOW = '58, 42, 18'; // warm dark, never pure black on cream

const abs: React.CSSProperties = { position: 'absolute', left: 0, top: 0, transformOrigin: '0 0' };

const GroundShadow: React.FC<{ x: number; y: number; w: number; opacity: number }> = ({ x, y, w, opacity }) => {
  const h = w * 0.2;
  return (
    <div
      style={{
        ...abs, width: w, height: h, opacity,
        transform: `translate(${x - w / 2}px, ${y - h / 2}px)`,
        background: `radial-gradient(closest-side, rgba(${SHADOW}, 0.55) 0%, rgba(${SHADOW}, 0.3) 45%, rgba(${SHADOW}, 0) 100%)`,
      }}
    />
  );
};

/** The whole picture at time t (seconds). Pure: the same t always draws the same frame. */
export const Scene: React.FC<{ L: Layout; t: number }> = ({ L, t }) => {
  const props = propsOpacity(t);
  const lock = lockupPose(L, t);
  const road = roadBox(L);
  const car = carPose(L, t);
  const racket = racketPose(L, t);
  const tb = tennisBall(L, t);
  const sb = soccerBall(L, t);
  const carScale = car.w / A.car.w;
  const pad = A.car.shadowPad;

  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      <AbsoluteFill style={{ opacity: sceneOpacity(t) }}>
        {/* road: never moves; it only fades with the other props at the end */}
        {props > 0 ? (
          <Img
            src={staticFile('assets/road.svg')}
            style={{ ...abs, width: road.w, height: road.h, transform: `translate(${road.x}px, ${road.y}px)`, opacity: props }}
          />
        ) : null}

        {/* lockup: LOOP wordmark and tagline, positioned exactly as supplied */}
        <div style={{ ...abs, width: A.wordmark.w, transform: `translate(${lock.x}px, ${lock.y}px) scale(${lock.s})` }}>
          <Img src={staticFile('assets/wordmark.png')} style={{ ...abs, width: A.wordmark.w, height: A.wordmark.h }} />
          <Img
            src={staticFile('assets/tagline.png')}
            style={{ ...abs, width: A.tagline.w, height: A.tagline.h, transform: `translate(${A.tagline.dx}px, ${A.tagline.dy}px)` }}
          />
        </div>

        {/* contact shadows */}
        {sb.visible ? (
          <GroundShadow
            x={sb.x} y={sb.groundY}
            w={sb.r * 2.1 * (1 - 0.3 * Math.min(1, sb.height / (sb.r * 3)))}
            opacity={0.62 * (1 - 0.55 * Math.min(1, sb.height / (sb.r * 3)))}
          />
        ) : null}
        {tb.visible ? (
          <GroundShadow
            x={tb.x} y={tb.groundY}
            w={tb.r * 2.2}
            opacity={0.55 * Math.pow(Math.max(0, 1 - tb.height / (tb.r * 4.5)), 1.5)}
          />
        ) : null}

        {/* car and its shadow */}
        {car.visible ? (
          <div
            style={{
              ...abs, width: A.car.w, height: A.car.h,
              transform: `translate(${car.x}px, ${car.y}px) rotate(${car.rot}deg) scale(${carScale}) translate(${-A.car.w * CAR_ANCHOR.x}px, ${-A.car.h * CAR_ANCHOR.y}px)`,
            }}
          >
            <Img
              src={staticFile('assets/car_shadow.png')}
              style={{ ...abs, width: A.car.w + 2 * pad, height: A.car.h + 2 * pad, transform: `translate(${-pad - 6}px, ${-pad + 22}px)` }}
            />
            <Img src={staticFile('assets/car.png')} style={{ ...abs, width: A.car.w, height: A.car.h }} />
          </div>
        ) : null}

        {/* racket: turns about the grip */}
        {props > 0 ? (
          <Img
            src={staticFile('assets/racket.png')}
            style={{
              ...abs, width: A.racket.w, height: A.racket.h, opacity: props,
              transform: `translate(${racket.x}px, ${racket.y}px) rotate(${racket.rot}deg) scale(${L.tennis.side === 1 ? -racket.scale : racket.scale}, ${racket.scale}) translate(${-A.racket.grip[0]}px, ${-A.racket.grip[1]}px)`,
            }}
          />
        ) : null}

        {tb.visible ? (
          <div
            style={{
              ...abs, width: 0, height: 0,
              transform: `translate(${tb.x}px, ${tb.y + tb.r * tb.squash}px) scale(${1 + tb.squash * 0.5}, ${1 - tb.squash})`,
            }}
          >
            <Img
              src={staticFile('assets/tennis.png')}
              style={{ ...abs, width: tb.r * 2, height: tb.r * 2, transformOrigin: '50% 50%', transform: `translate(${-tb.r}px, ${-tb.r}px) rotate(${tb.spin}deg)` }}
            />
          </div>
        ) : null}

        {sb.visible ? (
          <div style={{ ...abs, width: 0, height: 0, transform: `translate(${sb.x}px, ${sb.y}px) scale(${sb.sx}, ${sb.sy})` }}>
            <Img
              src={staticFile('assets/soccer.png')}
              style={{ ...abs, width: sb.r * 2, height: sb.r * 2, transformOrigin: '50% 50%', transform: `translate(${-sb.r}px, ${-sb.r}px) rotate(${sb.spin}deg)` }}
            />
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Motion blur: a 180 degree shutter, done exactly. Each output frame is drawn
// at several instants across the shutter interval ("sub-frames"); those are
// rendered as their own images and averaged afterwards by
// scripts/accumulate.py. Frames where nothing moves get one sample, so
// everything at rest stays pin-sharp and the flat cream stays one exact colour.
const SHUTTER = 0.5; // fraction of a frame
const PX_PER_SAMPLE = 2.0;
const MAX_SAMPLES = 20;

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
