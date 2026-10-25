// Cake stacker: drop sliding layers on the cake, and whatever hangs over gets trimmed. Pure, so the page and tests share it.
export const WIDTH = 100;
export const START_W = 60;
export const PERFECT = 1.6; // this close counts as a perfect drop
export const REGROW = 3; // a perfect drop gives back a little width
export const STACKER_MAX = 999;
export type Layer = { x: number; w: number };

/** Drop the moving layer on the one below. null means it missed completely. */
export function drop(below: Layer, cur: Layer): (Layer & { perfect: boolean; cut: number }) | null {
  if (Math.abs(cur.x - below.x) <= PERFECT) {
    const w = Math.min(START_W, below.w + REGROW);
    return { x: Math.max(0, Math.min(WIDTH - w, below.x - (w - below.w) / 2)), w, perfect: true, cut: 0 };
  }
  const left = Math.max(below.x, cur.x), right = Math.min(below.x + below.w, cur.x + cur.w);
  if (right - left <= 0.5) return null;
  return { x: left, w: right - left, perfect: false, cut: cur.w - (right - left) };
}

/** Width units a second: it speeds up as the cake grows */
export const speedFor = (layer: number) => Math.min(150, 45 + layer * 3.2);

/** Move the sliding layer along, bouncing off the edges */
export function slide(x: number, dir: 1 | -1, w: number, speed: number, dt: number): { x: number; dir: 1 | -1 } {
  let nx = x + dir * speed * dt, nd = dir;
  const max = WIDTH - w;
  for (let i = 0; i < 4 && (nx < 0 || nx > max); i++) {
    if (nx > max) { nx = 2 * max - nx; nd = -1; }
    if (nx < 0) { nx = -nx; nd = 1; }
  }
  return { x: Math.max(0, Math.min(max, nx)), dir: nd };
}

export const FLAVOURS = ["#f6da9e", "#f9dce3", "#8c5a35", "#e6cfbd", "#e391a8", "#b97f52", "#9fae8d"];
