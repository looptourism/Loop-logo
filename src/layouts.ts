// One composition per format. Each is laid out for its own frame: nothing is
// cropped from another. All numbers are screen pixels unless noted.
export type Layout = {
  id: string;
  w: number;
  h: number;
  lockup: {
    left: number; top: number; width: number; // opening position of the LOOP wordmark
    endWidth: number; endCy: number; // settled: centred, lockup centre at h * endCy
  };
  road: { tipX: number; tipY: number; sx: number; sy: number }; // where the road's far tip sits, and its scale
  car: { startD: number; frac: number; rot: number }; // depth on the road (asset rows from the vanishing point)
  tennis: {
    side: 1 | -1; gripX: number; gripY: number; reach: number; // grip -> string bed
    rest: number; hit: number; // racket angles, degrees above horizontal
    ballD: number; groundY: number; vx: number; gScale: number;
  };
  soccer: { x: number; groundY: number; d: number; vx: number };
};

const CAR_START_D = 152; // asset row 88: just out of the bend, below the P

export const LANDSCAPE: Layout = {
  id: '16x9', w: 1920, h: 1080,
  lockup: { left: 560, top: 150, width: 800, endWidth: 860, endCy: 0.5 },
  road: { tipX: 1160, tipY: 475, sx: 1.5, sy: 1.9 },
  car: { startD: CAR_START_D, frac: 0.68, rot: 5 },
  tennis: { side: 1, gripX: 500, gripY: 905, reach: 215, rest: 84, hit: 52, ballD: 64, groundY: 935, vx: 2750, gScale: 1 },
  soccer: { x: 265, groundY: 935, d: 175, vx: -450 },
};

export const PORTRAIT: Layout = {
  id: '9x16', w: 1080, h: 1920,
  lockup: { left: 110, top: 800, width: 860, endWidth: 880, endCy: 0.5 },
  road: { tipX: 753, tipY: 1135, sx: 1.3, sy: 2.6 },
  car: { startD: CAR_START_D, frac: 0.7, rot: 0 },
  tennis: { side: 1, gripX: 520, gripY: 655, reach: 235, rest: 84, hit: 52, ballD: 70, groundY: 690, vx: 2300, gScale: 1.1 },
  soccer: { x: 255, groundY: 690, d: 190, vx: -480 },
};

export const SQUARE: Layout = {
  id: '1x1', w: 1080, h: 1080,
  lockup: { left: 200, top: 420, width: 640, endWidth: 700, endCy: 0.5 },
  road: { tipX: 681, tipY: 669, sx: 1.45, sy: 1.9 },
  car: { startD: CAR_START_D, frac: 0.68, rot: 5 },
  tennis: { side: 1, gripX: 385, gripY: 335, reach: 165, rest: 84, hit: 52, ballD: 50, groundY: 355, vx: 2000, gScale: 0.8 },
  soccer: { x: 185, groundY: 355, d: 140, vx: -370 },
};

export const LAYOUTS = [LANDSCAPE, PORTRAIT, SQUARE];
