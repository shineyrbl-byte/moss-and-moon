// The puzzle of the week: a classic 9×9 sudoku, the same for everyone all week, with only one answer. Pure, so the page,
// server and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 9;
export const minMs = 60_000;
export const HINT_MS = 30_000;
const box = (i: number) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
export const peers = (i: number) => [...Array(81).keys()].filter((j) => j !== i && (Math.floor(j / 9) === Math.floor(i / 9) || j % 9 === i % 9 || box(j) === box(i)));
const PEERS = [...Array(81).keys()].map(peers);

/** Count answers (up to `limit`), always filling the square with the fewest options next */
export function countSolutions(g0: number[], limit = 2): number {
  const g = [...g0];
  let n = 0;
  const go = (): void => {
    if (n >= limit) return;
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      let used = 0;
      for (const j of PEERS[i]) used |= 1 << g[j];
      const mask = ~used & 0b1111111110, c = popcount(mask);
      if (c < bestCount) { best = i; bestMask = mask; bestCount = c; if (!c) return; }
    }
    if (best < 0) { n++; return; }
    for (let v = 1; v <= 9; v++) if (bestMask & (1 << v)) { g[best] = v; go(); g[best] = 0; if (n >= limit) return; }
  };
  go();
  return n;
}
const popcount = (x: number) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };

/** This week's puzzle: a random full grid, then numbers taken away while there's still one answer */
export function weeklyFor(week: string): { puzzle: number[]; answer: number[] } {
  const rand = seededRand(`sudoku9:${week}`);
  const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const answer = Array(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (PEERS[i].some((j) => answer[j] === v)) continue;
      answer[i] = v;
      if (fill(i + 1)) return true;
    }
    answer[i] = 0;
    return false;
  };
  fill(0);
  const puzzle = [...answer];
  // Take squares away in mirrored pairs, keeping one answer, down to about 28 clues
  for (const i of shuffle([...Array(41).keys()])) {
    if (puzzle.filter(Boolean).length <= 28) break;
    const j = 80 - i, a = puzzle[i], b = puzzle[j];
    puzzle[i] = 0; puzzle[j] = 0;
    if (countSolutions(puzzle) !== 1) { puzzle[i] = a; puzzle[j] = b; }
  }
  return { puzzle, answer };
}
/** Squares that clash with another in their row, column or box */
export const clashes = (g: number[]) => new Set([...g.keys()].filter((i) => g[i] && PEERS[i].some((j) => g[j] === g[i])));
export const isSolved = (g: number[]) => g.every((v) => v >= 1 && v <= 9) && clashes(g).size === 0;
/** Candidates for a square, for the pencil marks */
export const candidates = (g: number[], i: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => !PEERS[i].some((j) => g[j] === v));
