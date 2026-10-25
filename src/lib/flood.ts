// Flood the cup: change the corner's colour to soak up its neighbours until the grid is one colour. Pure, so the page, server and tests share it.
import { seededRand } from "./gameOrders.ts";

export const SIZE = 12;
export const COLOURS = [
  { name: "Espresso", hex: "#5a3a2c", sym: "☕" },
  { name: "Caramel", hex: "#d79a5e", sym: "🍯" },
  { name: "Rose", hex: "#e391a8", sym: "🌸" },
  { name: "Matcha", hex: "#8ea870", sym: "🍵" },
  { name: "Cream", hex: "#f3e3c3", sym: "🥛" },
  { name: "Berry", hex: "#7d4d8f", sym: "🫐" },
];
/** Fewest moves anyone could possibly need: every other colour has to be picked once */
export const MIN_MOVES = COLOURS.length - 1;
export const MAX_MOVES = 99;

export function gridFor(date: string): number[] {
  const rand = seededRand(`flood:${date}`);
  for (;;) {
    const g = Array.from({ length: SIZE * SIZE }, () => Math.floor(rand() * COLOURS.length));
    if (new Set(g).size === COLOURS.length) return g;
  }
}
/** The squares joined to the top-left corner */
export function region(g: number[]): Set<number> {
  const seen = new Set<number>([0]), stack = [0];
  while (stack.length) {
    const i = stack.pop()!, r = Math.floor(i / SIZE), c = i % SIZE;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc, j = nr * SIZE + nc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !seen.has(j) && g[j] === g[0]) { seen.add(j); stack.push(j); }
    }
  }
  return seen;
}
export function flood(g: number[], colour: number): number[] {
  if (colour === g[0]) return g;
  const r = region(g);
  return g.map((x, i) => (r.has(i) ? colour : x));
}
export const isDone = (g: number[]) => g.every((x) => x === g[0]);

/** A good-but-not-perfect solver, two moves ahead: its count is the par to beat */
export function par(start: number[]): number {
  let g = start, moves = 0;
  while (!isDone(g) && moves < MAX_MOVES) {
    let best = -1, bestSize = -1;
    for (let c = 0; c < COLOURS.length; c++) {
      if (c === g[0]) continue;
      const a = flood(g, c);
      let size = region(a).size * 100;
      if (isDone(a)) size = Infinity;
      else for (let d = 0; d < COLOURS.length; d++) if (d !== c) size = Math.max(size, region(flood(a, d)).size * 100 + region(a).size);
      if (size > bestSize) { bestSize = size; best = c; }
    }
    g = flood(g, best); moves++;
  }
  return moves;
}

/** The board keeps fewest moves first, then quickest time, packed into one number */
export const packScore = (moves: number, ms: number) => moves * 1_000_000 + Math.min(999_999, Math.max(0, Math.round(ms)));
export const unpackScore = (v: number) => ({ moves: Math.floor(v / 1_000_000), ms: v % 1_000_000 });
