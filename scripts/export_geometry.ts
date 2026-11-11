// Writes the loop's measured geometry for the Blender scene (blender/scene.py).
import { writeFileSync } from 'node:fs';
import A from '../src/assets.json';
import { BALL_R, CY, LEFT, LOCKUP_H, LOCKUP_W, LOOP_LEN, RIGHT, RING_R, RING_T, SLAB, loopPoint } from '../src/motion';

const centre: number[][] = [];
for (let s = 0; s <= LOOP_LEN; s += 4) {
  const p = loopPoint(s);
  centre.push([+p.x.toFixed(2), +p.z.toFixed(2)]);
}
writeFileSync(process.argv[2], JSON.stringify({
  LOCKUP_W, LOCKUP_H, BALL_R, CY, LEFT, RIGHT, RING_R, RING_T, SLAB, LOOP_LEN, centre, tagline: A.tagline, wordmark: A.wordmark,
}));
console.log('geometry written');
