// Mini sudoku: 6×6 with café pictures. Every row, column and 2×3 box has each picture once.
// Pure, so the page, server and tests share it. Puzzles always have exactly one answer.
import { seededRand } from "./gameOrders.ts";

export const N = 6;
export const ICONS = ["☕", "🥐", "🍰", "🍵", "🧋", "🍪"];
export const ICON_NAMES = ["coffee", "croissant", "cake", "tea", "bubble tea", "cookie"];
export const SUDOKU_MODES = { easy: 16, hard: 11 } as const; // how many pictures you start with (at most)
export type SudokuMode = keyof typeof SUDOKU_MODES;
export const sudokuMode = (v: unknown): SudokuMode => (v === "hard" ? "hard" : "easy");
export const minMs = (mode: SudokuMode) => (mode === "easy" ? 15000 : 25000);

const box = (p: number) => Math.floor(Math.floor(p / N) / 2) * 2 + Math.floor((p % N) / 3);
/** Cells that share a row, column or box with this one */
export const peers = (p: number) => [...Array(N * N).keys()].filter((q) => q !== p && (Math.floor(q / N) === Math.floor(p / N) || q % N === p % N || box(q) === box(p)));

/** How many answers a board has (stops counting at 2). 0 = empty, 1 to 6 = a picture. */
export function countSolutions(b: number[], limit = 2): number {
  const p = b.indexOf(0);
  if (p < 0) return 1;
  const used = new Set(peers(p).map((q) => b[q]));
  let n = 0;
  for (let v = 1; v <= N && n < limit; v++) {
    if (used.has(v)) continue;
    b[p] = v;
    n += countSolutions(b, limit - n);
  }
  b[p] = 0;
  return n;
}

const shuffle = <T,>(a: T[], rand: () => number) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

/** Today's puzzle and its answer: the same for everyone on a day */
export function sudokuFor(date: string, mode: SudokuMode) {
  const rand = seededRand(`sudoku:${date}:${mode}`);
  // A known-good pattern, then shuffled in ways that keep it valid
  const digits = shuffle([1, 2, 3, 4, 5, 6], rand);
  const rows = shuffle([0, 1, 2], rand).flatMap((band) => shuffle([0, 1], rand).map((r) => band * 2 + r));
  const cols = shuffle([0, 1], rand).flatMap((stack) => shuffle([0, 1, 2], rand).map((c) => stack * 3 + c));
  const pattern = (r: number, c: number) => (3 * (r % 2) + Math.floor(r / 2) + c) % N;
  const answer = [...Array(N * N).keys()].map((p) => digits[pattern(rows[Math.floor(p / N)], cols[p % N])]);
  // Take pictures away while there's still only one answer
  const puzzle = [...answer];
  let left = N * N;
  for (const p of shuffle([...Array(N * N).keys()], rand)) {
    if (left <= SUDOKU_MODES[mode]) break;
    const keep = puzzle[p];
    puzzle[p] = 0;
    if (countSolutions([...puzzle]) === 1) left--;
    else puzzle[p] = keep;
  }
  return { puzzle, answer };
}

/** Is a filled board right? (Checked by the rules, so any valid answer counts) */
export const isComplete = (b: number[]) => b.every((v, p) => v >= 1 && v <= N && peers(p).every((q) => b[q] !== v));
/** Cells that clash with another in their row, column or box */
export const clashes = (b: number[]) => new Set([...b.keys()].filter((p) => b[p] && peers(p).some((q) => b[q] === b[p])));
