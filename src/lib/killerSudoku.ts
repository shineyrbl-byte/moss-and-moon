// Sugar cages (killer sudoku): fill the 6×6 grid with 1–6 so every row, column and 2×3 box has each number once.
// Dotted cages show what their numbers add up to, and a number can't repeat inside a cage. One answer each day. Pure.
import { seededRand, shuffled } from "./gameOrders.ts";
import { makeGrid } from "./grid.ts";

export const N = 6;
export const minMs = 15000;
export const HINT_MS = 10000;
const { rowOf, colOf } = makeGrid(N);
const boxOf = (i: number) => Math.floor(rowOf(i) / 2) * 2 + Math.floor(colOf(i) / 3);
export const PEERS: number[][] = [...Array(N * N).keys()].map((i) => [...Array(N * N).keys()].filter((j) => j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))));

/** A full grid: a pattern that's always valid, then shuffled (numbers, rows within bands, bands, columns within stacks) */
function solvedGrid(rand: () => number): number[] {
  const base = [...Array(N * N).keys()].map((i) => ((rowOf(i) * 3 + Math.floor(rowOf(i) / 2) + colOf(i)) % N) + 1);
  const digits = shuffled([1, 2, 3, 4, 5, 6], rand);
  const bands = shuffled([0, 1, 2], rand), rows = bands.flatMap((b) => shuffled([0, 1], rand).map((r) => b * 2 + r));
  const stacks = shuffled([0, 1], rand), cols = stacks.flatMap((s) => shuffled([0, 1, 2], rand).map((c) => s * 3 + c));
  return [...Array(N * N).keys()].map((i) => digits[base[rows[rowOf(i)] * N + cols[colOf(i)]] - 1]);
}
export type Cage = { cells: number[]; sum: number };

/** Up to `limit` answers */
export function answers(cages: Cage[], given: number[], limit = 2): number[][] {
  const cageOf = Array(N * N).fill(0); cages.forEach((c, k) => c.cells.forEach((i) => (cageOf[i] = k)));
  const b = [...given], out: number[][] = [];
  const fits = (i: number, v: number) => {
    if (PEERS[i].some((j) => b[j] === v)) return false;
    const cage = cages[cageOf[i]];
    let sum = v, empty = 0;
    for (const j of cage.cells) { if (j === i) continue; if (b[j] === v) return false; if (b[j]) sum += b[j]; else empty++; }
    if (sum > cage.sum) return false;
    if (!empty) return sum === cage.sum;
    // The remaining empties must be able to make up the difference (at least 1 each, at most 6 each)
    const need = cage.sum - sum;
    return need >= empty && need <= empty * N;
  };
  const go = () => {
    if (out.length >= limit) return;
    let best = -1, opts: number[] = [];
    for (let i = 0; i < N * N; i++) {
      if (b[i]) continue;
      const o = [1, 2, 3, 4, 5, 6].filter((v) => fits(i, v));
      if (!o.length) return;
      if (best < 0 || o.length < opts.length) { best = i; opts = o; }
    }
    if (best < 0) { out.push([...b]); return; }
    for (const v of opts) { b[best] = v; go(); b[best] = 0; if (out.length >= limit) return; }
  };
  go();
  return out;
}

export function cagesFor(date: string): { cages: Cage[]; given: number[]; answer: number[] } {
  const rand = seededRand(`sugarcages:${date}`);
  for (;;) {
    const answer = solvedGrid(rand);
    // Grow cages of 1 to 4 squares, never with the same number twice
    const owner = Array(N * N).fill(-1), cages: Cage[] = [];
    for (const start of shuffled([...Array(N * N).keys()], rand)) {
      if (owner[start] >= 0) continue;
      const size = 2 + Math.floor(rand() * 3), cells = [start];
      owner[start] = cages.length;
      while (cells.length < size) {
        const edge = shuffled(cells.flatMap((i) => [i - N, i + N, colOf(i) ? i - 1 : -1, colOf(i) < N - 1 ? i + 1 : -1]).filter((j) => j >= 0 && j < N * N && owner[j] < 0 && !cells.some((c) => answer[c] === answer[j])), rand);
        if (!edge.length) break;
        owner[edge[0]] = cages.length; cells.push(edge[0]);
      }
      cages.push({ cells, sum: cells.reduce((n, i) => n + answer[i], 0) });
    }
    // Give away numbers where two answers disagree, until there's only one
    const given = Array(N * N).fill(0);
    for (let k = 0; k < 8; k++) {
      const a = answers(cages, given);
      if (a.length === 1) return { cages, given, answer };
      const diff = a[0].map((v, i) => (v !== a[1][i] ? i : -1)).filter((i) => i >= 0);
      const i = diff[Math.floor(rand() * diff.length)];
      given[i] = answer[i];
    }
  }
}
export const isSolved = (answer: number[], cells: number[]) => cells.every((v, i) => v === answer[i]);
/** Squares that break a rule: a repeat in a row, column, box or cage, or a full cage with the wrong total */
export function clashes(cages: Cage[], cells: number[]) {
  const bad = new Set<number>();
  cells.forEach((v, i) => { if (v && PEERS[i].some((j) => cells[j] === v)) bad.add(i); });
  for (const c of cages) {
    const vals = c.cells.map((i) => cells[i]);
    if (vals.every(Boolean) && vals.reduce((a, b) => a + b, 0) !== c.sum) c.cells.forEach((i) => bad.add(i));
    c.cells.forEach((i) => { if (cells[i] && c.cells.some((j) => j !== i && cells[j] === cells[i])) bad.add(i); });
  }
  return bad;
}
