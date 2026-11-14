// Writes the sub-frame plan (samples per output frame) for one format.
import { writeFileSync } from 'node:fs';
import { LAYOUTS } from '../src/layouts';
import { subFramePlan } from '../src/Sting';
import T from '../src/timeline.json';

const id = process.argv[2];
const layout = LAYOUTS.find((l) => l.id === id);
if (!layout) throw new Error(`unknown format ${id}`);
const plan = subFramePlan(T.fps, Math.round(T.duration * T.fps));
writeFileSync(process.argv[3], JSON.stringify({ fps: T.fps, w: layout.w, h: layout.h, groups: plan.groups }));
console.log(`${id}: ${plan.groups.length} frames from ${plan.times.length} sub-frames, up to ${Math.max(...plan.groups)} per frame`);
