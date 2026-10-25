// Lamp switch: tapping a lamp flips it and the ones next to it. Turn them all off. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const SIZE = 5;
export const minMs = 3000;
export const HINT_MS = 10000;

export function press(lit: boolean[], i: number): boolean[] {
  const n = [...lit], r = Math.floor(i / SIZE), c = i % SIZE;
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) n[nr * SIZE + nc] = !n[nr * SIZE + nc];
  }
  return n;
}
export const allOff = (lit: boolean[]) => lit.every((x) => !x);

/** The fewest presses that turn everything off (try each top row, then chase the lights down), or null if it can't be done */
export function solve(lit: boolean[]): number[] | null {
  let best: number[] | null = null;
  for (let mask = 0; mask < 1 << SIZE; mask++) {
    let g = lit;
    const presses: number[] = [];
    for (let c = 0; c < SIZE; c++) if (mask & (1 << c)) { g = press(g, c); presses.push(c); }
    for (let r = 1; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (g[(r - 1) * SIZE + c]) { g = press(g, r * SIZE + c); presses.push(r * SIZE + c); }
    if (allOff(g) && (!best || presses.length < best.length)) best = presses;
  }
  return best;
}

/** Start dark and press some lamps, so every day's puzzle can be solved */
export function lampsFor(date: string): { lit: boolean[]; fewest: number } {
  const rand = seededRand(`lamps:${date}`);
  for (;;) {
    let lit: boolean[] = Array(SIZE * SIZE).fill(false);
    const n = 7 + Math.floor(rand() * 4);
    const cells = [...Array(SIZE * SIZE).keys()];
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    for (const i of cells.slice(0, n)) lit = press(lit, i);
    const s = solve(lit);
    if (s && s.length >= 5 && lit.filter(Boolean).length >= 6) return { lit, fewest: s.length };
  }
}
