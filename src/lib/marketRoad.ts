// Cross the market road: hop from the bus stop to the café door across busy lanes of scooters, autos and handcarts,
// with a pavement to rest on halfway. Fill all four café doors to go up a level, where everything's quicker.
// Lanes move with time, so where things are is worked out from the clock. Pure, so the page and tests share it.
export const W = 9;
export const ROWS = 11; // 0 = café doors, 5 = pavement, 10 = bus stop
export const DOORS = [1, 3, 5, 7];
export const ROAD_MAX = 99_990;
export type Lane = { row: number; speed: number; len: number; gap: number; offset: number; kind: string };

/** The lanes for a level: speeds go up 15% a level */
export function lanes(level: number): Lane[] {
  const k = 1 + (level - 1) * 0.15;
  return [
    { row: 1, speed: -1.1 * k, len: 2, gap: 3, offset: 0, kind: "🛒" },
    { row: 2, speed: 1.5 * k, len: 1, gap: 2, offset: 1, kind: "🐄" },
    { row: 3, speed: -0.9 * k, len: 3, gap: 4, offset: 2, kind: "🧺" },
    { row: 4, speed: 1.9 * k, len: 1, gap: 3, offset: 0, kind: "🚲" },
    { row: 6, speed: -2.1 * k, len: 1, gap: 3, offset: 1, kind: "🛵" },
    { row: 7, speed: 1.2 * k, len: 2, gap: 3, offset: 3, kind: "🛺" },
    { row: 8, speed: -1.6 * k, len: 2, gap: 4, offset: 0, kind: "🚗" },
    { row: 9, speed: 0.8 * k, len: 3, gap: 4, offset: 2, kind: "🚌" },
  ];
}
const mod = (a: number, m: number) => ((a % m) + m) % m;
/** Where each thing in a lane is at time t (seconds): its left edge, from 0 to the lane's loop length */
export function positions(l: Lane, t: number): number[] {
  // The loop is at least the road plus one vehicle, so things drive fully off one side before coming back on the other
  const count = Math.ceil((W + l.len) / (l.len + l.gap)), loop = count * (l.len + l.gap);
  return [...Array(count).keys()].map((i) => mod(l.offset + i * (l.len + l.gap) + l.speed * t, loop) - l.len);
}
/** Does something in this lane cover column `col` at time t? Things fill [x, x + len), with a little forgiveness. */
export function hits(l: Lane, col: number, t: number) {
  return positions(l, t).some((x) => col + 0.82 > x + 0.1 && col + 0.18 < x + l.len - 0.1);
}

export type State = { r: number; c: number; lives: number; score: number; best: number; filled: number[]; level: number; over: boolean; startedAt: number };
export const newState = (t = 0): State => ({ r: ROWS - 1, c: Math.floor(W / 2), lives: 3, score: 0, best: ROWS - 1, filled: [], level: 1, over: false, startedAt: t });
export type Dir = "up" | "down" | "left" | "right";
/** Hop one square. Points for every new row reached on this crossing, and 100 for getting in a café door. */
export function hop(s: State, d: Dir): State {
  if (s.over) return s;
  const r = s.r + (d === "up" ? -1 : d === "down" ? 1 : 0), c = s.c + (d === "left" ? -1 : d === "right" ? 1 : 0);
  if (r < 0 || r >= ROWS || c < 0 || c >= W) return s;
  if (r === 0) {
    // Only the doors are open, and each takes one customer
    if (!DOORS.includes(c) || s.filled.includes(c)) return s;
    const filled = [...s.filled, c];
    const levelUp = filled.length === DOORS.length;
    return { ...s, r: ROWS - 1, c: Math.floor(W / 2), best: ROWS - 1, score: s.score + 10 + 100 + (levelUp ? 500 : 0), filled: levelUp ? [] : filled, level: levelUp ? s.level + 1 : s.level };
  }
  const forward = r < s.best;
  return { ...s, r, c, best: Math.min(s.best, r), score: s.score + (forward ? 10 : 0) };
}
/** Check for a bump at time t; a bump costs a life and sends you back to the bus stop */
export function check(s: State, t: number): { s: State; bumped: boolean } {
  if (s.over) return { s, bumped: false };
  const lane = lanes(s.level).find((l) => l.row === s.r);
  if (!lane || !hits(lane, s.c, t)) return { s, bumped: false };
  const lives = s.lives - 1;
  return { s: { ...s, lives, over: lives <= 0, r: ROWS - 1, c: Math.floor(W / 2), best: ROWS - 1 }, bumped: true };
}
