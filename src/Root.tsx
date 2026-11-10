import React from 'react';
import { Composition } from 'remotion';
import { LAYOUTS } from './layouts';
import { Sting, StingSub, subFramePlan } from './Sting';
import T from './timeline.json';

const FRAMES = Math.round(T.duration * T.fps);

export const Root: React.FC = () => (
  <>
    {LAYOUTS.map((layout) => {
      const plan = subFramePlan(layout, T.fps, FRAMES);
      return (
        <React.Fragment key={layout.id}>
          {/* Loop16x9, Loop9x16, Loop1x1: sharp preview with sound (Remotion Studio) */}
          <Composition
            id={`Loop${layout.id}`} component={Sting} width={layout.w} height={layout.h}
            fps={T.fps} durationInFrames={FRAMES} defaultProps={{ layout }}
          />
          {/* ...Sub: the sub-frame stream the motion-blurred master is averaged from */}
          <Composition
            id={`Loop${layout.id}Sub`} component={StingSub} width={layout.w} height={layout.h}
            fps={T.fps} durationInFrames={plan.times.length} defaultProps={{ layout, times: plan.times }}
          />
        </React.Fragment>
      );
    })}
  </>
);
