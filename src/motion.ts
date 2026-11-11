// Every pose in the film is a pure function of time (seconds) and layout.
// Nothing here knows about frames, so motion blur can sample between frames.
//
// Coordinates: "lockup space" = pixels of the supplied wordmark art
// (1725 wide). lockupPose() maps it onto each frame.
import A from './assets.json';
import S from './stencils.json';
import T from './timeline.json';
import type { Layout } from './layouts';

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

// Easing by role. No linear moves anywhere.
export const ease = {
  inOutSine: (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k),
  inOutCubic: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outCubic: (k: number) => 1 - Math.pow(1 - k, 3),
  outQuart: (k: number) => 1 - Math.pow(1 - k, 4),
};

// ----------------------------------------------------------------- lockup
export const LOCKUP_W = A.wordmark.w;
export const LOCKUP_H = A.tagline.dy + A.tagline.h;

/** camera: 0 while it sits close on the two balls, 1 once it has pulled back to the lockup */
export const pullBack = (t: number) => ease.inOutCubic(prog(t, T.draw[0] + 0.25, T.car.pass + 0.2));

export const lockupPose = (L: Layout, t: number) => {
  const k = pullBack(t);
  // a slow 1.5 % push through the hold that comes to rest on the last frame
  const push = 1 + 0.015 * ease.outCubic(prog(t, T.car.out, T.duration));
  const s = (L.lockupWidth / LOCKUP_W) * Math.pow(L.zoom, 1 - k) * push; // zoom in log space
  // the point of the lockup that sits at the centre of the frame
  const fx = LOCKUP_W / 2;
  const fy = LOOP_CY + (LOCKUP_H / 2 - LOOP_CY) * k;
  return { x: L.w / 2 - fx * s, y: L.h * L.lockupCy - fy * s, s };
};
/** frame edges expressed in lockup space at time t */
export const frameEdges = (L: Layout, t = 0) => {
  const p = lockupPose(L, t);
  return { left: -p.x / p.s, right: (L.w - p.x) / p.s, top: -p.y / p.s, bottom: (L.h - p.y) / p.s };
};

// --------------------------------------------------- the loop's geometry
// The two rings of the infinity sign, measured from the wordmark art.
export const RING_R = (S.loop.left.r + S.loop.right.r) / 2;
export const RING_T = (S.loop.left.thick + S.loop.right.thick) / 2;
export const CY = (S.loop.left.cy + S.loop.right.cy) / 2;
const LOOP_CY = CY;
export const LEFT = { x: S.loop.left.cx, y: CY };
export const RIGHT = { x: S.loop.right.cx, y: CY };
export const CROSS = { x: (LEFT.x + RIGHT.x) / 2, y: CY };
export const BALL_R = RING_R - RING_T / 2 - 34; // a ball sits inside a ring with air around it
export const GROUND = CY + BALL_R; // where a ball resting in its ring touches down

const JOIN = (52 * Math.PI) / 180; // where each ring meets the crossing strokes
/** centre line of the infinity sign as an SVG path, drawn from the crossing */
export const loopPath = () => {
  const dx = RING_R * Math.cos(JOIN);
  const dy = RING_R * Math.sin(JOIN);
  const f = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  return [
    `M${f(CROSS.x, CROSS.y)}`,
    `L${f(LEFT.x + dx, CY - dy)}`,
    `A${RING_R} ${RING_R} 0 1 0 ${f(LEFT.x + dx, CY + dy)}`,
    `L${f(RIGHT.x - dx, CY - dy)}`,
    `A${RING_R} ${RING_R} 0 1 1 ${f(RIGHT.x - dx, CY + dy)}`,
    `L${f(CROSS.x, CROSS.y)}`,
  ].join('');
};
export const LOOP_LENGTH = (() => {
  const dx = RING_R * Math.cos(JOIN);
  const dy = RING_R * Math.sin(JOIN);
  const arc = RING_R * (2 * Math.PI - 2 * JOIN);
  const d1 = Math.hypot(LEFT.x + dx - CROSS.x, dy);
  const d2 = Math.hypot(RIGHT.x - dx - (LEFT.x + dx), 2 * dy);
  return d1 * 2 + d2 + arc * 2;
})();
export const drawProgress = (t: number) => ease.inOutCubic(prog(t, T.draw[0], T.draw[1]));

// ------------------------------------------------------------------ balls
const G = 10560; // gravity in lockup px/s^2: a 0.5 s hop rises about one ball
const STRETCH = 0.05;

type Ball = { x: number; y: number; sx: number; sy: number; spin: number; height: number; shadow: number };

/**
 * A ball that arrives, bounces on the given beats with shrinking hops, and
 * rolls to rest centred in its ring.
 */
const bounceIn = (
  t: number, start: number, x0: number, target: number, contacts: number[], rest: number, settle: number,
  first: { h: number; v: number }, // height and downward speed at `start`
): Ball => {
  const c = 0.06; // contact time
  let h = 0;
  let sy = 1;
  // first leg: from the start state down to the first contact
  if (t <= contacts[0]) {
    const k = t - start;
    h = Math.max(0, first.h - first.v * k - 0.5 * G * k * k);
    sy = 1 + STRETCH * clamp01((first.v + G * k) / 2600);
  }
  const times = [...contacts, rest];
  for (let i = 0; i < times.length - 1; i++) {
    const a = times[i];
    const b = times[i + 1];
    const air = b - a - c;
    const v0 = (G * air) / 2;
    const squash = 0.03 + 0.07 * Math.min(1, (i === 0 ? first.v + G * (a - start) : (G * (a - times[i - 1] - c)) / 2) / 2600);
    if (t > a && t <= a + c) sy = 1 + STRETCH - (squash + STRETCH) * Math.sin(Math.PI * prog(t, a, a + c));
    else if (t > a + c && t <= b) {
      const k = t - a - c;
      h = v0 * k - 0.5 * G * k * k;
      sy = 1 + STRETCH * Math.pow(Math.abs(v0 - G * k) / Math.max(v0, 1), 2) * clamp01(v0 / 1500);
    }
  }
  if (t > rest && t <= rest + c) sy = 1 - 0.03 * Math.sin(Math.PI * prog(t, rest, rest + c));
  // sideways: one decelerating glide that ends exactly on the ring centre
  const u = prog(t, start, settle);
  const x = target + (x0 - target) * Math.pow(1 - u, 2.4);
  const spin = (((x - x0) / BALL_R) * 180) / Math.PI; // rolls without slipping
  return {
    x, y: GROUND - BALL_R * sy - h, sx: 1 + (1 - sy) * 0.6, sy, spin, height: h,
    shadow: clamp01(1 - h / (BALL_R * 3.2)),
  };
};

export const soccerBall = (L: Layout, t: number): Ball & { visible: boolean } => {
  const s = T.soccer;
  const drop = 0.5 * G * s.bounces[0] * s.bounces[0]; // falls in from above the frame
  const x0 = Math.min(LEFT.x - 640, frameEdges(L, 0).left - BALL_R * 1.1); // from off the left edge
  const b = bounceIn(t, 0, x0, LEFT.x, s.bounces, s.rest, s.settle, { h: drop, v: 0 });
  return { ...b, visible: true };
};

// The serve: the ball is tossed up from below the frame, hangs, and is hit.
export const HIT = { x: RIGHT.x + 380, y: CY - 330 };

export const tennisBall = (L: Layout, t: number): Ball & { visible: boolean } => {
  const s = T.tennis;
  if (t <= s.hit) {
    const from = frameEdges(L).bottom + BALL_R * 1.2;
    const k = ease.outQuart(prog(t, s.toss, s.hit + 0.04)); // still drifting up when it is struck
    return {
      x: HIT.x, y: from + (HIT.y - from) * k, sx: 1, sy: 1, spin: -70 * (1 - k), height: GROUND - BALL_R - HIT.y,
      shadow: 0, visible: t > s.toss,
    };
  }
  const fall = s.bounces[0] - s.hit;
  const h0 = GROUND - BALL_R - HIT.y;
  const v = (h0 - 0.5 * G * fall * fall) / fall;
  const b = bounceIn(t, s.hit, HIT.x, RIGHT.x, s.bounces, s.rest, s.settle, { h: h0, v });
  return { ...b, visible: true };
};

// ----------------------------------------------------------------- racket
// Oversized, mostly out of frame: only the head sweeps through the corner.
export const RACKET = (() => {
  const dx = S.racket.grip[0] - S.racket.strings[0];
  const dy = S.racket.grip[1] - S.racket.strings[1];
  const reachArt = Math.hypot(dx, dy);
  const scale = (BALL_R * 2 * 2.5) / 700; // head about 2.5 balls long
  const reach = reachArt * scale;
  const native = (Math.atan2(dy, dx) * 180) / Math.PI; // art: head up-left of the grip
  const contactDir = 42; // at contact the head lies this far below horizontal, left of the grip
  const rad = (contactDir * Math.PI) / 180;
  return {
    scale, reach, native,
    grip: { x: HIT.x + reach * Math.cos(rad), y: HIT.y - reach * Math.sin(rad) },
    contact: -(native + contactDir), // CSS rotation at contact
    wind: 72, // degrees of wind-up before contact
    follow: 95,
  };
})();

export const racketRot = (t: number) => {
  const s = T.tennis;
  const top = RACKET.contact + RACKET.wind;
  if (t <= s.swing) return top + 14 * ease.inOutSine(prog(t, s.toss + 0.1, s.swing)); // draws back first
  const start = top + 14;
  const dur = s.hit - s.swing;
  if (t <= s.hit) {
    const k = (t - s.swing) / dur;
    return start - (start - RACKET.contact) * k * k; // accelerates into the ball
  }
  const v = (2 * (start - RACKET.contact)) / dur;
  const followT = (3 * RACKET.follow) / v; // decelerates from exactly that speed
  return RACKET.contact - RACKET.follow * ease.outCubic(clamp01((t - s.hit) / followT));
};
export const racketVisible = (t: number) => t > T.tennis.toss && t < T.tennis.hit + 0.5;

// -------------------------------------------------------------------- car
// Passes close to the lens along its own heading and wipes the logo on.
export const CAR_DIR = (() => {
  const a = (43 * Math.PI) / 180; // the art faces down-left
  return { x: -Math.cos(a), y: Math.sin(a) };
})();
const CAR_POWER = Math.log(0.5) / Math.log((T.car.pass - T.car.in) / (T.car.out - T.car.in));
export const carPose = (L: Layout, t: number) => {
  const e = frameEdges(L, T.car.out);
  const w = L.carWidth;
  const h = (w * S.car.h) / S.car.w;
  const centre = { x: LOCKUP_W / 2, y: LOCKUP_H / 2 - 40 };
  // far enough either side to be fully out of every frame
  const reach = Math.hypot(e.right - e.left, e.bottom - e.top) / 2 + w * 0.8;
  const k = prog(t, T.car.in, T.car.out);
  // gathers speed all the way through; timed so it is centred on the lockup at car.pass
  const q = (Math.pow(k, CAR_POWER) - 0.5) * 2 * reach;
  const grow = 0.86 + 0.28 * k; // comes toward the lens
  return {
    x: centre.x + CAR_DIR.x * q, y: centre.y + CAR_DIR.y * q, w: w * grow, h: h * grow, q,
    visible: t > T.car.in && t < T.car.out,
  };
};
/** 0 before the car arrives, 1 once it has gone: which side of the wipe we are on */
export const wipeDone = (t: number) => (t >= T.car.out ? 1 : t <= T.car.in ? 0 : 0.5);

// ---------------------------------------------------------------- tagline
export const taglinePose = (t: number) => {
  const k = ease.outCubic(prog(t, T.tagline[0], T.tagline[1]));
  return { opacity: ease.inOutSine(prog(t, T.tagline[0], T.tagline[0] + 0.45)), dy: 16 * (1 - k) };
};

// ----------------------------------------------------------- motion blur
/** largest on-screen travel (px) of anything during one shutter interval, camera move included */
export const travel = (L: Layout, t: number, shutter: number) => {
  const a = t - shutter / 2;
  const b = t + shutter / 2;
  const pa = lockupPose(L, a);
  const pb = lockupPose(L, b);
  type P = { x: number; y: number };
  // distance on screen between a point at time a and a point at time b
  const far = (p: P, q: P) => Math.hypot(pb.x + q.x * pb.s - (pa.x + p.x * pa.s), pb.y + q.y * pb.s - (pa.y + p.y * pa.s));
  const s = pb.s;
  let m = 0;
  // the lockup itself (camera pull-back and the slow push)
  for (const c of [{ x: 0, y: 0 }, { x: LOCKUP_W, y: LOCKUP_H }]) m = Math.max(m, far(c, c));
  const s0 = soccerBall(L, a);
  const s1 = soccerBall(L, b);
  m = Math.max(m, far(s0, s1) + Math.abs(s1.sy - s0.sy) * BALL_R * s + (Math.abs(s1.spin - s0.spin) * Math.PI * BALL_R * s) / 180);
  const t0 = tennisBall(L, a);
  const t1 = tennisBall(L, b);
  if (t0.visible) m = Math.max(m, far(t0, t1) + Math.abs(t1.sy - t0.sy) * BALL_R * s + (Math.abs(t1.spin - t0.spin) * Math.PI * BALL_R * s) / 180);
  if (racketVisible(t)) m = Math.max(m, (Math.abs(racketRot(b) - racketRot(a)) * Math.PI * RACKET.reach * 1.4 * s) / 180);
  const c0 = carPose(L, a);
  const c1 = carPose(L, b);
  if (c0.visible || c1.visible) m = Math.max(m, far(c0, c1) + Math.abs(c1.w - c0.w) * s * 0.5);
  m = Math.max(m, Math.abs(drawProgress(b) - drawProgress(a)) * LOOP_LENGTH * s);
  m = Math.max(m, Math.abs(taglinePose(b).dy - taglinePose(a).dy) * s);
  return m;
};
