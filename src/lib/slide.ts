// Slide puzzle: a menu photo cut into tiles with one gap. Pure, so the page, server and tests share it.
import { seededRand } from "./gameOrders.ts";

export const SLIDE_SIZES = { easy: 3, hard: 4 } as const;
export type SlideMode = keyof typeof SLIDE_SIZES;
export const slideMode = (v: unknown): SlideMode => (v === "hard" ? "hard" : "easy");
/** Fewest moves a real solve could take: every scramble starts at least this far away */
export const minMoves = (mode: SlideMode) => SLIDE_SIZES[mode] ** 2;
export const minMs = (mode: SlideMode) => (mode === "easy" ? 4000 : 12000);

/** A board is tile numbers by position; 0 is the gap. Solved = 1, 2, 3… with the gap last. */
export const solved = (n: number) => [...Array(n * n - 1).keys()].map((i) => i + 1).concat(0);
export const isSolved = (b: number[]) => b.every((t, i) => t === (i === b.length - 1 ? 0 : i + 1));

/** Positions next to the gap: the tiles that can slide */
export function movable(b: number[]) {
  const n = Math.round(Math.sqrt(b.length)), gap = b.indexOf(0);
  const r = Math.floor(gap / n), c = gap % n;
  return [r > 0 ? gap - n : -1, r < n - 1 ? gap + n : -1, c > 0 ? gap - 1 : -1, c < n - 1 ? gap + 1 : -1].filter((i) => i >= 0);
}
/** Slide the tile at `pos` into the gap (if it's next to it) */
export function slide(b: number[], pos: number) {
  if (!movable(b).includes(pos)) return b;
  const next = [...b], gap = b.indexOf(0);
  [next[gap], next[pos]] = [next[pos], 0];
  return next;
}

/** How far every tile is from home: no solve can take fewer moves than this */
export function distance(b: number[]) {
  const n = Math.round(Math.sqrt(b.length));
  return b.reduce((sum, t, pos) => (t ? sum + Math.abs(Math.floor(pos / n) - Math.floor((t - 1) / n)) + Math.abs((pos % n) - ((t - 1) % n)) : sum), 0);
}

/** Mix it up with real moves from solved, so it can always be solved, and well away from finished */
export function scramble(n: number, rand = Math.random, steps = n * n * 30) {
  for (;;) {
    let b = solved(n), last = -1;
    for (let i = 0; i < steps; i++) {
      const opts = movable(b).filter((p) => p !== last);
      const pos = opts[Math.floor(rand() * opts.length)];
      last = b.indexOf(0);
      b = slide(b, pos);
    }
    if (distance(b) >= n * n) return b;
  }
}

/** Today's picture: the same for everyone on a day */
export function pictureFor<T extends { id: string }>(items: T[], date: string): T | undefined {
  if (!items.length) return undefined;
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[Math.floor(seededRand(`slide:${date}`)() * sorted.length)];
}
