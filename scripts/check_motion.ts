// Numeric checks on the choreography. Run: npm run check
import { LAYOUTS } from '../src/layouts';
import {
  BALL_R, LEFT, LOCKUP_H, LOCKUP_W, LOOP_LEN, RIGHT, blurSamples, camera, carDistance, carPose, loopPoint, morph,
  racket, soccerBall, tennisBall, trackDrawn,
} from '../src/motion';
import T from '../src/timeline.json';

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failed++;
};
const STEP = 1 / 600; // ten samples per frame

const s = soccerBall(T.soccer.settle);
ok(Math.abs(s.x - LEFT.x) < 0.01 && Math.abs(s.z - LEFT.z) < 0.01 && Math.abs(s.y - BALL_R) < 0.01, 'football comes to rest centred in the left ring');
const b = tennisBall(T.tennis.settle);
ok(Math.abs(b.x - RIGHT.x) < 0.01 && Math.abs(b.z - RIGHT.z) < 0.01 && Math.abs(b.y - BALL_R) < 0.01, 'tennis ball comes to rest centred in the right ring');
ok(Math.abs(racket(T.tennis.hit).angle) < 1e-9, 'racket meets the ball exactly at the hit time');
ok(Math.abs(carDistance(T.car.onLoop)) < 1e-6 && Math.abs(carDistance(T.car.offLoop) - LOOP_LEN) < 1e-6, 'car does exactly one lap of the loop');
ok(trackDrawn(T.car.offLoop + 0.05) === 1, 'the loop is complete once the car has left it');
const a0 = loopPoint(0);
const a1 = loopPoint(LOOP_LEN);
ok(Math.hypot(a0.x - a1.x, a0.z - a1.z) < 0.01, 'the loop closes on itself');
ok(T.tennis.enter > T.soccer.bounces[0] && T.car.in > T.tennis.rest && T.morph[0] > T.car.onLoop, 'beats are staggered: football, serve, car, transformation');
ok(morph(T.morph[1]) === 1 && T.car.out <= T.letters[1], 'globes are in place and the car has gone before the lockup is complete');
ok(T.duration - T.tagline[1] >= 1.5, `full lockup with tagline holds ${(T.duration - T.tagline[1]).toFixed(2)}s`);

// no pops: nothing may jump between two adjacent tenth-frames
let worst = 0;
let at = 0;
let kink = 0;
for (let t = 0; t < T.duration; t += STEP) {
  const p = soccerBall(t);
  const q = soccerBall(t + STEP);
  const c = tennisBall(t);
  const d = tennisBall(t + STEP);
  const car0 = carPose(t);
  const car1 = carPose(t + STEP);
  const jump = Math.max(
    Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z),
    c.visible && d.visible ? Math.hypot(d.x - c.x, d.y - c.y, d.z - c.z) : 0,
    t > T.car.onLoop && t < T.car.offLoop ? Math.hypot(car1.x - car0.x, car1.z - car0.z) : 0, // on the loop; it sprints in and out off-frame
    Math.abs(racket(t + STEP).angle - racket(t).angle) * 6,
  );
  if (jump > worst) { worst = jump; at = t; }
  if (car0.visible && car1.visible) kink = Math.max(kink, Math.abs(Math.atan2(Math.sin(car1.yaw - car0.yaw), Math.cos(car1.yaw - car0.yaw))));
}
ok(worst < 16, `largest step in a tenth of a frame: ${worst.toFixed(2)} units (at ${at.toFixed(2)}s)`);
ok(kink < 0.03, `car never snaps its heading (largest turn in a tenth of a frame: ${((kink * 180) / Math.PI).toFixed(2)} deg)`);
ok([5.5, 6.0, 6.9].every((t) => blurSamples(t) === 1), 'the hold needs no motion blur');

for (const L of LAYOUTS) {
  const end = camera(L, T.duration);
  ok(Math.abs(end.position[0] - LOCKUP_W / 2) < 0.01 && Math.abs(end.position[2] - LOCKUP_H / 2) < 0.01, `${L.id}: camera ends straight above the centre of the lockup`);
  let cam = 0;
  for (let t = 0; t < T.duration; t += STEP) {
    const p = camera(L, t).position;
    const q = camera(L, t + STEP).position;
    cam = Math.max(cam, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
  }
  ok(cam < 25, `${L.id}: camera never jumps (largest step ${cam.toFixed(1)} units)`);
}
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
