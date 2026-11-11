// Numeric checks on the choreography, for every format. Run: npm run check
import { LAYOUTS } from '../src/layouts';
import { sampleCount } from '../src/Sting';
import {
  BALL_R, GROUND, HIT, LEFT, LOCKUP_W, RIGHT, carPose, frameEdges, lockupPose, racketRot, soccerBall, tennisBall,
} from '../src/motion';
import T from '../src/timeline.json';

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failed++;
};
const STEP = 1 / 600; // ten samples per frame

for (const L of LAYOUTS) {
  console.log(`\n${L.id}  ${L.w}x${L.h}`);
  const e0 = frameEdges(L, 0);

  // balls: start out of frame, end exactly centred in their rings
  const s0 = soccerBall(L, 0);
  ok(s0.y + BALL_R < e0.top || s0.x + BALL_R < e0.left, 'soccer ball starts out of frame');
  const s1 = soccerBall(L, T.soccer.settle);
  ok(Math.abs(s1.x - LEFT.x) < 0.01 && Math.abs(s1.y - (GROUND - BALL_R)) < 0.01, 'soccer ball comes to rest centred in the left ring');
  const t1 = tennisBall(L, T.tennis.settle);
  ok(Math.abs(t1.x - RIGHT.x) < 0.01 && Math.abs(t1.y - (GROUND - BALL_R)) < 0.01, 'tennis ball comes to rest centred in the right ring');
  ok(HIT.x + BALL_R < e0.right && HIT.y - BALL_R > e0.top, 'the serve is struck fully inside the frame');
  ok(tennisBall(L, T.tennis.toss + 0.001).y - BALL_R > e0.bottom, 'tennis ball is tossed in from below the frame');
  ok(T.tennis.toss > T.soccer.bounces[0] && T.draw[0] >= T.tennis.bounces[1] && T.car.in >= T.draw[1], 'beats are staggered: soccer, serve, loop, car');

  // car: out of frame when it appears and when it is removed
  for (const [name, t] of [['in', T.car.in + 0.001], ['out', T.car.out - 0.001]] as const) {
    const c = carPose(L, t);
    const e = frameEdges(L, t);
    const off = c.x - c.w / 2 > e.right || c.x + c.w / 2 < e.left || c.y - c.h / 2 > e.bottom || c.y + c.h / 2 < e.top;
    ok(off, `car is out of frame at its ${name} time`);
  }

  // lockup: centred, readable, held
  const end = lockupPose(L, T.duration);
  const w = LOCKUP_W * end.s;
  ok(Math.abs(end.x + w / 2 - L.w / 2) < 0.01, `lockup ends centred, ${Math.round(w)} px wide (${Math.round((100 * w) / L.w)} % of frame)`);
  ok(T.duration - T.tagline[1] >= 1.5, `full lockup with tagline holds ${(T.duration - T.tagline[1]).toFixed(2)}s`);

  // no pops: nothing may jump between two adjacent tenth-frames
  let worst = 0;
  let at = 0;
  for (let t = 0; t < T.duration; t += STEP) {
    const p = lockupPose(L, t);
    const q = lockupPose(L, t + STEP);
    const a = soccerBall(L, t);
    const b = soccerBall(L, t + STEP);
    const c = tennisBall(L, t);
    const d = tennisBall(L, t + STEP);
    const jump = Math.max(
      Math.hypot(q.x - p.x, q.y - p.y),
      Math.hypot(b.x - a.x, b.y - a.y) * p.s,
      t > T.tennis.hit ? Math.hypot(d.x - c.x, d.y - c.y) * p.s : 0,
      Math.abs(racketRot(t + STEP) - racketRot(t)) * 4,
    );
    if (jump > worst) { worst = jump; at = t; }
  }
  ok(worst < 8, `largest step in a tenth of a frame: ${worst.toFixed(2)} px (at ${at.toFixed(2)}s)`);
  ok([5.5, 6.0, 6.9].every((t) => sampleCount(L, t, T.fps) === 1), 'the hold is still enough to need no motion blur');
}
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
