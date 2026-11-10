// Numeric checks on the choreography, for every format. Run: npm run check
import { LAYOUTS } from '../src/layouts';
import { CAR_ANCHOR, carPose, lockupPose, LOCKUP_W, racketAngle, soccerBall, tennisBall, travel } from '../src/motion';
import T from '../src/timeline.json';

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failed++;
};
const STEP = 1 / 600; // ten samples per frame

for (const L of LAYOUTS) {
  console.log(`\n${L.id}  ${L.w}x${L.h}`);

  // car: in frame at the start, fully gone at its out time
  const c0 = carPose(L, 0);
  ok(c0.x - c0.w / 2 > 0 && c0.x + c0.w / 2 < L.w && c0.y + c0.h * 0.4 < L.h, `car starts fully in frame (${Math.round(c0.w)} px wide)`);
  const c1 = carPose(L, T.car.out);
  const left = c1.x - c1.w * CAR_ANCHOR.x;
  const top = c1.y - c1.h * CAR_ANCHOR.y;
  ok(left > L.w || top > L.h || left + c1.w < 0, `car is out of frame by ${T.car.out}s`);

  // tennis ball: touches the ground exactly once while it is on screen
  let touches = 0;
  let wasDown = false;
  let exit = -1;
  for (let t = T.tennis.hit; t < T.duration; t += STEP) {
    const b = tennisBall(L, t);
    if (!b.visible) { exit = t; break; }
    const down = b.height < 0.5;
    if (down && !wasDown) touches++;
    wasDown = down;
  }
  ok(touches === 1, `tennis ball touches the ground once (${touches})`);
  ok(exit > 0 && exit < T.soccer.up1, `tennis ball leaves at ${exit.toFixed(2)}s, before the soccer ball hops`);
  ok(Math.abs(racketAngle(L, T.tennis.rest) - L.tennis.rest) < 1e-6, 'racket is back at rest');

  // soccer: two hops in place, then travels out
  const a = soccerBall(L, T.soccer.land2 + T.soccer.contact / 2);
  ok(a.x === L.soccer.x, 'soccer ball has not moved sideways through its two hops');
  const land3 = soccerBall(L, T.soccer.land3);
  ok(land3.x + land3.r > 0, `soccer ball's travelling bounce lands in view (x=${Math.round(land3.x)})`);
  const gone = soccerBall(L, T.props.fadeOut[1]);
  ok(gone.x + gone.r < 0, 'soccer ball is out before the props finish fading');

  // lockup: ends centred, inside the frame
  const end = lockupPose(L, T.duration);
  const w = LOCKUP_W * end.s;
  ok(Math.abs(end.x + w / 2 - L.w / 2) < 0.01, `lockup ends centred, ${Math.round(w)} px wide (${Math.round((100 * w) / L.w)} % of frame)`);
  ok(T.duration - T.settle[1] >= 1.5, `lockup holds ${(T.duration - T.settle[1]).toFixed(2)}s`);

  // no pops: nothing may jump between two adjacent tenth-frames
  let worst = 0;
  let at = 0;
  for (let t = 0; t < T.duration; t += STEP) {
    const p = lockupPose(L, t);
    const q = lockupPose(L, t + STEP);
    const s0 = soccerBall(L, t);
    const s1 = soccerBall(L, t + STEP);
    const jump = Math.max(
      Math.hypot(q.x - p.x, q.y - p.y),
      Math.abs(racketAngle(L, t + STEP) - racketAngle(L, t)) * 4,
      s0.visible && s1.visible ? Math.abs(s1.y - s0.y) : 0,
    );
    if (jump > worst) { worst = jump; at = t; }
  }
  ok(worst < 8, `largest step in a tenth of a frame: ${worst.toFixed(2)} px (at ${at.toFixed(2)}s)`);

  // stagger: only one action at speed at a time
  const busy = (t: number) => travel(L, t, 1 / T.fps) > 1.5;
  const stillAt = [0.3, T.fadeIn[1], 6.0, 6.9];
  ok(stillAt.every((t) => !busy(t)), 'opening and hold are still');
}
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
