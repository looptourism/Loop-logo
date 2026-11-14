// Every pose in the film is a pure function of time (seconds).
// World: x and z are the wordmark art's pixel axes (the lockup lies flat on
// the floor, 1725 units wide), y is up.
import A from './assets.json';
import SH from './shapes.json';
import S from './stencils.json';
import T from './timeline.json';
import type { Layout } from './layouts';

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Easing by role. No linear moves anywhere.
export const ease = {
  inOutSine: (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k),
  inOutCubic: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outCubic: (k: number) => 1 - Math.pow(1 - k, 3),
  outBack: (k: number) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2),
};

// --------------------------------------------------- the loop's geometry
export const LOCKUP_W = A.wordmark.w;
export const LOCKUP_H = A.tagline.dy + A.tagline.h;
export const RING_R = (S.loop.left.r + S.loop.right.r) / 2;
export const RING_T = (S.loop.left.thick + S.loop.right.thick) / 2;
export const CY = (S.loop.left.cy + S.loop.right.cy) / 2;
export const LEFT = { x: S.loop.left.cx, z: CY };
export const RIGHT = { x: S.loop.right.cx, z: CY };
export const BALL_R = RING_R - RING_T / 2 - 16; // a ball sits inside a ring with a little air
/** each globe fills its ring: the land reaches the infinity sign, as in the logo */
export const GLOBE_R = { left: SH.globeR.left, right: SH.globeR.right };
export const SLAB = 26; // thickness of the track and the letters

// The car's route: in along the floor, once round the infinity sign, out again.
const HALF = (RIGHT.x - LEFT.x) / 2;
const J = Math.acos(RING_R / HALF); // where the crossing straights leave each ring, tangentially
const DIAG = 2 * Math.sqrt(HALF * HALF - RING_R * RING_R);
const ARC_A = RING_R * (Math.PI / 2 - J); // left ring: bottom up to the crossing
const ARC_R = RING_R * (2 * Math.PI - 2 * J); // all the way round the right ring
const ARC_B = RING_R * (1.5 * Math.PI - J); // left ring: over the top, back to the bottom
export const LOOP_LEN = ARC_A + DIAG + ARC_R + DIAG + ARC_B;
export const RUN_IN = 2200;
export const RUN_OUT = 3600;

/** point and heading on the infinity loop, s = distance from the bottom of the left ring */
export const loopPoint = (s: number) => {
  const onRing = (c: { x: number; z: number }, a: number, dir: number) => ({
    x: c.x + RING_R * Math.cos(a), z: c.z + RING_R * Math.sin(a),
    hx: -Math.sin(a) * dir, hz: Math.cos(a) * dir,
  });
  const line = (p: { x: number; z: number }, q: { x: number; z: number }, k: number) => {
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    return { x: lerp(p.x, q.x, k), z: lerp(p.z, q.z, k), hx: (q.x - p.x) / d, hz: (q.z - p.z) / d };
  };
  const pt = (c: { x: number; z: number }, a: number) => ({ x: c.x + RING_R * Math.cos(a), z: c.z + RING_R * Math.sin(a) });
  if (s < 0) return { x: LEFT.x + s, z: CY + RING_R, hx: 1, hz: 0 };
  if (s <= ARC_A) return onRing(LEFT, Math.PI / 2 - s / RING_R, -1);
  s -= ARC_A;
  if (s <= DIAG) return line(pt(LEFT, J), pt(RIGHT, Math.PI + J), s / DIAG);
  s -= DIAG;
  if (s <= ARC_R) return onRing(RIGHT, Math.PI + J + s / RING_R, 1);
  s -= ARC_R;
  if (s <= DIAG) return line(pt(RIGHT, Math.PI - J), pt(LEFT, -J), s / DIAG);
  s -= DIAG;
  if (s <= ARC_B) return onRing(LEFT, -J - s / RING_R, -1);
  s -= ARC_B;
  return { x: LEFT.x + s, z: CY + RING_R, hx: 1, hz: 0 };
};

// -------------------------------------------------------------------- car
/** distance along the route (negative = still on the run-in) */
export const carDistance = (t: number) => {
  const c = T.car;
  // steady round the loop; the run-in and run-out join it at the same speed
  const v = LOOP_LEN / (c.offLoop - c.onLoop);
  if (t < c.onLoop) {
    const k = (c.onLoop - t) / (c.onLoop - c.in);
    return -(v * (c.onLoop - c.in) * k + (RUN_IN - v * (c.onLoop - c.in)) * k * k); // arrives carrying speed
  }
  if (t <= c.offLoop) return v * (t - c.onLoop);
  const k = (t - c.offLoop) / (c.out - c.offLoop);
  return LOOP_LEN + v * (c.out - c.offLoop) * k + (RUN_OUT - v * (c.out - c.offLoop)) * k * k; // and powers away
};
export const carPose = (t: number) => {
  const p = loopPoint(carDistance(t));
  return { ...p, yaw: Math.atan2(-p.hz, p.hx), visible: t > T.car.in && t < T.car.out };
};
/** how much of the loop has been laid down behind the car, 0..1 */
export const trackDrawn = (t: number) => clamp01((carDistance(t) - 30) / LOOP_LEN);

// ------------------------------------------------------------------ balls
const G = 10560; // gravity in world units/s^2: a 0.5 s hop rises about one ball
const STRETCH = 0.05;
export type Ball = { x: number; y: number; z: number; sy: number; roll: number; rollAxis: [number, number, number] };

const bounceIn = (
  t: number, start: number, from: { x: number; z: number }, to: { x: number; z: number },
  contacts: number[], rest: number, settle: number, first: { h: number; v: number },
): Ball => {
  const c = 0.06; // contact time
  let h = 0;
  let sy = 1;
  if (t <= contacts[0]) {
    const k = Math.max(0, t - start);
    h = Math.max(0, first.h - first.v * k - 0.5 * G * k * k);
    sy = 1 + STRETCH * clamp01((first.v + G * k) / 2600);
  }
  const times = [...contacts, rest];
  for (let i = 0; i < times.length - 1; i++) {
    const a = times[i];
    const b = times[i + 1];
    const air = b - a - c;
    const v0 = (G * air) / 2;
    const impact = i === 0 ? first.v + G * (a - start) : (G * (a - times[i - 1] - c)) / 2;
    const squash = 0.03 + 0.07 * Math.min(1, impact / 2600);
    if (t > a && t <= a + c) sy = 1 + STRETCH - (squash + STRETCH) * Math.sin(Math.PI * prog(t, a, a + c));
    else if (t > a + c && t <= b) {
      const k = t - a - c;
      h = v0 * k - 0.5 * G * k * k;
      sy = 1 + STRETCH * Math.pow(Math.abs(v0 - G * k) / Math.max(v0, 1), 2) * clamp01(v0 / 1500);
    }
  }
  if (t > rest && t <= rest + c) sy = 1 - 0.03 * Math.sin(Math.PI * prog(t, rest, rest + c));
  // across the floor: one decelerating glide that ends exactly on the ring centre
  const u = 1 - Math.pow(1 - prog(t, start, settle), 2.4);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  return {
    x: from.x + dx * u, z: from.z + dz * u, y: BALL_R * sy + h, sy,
    roll: (dist * u) / BALL_R, // rolls without slipping
    rollAxis: [dz / dist, 0, -dx / dist],
  };
};

export const soccerBall = (t: number): Ball => {
  const s = T.soccer;
  const drop = 0.5 * G * s.bounces[0] * s.bounces[0];
  return bounceIn(t, 0, { x: LEFT.x - 1150, z: CY + 260 }, LEFT, s.bounces, s.rest, s.settle, { h: drop, v: 0 });
};

// The serve: the ball drops in, an oversized racket meets it in mid-air.
export const HIT = { x: RIGHT.x + 420, y: 560, z: CY - 120 };
export const tennisBall = (t: number): Ball & { visible: boolean } => {
  const s = T.tennis;
  if (t <= s.hit) {
    const k = prog(t, s.enter, s.hit);
    const fall = 1900 * (1 - k) * (1 - k); // drops in and hangs for the racket
    return { x: HIT.x + 160 * (1 - k), y: HIT.y + fall, z: HIT.z, sy: 1, roll: -1.2 * k, rollAxis: [0, 0, 1], visible: t > s.enter };
  }
  const fallT = s.bounces[0] - s.hit;
  const h0 = HIT.y - BALL_R;
  const v = (h0 - 0.5 * G * fallT * fallT) / fallT;
  return { ...bounceIn(t, s.hit, HIT, RIGHT, s.bounces, s.rest, s.settle, { h: h0, v }), visible: true };
};

/** racket: swing angle in degrees about its grip (0 = at contact), and whether it is on stage */
export const racket = (t: number) => {
  const s = T.tennis;
  const WIND = 105;
  const FOLLOW = 120;
  let a: number;
  if (t <= s.swing) a = WIND + 16 * ease.inOutSine(prog(t, s.enter, s.swing)); // draws back first
  else if (t <= s.hit) {
    const k = (t - s.swing) / (s.hit - s.swing);
    a = (WIND + 16) * (1 - k * k); // accelerates into the ball
  } else {
    const v = (2 * (WIND + 16)) / (s.hit - s.swing);
    a = -FOLLOW * ease.outCubic(clamp01((t - s.hit) / ((3 * FOLLOW) / v))); // decelerates from exactly that speed
  }
  // lifts away once the stroke is over
  const leave = ease.inOutCubic(prog(t, s.hit + 0.25, s.hit + 0.75));
  return { angle: a, lift: 2600 * leave, visible: t > s.enter - 0.05 && t < s.hit + 0.75 };
};

// --------------------------------------------------------- the transformation
/** 0 = balls, 1 = globes */
export const morph = (t: number) => ease.inOutCubic(prog(t, T.morph[0], T.morph[1]));
export const lettersUp = (t: number) => ease.outCubic(prog(t, T.letters[0], T.letters[1]));
export const taglineIn = (t: number) => ease.inOutSine(prog(t, T.tagline[0], T.tagline[1]));

// -------------------------------------------------------------- aeroplane
// Sweeps in low from the bottom left as the logo forms, climbs away over the
// corner of the lockup and settles into a slow cruise beside it.
export const PLANE_ALT = 600;
export const planePose = (L: Layout, t: number) => {
  const end = L.plane;
  const start = { x: end.x - 3900, z: end.z + 1650 };
  const ctrl = { x: end.x - 1595, z: end.z + 1100 };
  const k = ease.outCubic(prog(t, T.plane.in, T.plane.settle)); // arrives fast, eases into the cruise
  const a = (1 - k) * (1 - k);
  const b = 2 * (1 - k) * k;
  const c = k * k;
  let hx = 2 * (1 - k) * (ctrl.x - start.x) + 2 * k * (end.x - ctrl.x);
  let hz = 2 * (1 - k) * (ctrl.z - start.z) + 2 * k * (end.z - ctrl.z);
  const len = Math.hypot(hx, hz);
  hx /= len;
  hz /= len;
  const cruise = 12 * Math.max(0, t - T.plane.in); // never quite stops: it is flying
  const ex = (end.x - ctrl.x) / Math.hypot(end.x - ctrl.x, end.z - ctrl.z);
  const ez = (end.z - ctrl.z) / Math.hypot(end.x - ctrl.x, end.z - ctrl.z);
  return {
    x: a * start.x + b * ctrl.x + c * end.x + ex * cruise,
    z: a * start.z + b * ctrl.z + c * end.z + ez * cruise,
    y: PLANE_ALT * (0.82 + 0.18 * k),
    yaw: Math.atan2(-hz, hx),
    bank: -0.42 * (1 - k) * (1 - k), // leans into the turn, levels out
    scale: end.scale,
    visible: t > T.plane.in,
  };
};

// ----------------------------------------------------------------- camera
const VFOV = 26;
const keys = (t: number, ks: [number, number][]) => {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0] = ks[i];
    const [t1, v1] = ks[i + 1];
    if (t <= t1) return lerp(v0, v1, ease.inOutSine((t - t0) / (t1 - t0)));
  }
  return ks[ks.length - 1][1];
};

export const camera = (L: Layout, t: number) => {
  const aspect = L.w / L.h;
  const tan = Math.tan((VFOV * Math.PI) / 360);
  const dEnd = LOCKUP_W / (L.lockupFrac * 2 * tan * aspect); // top-down: wordmark fills lockupFrac of the width
  const up0 = T.rise[0];
  const up1 = T.rise[1];
  const el = keys(t, [[0, 21], [T.car.in, 27], [up0, 44], [up1, 90]]);
  const az = keys(t, [[0, -24], [T.car.in, -13], [up0, 9], [up1, 0]]);
  // after it lands: a slow push that comes to rest on the last frame
  const push = 1 - 0.035 * ease.outCubic(prog(t, up1, T.duration));
  const d = dEnd * keys(t, [[0, L.open], [T.car.in, L.open * 0.94], [up0 - 0.5, L.chase], [up1, 1]]) * push;
  // what it looks at: the two balls, then leaning toward the car, then the lockup centre
  const car = carPose(t);
  const lean = 0.3 * Math.sin(Math.PI * prog(t, T.car.in + 0.1, up0 + 0.3));
  const settle = keys(t, [[up0, 0], [up1, 1]]);
  const base = { x: LOCKUP_W / 2, y: lerp(BALL_R * 0.9, 0, settle), z: lerp(CY + 20, LOCKUP_H / 2, settle) };
  const target = { x: lerp(base.x, car.x, lean), y: base.y, z: lerp(base.z, car.z, lean) };
  const e = (el * Math.PI) / 180;
  const a = (az * Math.PI) / 180;
  return {
    fov: VFOV,
    position: [target.x + d * Math.sin(a) * Math.cos(e), target.y + d * Math.sin(e), target.z + d * Math.cos(a) * Math.cos(e)] as [number, number, number],
    target: [target.x, target.y, target.z] as [number, number, number],
    up: [-Math.sin(a) * Math.sin(e), Math.cos(e), -Math.cos(a) * Math.sin(e)] as [number, number, number],
  };
};

// ----------------------------------------------------------- motion blur
/** how many shutter samples a frame needs: more while something is quick */
export const blurSamples = (t: number) => {
  const dt = 1 / 240;
  const c0 = carPose(t - dt);
  const c1 = carPose(t + dt);
  const carSpeed = c0.visible ? Math.hypot(c1.x - c0.x, c1.z - c0.z) / (2 * dt) : 0;
  const r = Math.abs(racket(t + dt).angle - racket(t - dt).angle) / (2 * dt);
  const s0 = soccerBall(t - dt);
  const s1 = soccerBall(t + dt);
  const b0 = tennisBall(t - dt);
  const b1 = tennisBall(t + dt);
  const ball = Math.max(Math.hypot(s1.x - s0.x, s1.y - s0.y, s1.z - s0.z), Math.hypot(b1.x - b0.x, b1.y - b0.y, b1.z - b0.z)) / (2 * dt);
  const cam = t > T.rise[0] - 0.2 && t < T.rise[1] ? 3 : 1;
  const speed = Math.max(carSpeed, r * 12, ball, t > T.plane.in && t < T.plane.settle - 0.7 ? 2200 : 0); // world units per second
  return Math.max(cam, Math.min(8, Math.ceil(speed / 520)));
};
