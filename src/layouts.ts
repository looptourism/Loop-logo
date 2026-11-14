// One composition per format: its own camera framing, never a crop of another.
export type Layout = {
  id: string;
  w: number;
  h: number;
  lockupFrac: number; // settled width of the wordmark as a fraction of frame width
  open: number; // opening camera distance relative to the final one
  chase: number; // camera distance while it follows the car
  plane: { x: number; z: number; scale: number }; // where the aeroplane ends up, beside the lockup
};

export const LANDSCAPE: Layout = { id: '16x9', w: 1920, h: 1080, lockupFrac: 0.46, open: 0.62, chase: 0.52, plane: { x: 2150, z: -260, scale: 0.62 } };
export const PORTRAIT: Layout = { id: '9x16', w: 1080, h: 1920, lockupFrac: 0.8, open: 0.8, chase: 0.62, plane: { x: 1120, z: -820, scale: 0.7 } };
export const SQUARE: Layout = { id: '1x1', w: 1080, h: 1080, lockupFrac: 0.72, open: 0.72, chase: 0.58, plane: { x: 1230, z: -430, scale: 0.55 } };

export const LAYOUTS = [LANDSCAPE, PORTRAIT, SQUARE];
