// One composition per format. The lockup sits centred at its final size from
// the first frame; the action is choreographed in the lockup's own coordinates
// and re-fitted to each frame's edges, so nothing is a crop of another format.
export type Layout = {
  id: string;
  w: number;
  h: number;
  lockupWidth: number; // settled width of the LOOP wordmark, px
  lockupCy: number; // lockup centre as a fraction of frame height
  carWidth: number; // car size as it passes, in wordmark pixels
  zoom: number; // how much closer the camera starts, on the two balls
};

export const LANDSCAPE: Layout = { id: '16x9', w: 1920, h: 1080, lockupWidth: 860, lockupCy: 0.5, carWidth: 1750, zoom: 1.7 };
export const PORTRAIT: Layout = { id: '9x16', w: 1080, h: 1920, lockupWidth: 860, lockupCy: 0.47, carWidth: 2100, zoom: 1.22 };
export const SQUARE: Layout = { id: '1x1', w: 1080, h: 1080, lockupWidth: 780, lockupCy: 0.5, carWidth: 1900, zoom: 1.38 };

export const LAYOUTS = [LANDSCAPE, PORTRAIT, SQUARE];
