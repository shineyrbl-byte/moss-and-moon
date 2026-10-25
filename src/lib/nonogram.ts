// Pixel pictures (nonograms): shade squares using the number clues to find a little café picture.
// Pure, so the page and tests share it. Every picture is checked (in tests) to have exactly one answer.
import { seededRand } from "./gameOrders.ts";

export type NonoMode = "easy" | "hard";
export const nonoMode = (v: unknown): NonoMode => (v === "hard" ? "hard" : "easy");
export const minMs = (mode: NonoMode) => (mode === "easy" ? 8000 : 25000);

// "#" = shaded. Easy ones are 5×5, hard ones 10×10.
export const PICTURES: Record<NonoMode, { name: string; rows: string[] }[]> = {
  easy: [
    { name: "a heart", rows: [".#.#.", "#####", "#####", ".###.", "..#.."] },
    { name: "a cup of coffee", rows: [".#.#.", ".....", "####.", "#####", ".###."] },
    { name: "the moon", rows: [".###.", "##...", "#....", "##...", ".###."] },
    { name: "a fish", rows: [".#...", "###.#", "#####", "###.#", ".#..."] },
    { name: "a lollipop", rows: [".###.", "#####", ".###.", "..#..", "..#.."] },
    { name: "a plant pot", rows: ["#.#.#", ".###.", "..#..", "#####", ".###."] },
    { name: "a sparkle", rows: ["..#..", ".###.", "#####", ".###.", "..#.."] },
    { name: "a little house", rows: ["..#..", ".###.", "#####", "#.#.#", "###.#"] },
  ],
  hard: [
    { name: "a cup of coffee", rows: ["..#..#....", ".#..#.....", "..#..#....", "..........", "#######...", "....##....", "....##....", "...##.....", "..##......", "##########"] },
    { name: "the moon", rows: ["...#####..", ".####.....", ".###......", "###.......", "###.......", "###.......", "###.......", ".###......", ".####.....", "...#####.."] },
    { name: "a heart", rows: [".##....##.", "####..####", "##########", "##########", "##########", ".########.", "..######..", "...####...", "....##....", ".........."] },
    { name: "a cat", rows: ["#........#", "##......##", "###....###", "##########", "#..####..#", "##########", "####..####", "##########", ".########.", "..######.."] },
    { name: "a palm tree", rows: [".###..###.", "#####.####", "#..####..#", "....##....", "....##....", ".....##...", ".....##...", "....##....", "...####...", "##########"] },
    { name: "a teapot", rows: ["....##....", "...####...", ".########.", "#.######.#", "#.######.#", "....##....", "....##....", "...##.....", "..##......", "##########"] },
  ],
};
export const sizeOf = (mode: NonoMode) => (mode === "easy" ? 5 : 10);

/** "##.#" → [2, 1]; an empty line is [0] */
export const runs = (line: boolean[]) => {
  const out: number[] = [];
  let n = 0;
  for (const v of line) { if (v) n++; else if (n) { out.push(n); n = 0; } }
  if (n) out.push(n);
  return out.length ? out : [0];
};
const toCells = (rows: string[]) => rows.map((r) => [...r].map((c) => c === "#"));
export function cluesOf(rows: string[]) {
  const g = toCells(rows), n = g.length;
  return { rows: g.map(runs), cols: [...Array(n).keys()].map((c) => runs(g.map((r) => r[c]))) };
}

/** Every way a line of clues fits n squares */
function placements(clue: number[], n: number): boolean[][] {
  if (clue.length === 1 && clue[0] === 0) return [Array(n).fill(false)];
  const out: boolean[][] = [];
  const go = (i: number, at: number, line: boolean[]) => {
    if (i === clue.length) { out.push([...line, ...Array(n - line.length).fill(false)]); return; }
    const rest = clue.slice(i + 1).reduce((a, b) => a + b + 1, 0);
    for (let s = at; s + clue[i] + rest <= n; s++) {
      const next = [...line, ...Array(s - line.length).fill(false), ...Array(clue[i]).fill(true)];
      if (i < clue.length - 1) next.push(false);
      go(i + 1, next.length, next);
    }
  };
  go(0, 0, []);
  return out;
}

/** How many pictures fit the clues (stops at 2). Line-by-line logic, then guesses if it gets stuck. */
export function countSolutions(clues: { rows: number[][]; cols: number[][] }, limit = 2): number {
  const n = clues.rows.length;
  const rowP = clues.rows.map((c) => placements(c, n)), colP = clues.cols.map((c) => placements(c, n));
  const solve = (rp: boolean[][][], cp: boolean[][][]): number => {
    // Keep only placements that agree with what the other direction allows
    for (let changed = true; changed;) {
      changed = false;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const canOn = rp[r].some((p) => p[c]) && cp[c].some((p) => p[r]);
        const canOff = rp[r].some((p) => !p[c]) && cp[c].some((p) => !p[r]);
        if (!canOn && !canOff) return 0;
        if (!canOn || !canOff) {
          const v = canOn;
          const a = rp[r].filter((p) => p[c] === v), b = cp[c].filter((p) => p[r] === v);
          if (a.length !== rp[r].length || b.length !== cp[c].length) { rp = rp.map((x, i) => (i === r ? a : x)); cp = cp.map((x, i) => (i === c ? b : x)); changed = true; }
        }
      }
    }
    const open = rp.findIndex((p) => p.length > 1);
    if (open < 0) return 1;
    let total = 0;
    for (const p of rp[open]) {
      total += solve(rp.map((x, i) => (i === open ? [p] : x)), cp);
      if (total >= limit) break;
    }
    return total;
  };
  return Math.min(limit, solve(rowP, colP));
}

/** Today's picture: the same for everyone on a day */
export function nonogramFor(date: string, mode: NonoMode) {
  const list = PICTURES[mode];
  const pic = list[Math.floor(seededRand(`nonogram:${date}:${mode}`)() * list.length)];
  return { ...pic, size: list[0].rows.length, clues: cluesOf(pic.rows) };
}
/** Solved when every row and column matches its clues (so any picture that fits counts) */
export function isSolved(cells: boolean[], clues: { rows: number[][]; cols: number[][] }) {
  const n = clues.rows.length, same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  for (let r = 0; r < n; r++) if (!same(runs(cells.slice(r * n, r * n + n)), clues.rows[r])) return false;
  for (let c = 0; c < n; c++) if (!same(runs([...Array(n).keys()].map((r) => cells[r * n + c])), clues.cols[c])) return false;
  return true;
}
/** Is this row (or column) already matching its clue? Used to grey out the clue. */
export const lineDone = (line: boolean[], clue: number[]) => { const r = runs(line); return r.length === clue.length && r.every((x, i) => x === clue[i]); };
