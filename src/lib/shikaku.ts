// Tray tiles: cut the 7×7 tray into rectangles. Each rectangle holds exactly one number, and the number is how many squares
// the rectangle covers. Each day's tray has exactly one answer. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 7;
export const minMs = 6000;
export const HINT_MS = 10000;
export type Rect = { r: number; c: number; h: number; w: number };
export const cellsOf = (x: Rect) => [...Array(x.h * x.w).keys()].map((k) => (x.r + Math.floor(k / x.w)) * N + x.c + (k % x.w));
export const rectFrom = (a: number, b: number): Rect => {
  const r = Math.min(Math.floor(a / N), Math.floor(b / N)), c = Math.min(a % N, b % N);
  return { r, c, h: Math.abs(Math.floor(a / N) - Math.floor(b / N)) + 1, w: Math.abs((a % N) - (b % N)) + 1 };
};

/** Every rectangle that could belong to the number at `at`: the right size, and no other number inside */
export function options(clues: number[], at: number): Rect[] {
  const n = clues[at], out: Rect[] = [];
  const ar = Math.floor(at / N), ac = at % N;
  for (let h = 1; h <= n; h++) {
    if (n % h) continue;
    const w = n / h;
    if (h > N || w > N) continue;
    for (let r = ar - h + 1; r <= ar; r++) for (let c = ac - w + 1; c <= ac; c++) {
      if (r < 0 || c < 0 || r + h > N || c + w > N) continue;
      const x = { r, c, h, w };
      if (cellsOf(x).every((i) => i === at || !clues[i])) out.push(x);
    }
  }
  return out;
}
/** Up to `limit` answers, as the rectangle for each number (in order of the numbers' squares) */
export function answers(clues: number[], limit = 2): Rect[][] {
  const nums = clues.flatMap((v, i) => (v ? [i] : []));
  const opts = new Map(nums.map((i) => [i, options(clues, i)]));
  const used = Array(N * N).fill(false), pick = new Map<number, Rect>(), out: Rect[][] = [];
  const go = () => {
    if (out.length >= limit) return;
    // The first empty square: some number's rectangle has to cover it
    const free = used.indexOf(false);
    if (free < 0) { out.push(nums.map((i) => pick.get(i)!)); return; }
    for (const i of nums) {
      if (pick.has(i)) continue;
      for (const x of opts.get(i)!) {
        const cs = cellsOf(x);
        if (!cs.includes(free) || cs.some((k) => used[k])) continue;
        pick.set(i, x); cs.forEach((k) => { used[k] = true; });
        go();
        pick.delete(i); cs.forEach((k) => { used[k] = false; });
        if (out.length >= limit) return;
      }
    }
  };
  go();
  return out;
}

/** Today's tray: cut it into random rectangles, put each one's size in one of its squares, and keep it if there's one answer */
export function trayTilesFor(date: string): { clues: number[]; rects: Rect[] } {
  const rand = seededRand(`traytiles:${date}`);
  for (;;) {
    const owner = Array(N * N).fill(-1), rects: Rect[] = [];
    for (let i = 0; i < N * N; i++) {
      if (owner[i] !== -1) continue;
      const r = Math.floor(i / N), c = i % N;
      // Grow a rectangle from here: random size, but only over free squares, and not too big
      let w = 1; while (c + w < N && owner[r * N + c + w] === -1 && w < 4 && rand() < 0.6) w++;
      let h = 1; while (r + h < N && h < 4 && rand() < 0.55 && [...Array(w).keys()].every((k) => owner[(r + h) * N + c + k] === -1)) h++;
      const x = { r, c, h, w };
      cellsOf(x).forEach((k) => { owner[k] = rects.length; });
      rects.push(x);
    }
    if (rects.filter((x) => x.h * x.w === 1).length > 3 || rects.length < 9) continue;
    const clues = Array(N * N).fill(0);
    for (const x of rects) { const cs = cellsOf(x); clues[cs[Math.floor(rand() * cs.length)]] = x.h * x.w; }
    if (answers(clues).length === 1) return { clues, rects };
  }
}
/** Rectangles that are wrong: not exactly one number inside, or the wrong size for it */
export function problems(clues: number[], placed: Rect[]): Set<number> {
  const bad = new Set<number>();
  placed.forEach((x, k) => {
    const nums = cellsOf(x).filter((i) => clues[i]);
    if (nums.length !== 1 || clues[nums[0]] !== x.h * x.w) bad.add(k);
  });
  return bad;
}
export function isSolved(clues: number[], placed: Rect[]) {
  const seen = Array(N * N).fill(0);
  for (const x of placed) for (const i of cellsOf(x)) seen[i]++;
  return seen.every((n) => n === 1) && problems(clues, placed).size === 0;
}
