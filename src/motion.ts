// Every pose in the film is a pure function of time (seconds) and layout.
// Nothing here knows about frames, so motion blur can sample between frames.
import A from './assets.json';
import T from './timeline.json';
import type { Layout } from './layouts';

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** progress of t through [a, b], clamped */
export const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Easing by role. No linear moves anywhere.
export const ease = {
  inOutSine: (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k),
  inOutCubic: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outCubic: (k: number) => 1 - Math.pow(1 - k, 3),
  outQuint: (k: number) => 1 - Math.pow(1 - k, 5),
  /** eases away gently, then a long soft landing: the lockup settling into place */
  settle: (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * (1 - Math.pow(1 - k, 1.8))),
};

// ------------------------------------------------------------------ scene
export const sceneOpacity = (t: number) => ease.inOutSine(prog(t, T.fadeIn[0], T.fadeIn[1]));
export const propsOpacity = (t: number) => 1 - ease.inOutSine(prog(t, T.props.fadeOut[0], T.props.fadeOut[1]));

// ----------------------------------------------------------------- lockup
export const LOCKUP_W = A.wordmark.w;
export const LOCKUP_H = A.tagline.dy + A.tagline.h;

export const lockupPose = (L: Layout, t: number) => {
  const k = ease.settle(prog(t, T.settle[0], T.settle[1]));
  // the long tail: a last 1 % of growth that comes to rest on the final frame
  const tail = 1 + 0.01 * ease.outCubic(prog(t, T.hold[0], T.hold[1]));
  const wOpen = L.lockup.width;
  const wEnd = L.lockup.endWidth;
  const width = wOpen * Math.pow(wEnd / wOpen, k) * tail; // scale in log space
  const s = width / LOCKUP_W;
  const cxOpen = L.lockup.left + wOpen / 2;
  const cyOpen = L.lockup.top + (LOCKUP_H * wOpen) / LOCKUP_W / 2;
  const cx = lerp(cxOpen, L.w / 2, k);
  const cy = lerp(cyOpen, L.h * L.lockup.endCy, k);
  return { x: cx - (LOCKUP_W * s) / 2, y: cy - (LOCKUP_H * s) / 2, s };
};

// ------------------------------------------------------------------- road
const R = A.road;
/** asset pixel -> screen pixel */
export const roadPoint = (L: Layout, ax: number, ay: number) => ({
  x: L.road.tipX + (ax - R.tip[0]) * L.road.sx,
  y: L.road.tipY + (ay - R.tip[1]) * L.road.sy,
});
export const roadBox = (L: Layout) => {
  const p = roadPoint(L, R.x0, R.y0);
  return { x: p.x, y: p.y, w: R.w * L.road.sx, h: R.h * L.road.sy };
};

// -------------------------------------------------------------------- car
// The car rides the centre line of the road's near straight. "d" is its
// distance from the vanishing point in asset rows; size grows with d, and the
// car covers ground at a steady pace in depth, so on screen it accelerates
// toward the viewer exactly as perspective dictates.
const CUT_D = R.assetCut - R.vp[1];
export const CAR_ANCHOR = { x: 0.5, y: 0.6 }; // footprint centre inside the sprite

export const carAtDepth = (L: Layout, d: number) => {
  const ax = R.vp[0] + ((R.cutCentre - R.vp[0]) * d) / CUT_D;
  const p = roadPoint(L, ax, R.vp[1] + d);
  const roadW = ((2 * R.cutHalfWidth * d) / CUT_D) * L.road.sx;
  const w = roadW * L.car.frac;
  return { x: p.x, y: p.y, w, h: (w * A.car.h) / A.car.w };
};

const carOffFrame = (L: Layout, d: number) => {
  const c = carAtDepth(L, d);
  const m = 0.12 * c.w; // shadow and blur margin
  const left = c.x - c.w * CAR_ANCHOR.x - m;
  const top = c.y - c.h * CAR_ANCHOR.y - m;
  return left > L.w || top > L.h || left + c.w + 2 * m < 0 || top + c.h + 2 * m < 0;
};

/** depth at which the car has completely left this format's frame */
export const carExitDepth = (L: Layout) => {
  let d = L.car.startD;
  while (!carOffFrame(L, d) && d < 5000) d += 1;
  return d;
};

const CAR_BACK = 0.045; // anticipation: sinks back up the road before launching

export const carPose = (L: Layout, t: number) => {
  const d0 = L.car.startD;
  const zEnd = d0 / carExitDepth(L);
  let z = 1; // relative distance from the viewer
  let pitch = 0;
  if (t > T.car.settle && t <= T.car.go) {
    const k = prog(t, T.car.settle, T.car.go);
    z = 1 + CAR_BACK * ease.inOutSine(k);
    pitch = 1.1 * Math.sin(Math.PI * k) * k; // nose lifts a touch as it loads up
  } else if (t > T.car.go) {
    const k = (t - T.car.go) / (T.car.out - T.car.go);
    z = 1 + CAR_BACK - (1 + CAR_BACK - zEnd) * Math.pow(Math.min(k, 1.2), 1.7);
    pitch = -1.6 * Math.sin(Math.PI * clamp01(k / 0.5)) * (1 - clamp01(k / 0.5)); // squat under power
  }
  z = Math.max(z, zEnd * 0.5);
  const c = carAtDepth(L, d0 / z);
  return { ...c, rot: L.car.rot + pitch, visible: t < T.car.out + 0.05 };
};

// ----------------------------------------------------------------- tennis
// Angles are the direction grip -> head in degrees above the horizontal,
// on the side the racket hits toward (L.tennis.side = +1 right, -1 left).
const RK = A.racket;
const RK_DX = RK.grip[0] - RK.strings[0];
const RK_DY = RK.grip[1] - RK.strings[1];
export const RACKET_REACH = Math.hypot(RK_DX, RK_DY); // grip -> string bed, sprite pixels
export const RACKET_NATIVE_DEG = (Math.atan2(RK_DY, RK_DX) * 180) / Math.PI; // the art leans left

const WIND = 40; // degrees of wind-back
const FOLLOW = 62; // degrees of follow-through past the contact point

export const racketAngle = (L: Layout, t: number) => {
  const { rest, hit } = L.tennis;
  const top = rest + WIND;
  const tt = T.tennis;
  if (t <= tt.wind) return rest;
  if (t <= tt.swing) return rest + WIND * ease.inOutCubic(prog(t, tt.wind, tt.swing));
  const swingT = tt.hit - tt.swing;
  if (t <= tt.hit) {
    const k = (t - tt.swing) / swingT;
    return top - (top - hit) * k * k; // accelerates all the way into the ball
  }
  const v = (2 * (top - hit)) / swingT; // head speed at contact, deg/s
  const followT = (3 * FOLLOW) / v; // decelerate from exactly that speed: no kink at contact
  const end = hit - FOLLOW;
  if (t <= tt.hit + followT) return hit - FOLLOW * ease.outCubic((t - tt.hit) / followT);
  return end + (rest - end) * ease.inOutCubic(prog(t, tt.hit + followT, tt.rest));
};

export const racketPose = (L: Layout, t: number) => {
  const a = racketAngle(L, t);
  // CSS rotation that takes the (possibly mirrored) art to angle a
  const rot = (RACKET_NATIVE_DEG - a) * L.tennis.side;
  return { x: L.tennis.gripX, y: L.tennis.gripY, rot, scale: L.tennis.reach / RACKET_REACH };
};

const TENNIS_G = 2600; // px/s^2, scaled with the layout
const TENNIS_BOUNCE = 0.72;

export const tennisBall = (L: Layout, t: number) => {
  const { side, hit, reach, gripX, gripY, ballD, groundY, vx } = L.tennis;
  const r = ballD / 2;
  const rad = (hit * Math.PI) / 180;
  const x0 = gripX + side * reach * Math.cos(rad);
  const y0 = gripY - reach * Math.sin(rad);
  const g = TENNIS_G * L.tennis.gScale;
  const fall = T.tennis.ground - T.tennis.hit;
  const drop = groundY - r - y0;
  const vy0 = (drop - 0.5 * g * fall * fall) / fall;
  let x = x0;
  let y = y0;
  let spin = 0;
  let squash = 0;
  if (t > T.tennis.hit) {
    const k = t - T.tennis.hit;
    spin = side * 620 * k;
    if (t <= T.tennis.ground) {
      x = x0 + side * vx * k;
      y = y0 + vy0 * k + 0.5 * g * k * k;
    } else {
      const u = t - T.tennis.ground;
      const vy1 = -(vy0 + g * fall) * TENNIS_BOUNCE;
      x = x0 + side * vx * fall + side * vx * 0.94 * u;
      y = groundY - r + vy1 * u + 0.5 * g * u * u;
    }
    const q = (t - T.tennis.ground) / 0.022;
    squash = 0.24 * Math.exp(-q * q); // a two-frame flattening on the ground
  }
  const height = groundY - r - y;
  const visible = x > -ballD && x < L.w + ballD && y > -ballD && y < L.h + ballD;
  return { x, y, r, spin, squash, height, visible, groundY };
};

// ----------------------------------------------------------------- soccer
// Landings sit on the beat; air time and gravity fix every hop height.
const SOCCER_G = 5500; // px/s^2 for a 170 px ball: close to a real ball at that scale

export const soccerBall = (L: Layout, t: number) => {
  const s = T.soccer;
  const { x: x0, groundY, d, vx } = L.soccer;
  const r = d / 2;
  const g = (SOCCER_G * d) / 170;
  const c = s.contact;
  const hops = [
    { up: s.up1, down: s.land1 },
    { up: s.land1 + c, down: s.land2 },
    { up: s.land2 + c, down: s.land3 },
    { up: s.land3 + c, down: s.land3 + c + 0.6 },
  ];
  const travelFrom = hops[2].up;
  let h = 0;
  let sy = 1;
  const STRETCH = 0.05;
  const SQUASH = 0.12;
  if (t > s.crouch && t <= s.up1) {
    // anticipation: press into the ground, then spring
    const k = prog(t, s.crouch, s.up1);
    sy = k < 0.68 ? 1 - 0.13 * ease.inOutSine(k / 0.68) : lerp(0.87, 1 + STRETCH, Math.pow((k - 0.68) / 0.32, 2));
  }
  for (const hop of hops) {
    if (t > hop.up && t <= hop.down) {
      const air = hop.down - hop.up;
      const k = t - hop.up;
      const v0 = (g * air) / 2;
      h = v0 * k - 0.5 * g * k * k;
      const v = Math.abs(v0 - g * k) / v0;
      sy = 1 + STRETCH * v * v;
    } else if (t > hop.down && t <= hop.down + c && hop !== hops[3]) {
      sy = 1 + STRETCH - (SQUASH + STRETCH) * Math.sin(Math.PI * prog(t, hop.down, hop.down + c));
    }
  }
  const sx = 1 + (1 - sy) * 0.6;
  let x = x0;
  let spin = 0;
  if (t > travelFrom) {
    const k = t - travelFrom;
    x = x0 + vx * k;
    const a = 0.07; // spin eases in instead of snapping on
    spin = ((vx / r) * (k - a * (1 - Math.exp(-k / a))) * 180) / Math.PI;
  }
  const y = groundY - r * sy - h;
  const visible = x > -d && x < L.w + d && t < s.out + 0.3;
  return { x, y, r, sx, sy, spin, height: h, visible, groundY };
};

// ----------------------------------------------------------- motion blur
/** largest on-screen travel (px) of anything during one shutter interval */
export const travel = (L: Layout, t: number, shutter: number) => {
  const a = t - shutter / 2;
  const b = t + shutter / 2;
  let m = 0;
  const far = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
  const c0 = carPose(L, a);
  const c1 = carPose(L, b);
  if (c0.visible) m = Math.max(m, far(c0, c1) + Math.abs(c1.w - c0.w) / 2);
  const t0 = tennisBall(L, a);
  if (t0.visible) m = Math.max(m, far(t0, tennisBall(L, b)));
  const s0 = soccerBall(L, a);
  const s1 = soccerBall(L, b);
  if (s0.visible) m = Math.max(m, far(s0, s1) + (Math.abs(s1.spin - s0.spin) * Math.PI * s0.r) / 180);
  const head = (L.tennis.reach * 1.45 * Math.PI) / 180;
  m = Math.max(m, Math.abs(racketAngle(L, b) - racketAngle(L, a)) * head);
  return m;
};
