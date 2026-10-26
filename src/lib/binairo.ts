// Milk & coffee: fill the grid so no three in a line match and every row and column is half and half. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 8;
export const minMs = 10000;
export const HINT_MS = 10000;
const EXTRA = 6;
export type Cell = 0 | 1 | -1; // 0 milk, 1 coffee, -1 empty

/** Tapping goes empty, milk, coffee, empty */
export const nextValue = (v: Cell): Cell => (v === -1 ? 0 : v === 0 ? 1 : -1);

/** Everything that depends on the size of the grid: 8×8 is the daily, 6×6 the easy one */
export function milkOf(N: number) {
  const at = (g: Cell[], r: number, c: number) => g[r * N + c];
  const line = (g: Cell[], k: number, row: boolean) => [...Array(N).keys()].map((i) => (row ? at(g, k, i) : at(g, i, k)));

  /** Can this value go here without breaking a rule (looking only at what's filled)? */
  function fits(g: Cell[], i: number, v: 0 | 1) {
    const r = Math.floor(i / N), c = i % N;
    const t = [...g]; t[i] = v;
    for (const [l, p] of [[line(t, r, true), c], [line(t, c, false), r]] as const) {
      if (l.filter((x) => x === v).length > N / 2) return false;
      for (let s = Math.max(0, p - 2); s <= Math.min(N - 3, p); s++) if (l[s] === v && l[s + 1] === v && l[s + 2] === v) return false;
    }
    return true;
  }

  /** Cells that break a rule right now: three in a line, or too many of one in a row or column */
  function clashes(g: Cell[]): Set<number> {
    const bad = new Set<number>();
    for (let k = 0; k < N; k++) for (const row of [true, false]) {
      const idx = (i: number) => (row ? k * N + i : i * N + k);
      const l = line(g, k, row);
      for (let s = 0; s + 2 < N; s++) if (l[s] !== -1 && l[s] === l[s + 1] && l[s] === l[s + 2]) [s, s + 1, s + 2].forEach((x) => bad.add(idx(x)));
      for (const v of [0, 1] as const) if (l.filter((x) => x === v).length > N / 2) l.forEach((x, i) => x === v && bad.add(idx(i)));
    }
    return bad;
  }
  const isSolved = (g: Cell[]) => g.every((x) => x !== -1) && clashes(g).size === 0;

  /** Count solutions, stopping at `limit` */
  function countSolutions(g: Cell[], limit = 2): number {
    const i = g.indexOf(-1);
    if (i < 0) return 1;
    let n = 0;
    for (const v of [0, 1] as const) {
      if (!fits(g, i, v)) continue;
      g[i] = v;
      n += countSolutions(g, limit - n);
      g[i] = -1;
      if (n >= limit) break;
    }
    return n;
  }

  function fill(g: Cell[], rand: () => number): boolean {
    const i = g.indexOf(-1);
    if (i < 0) return true;
    const order: (0 | 1)[] = rand() < 0.5 ? [0, 1] : [1, 0];
    for (const v of order) {
      if (!fits(g, i, v)) continue;
      g[i] = v;
      if (fill(g, rand)) return true;
    }
    g[i] = -1;
    return false;
  }

  /** Today's puzzle: a full grid, then cups taken away while there's still only one answer */
  function milkFor(date: string): { given: Cell[]; solution: Cell[] } {
    const rand = seededRand(N === 8 ? `milk:${date}` : `milk${N}:${date}`);
    const solution: Cell[] = Array(N * N).fill(-1);
    fill(solution, rand);
    const given = [...solution];
    const cells = [...Array(N * N).keys()];
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    for (const i of cells) {
      const v = given[i];
      given[i] = -1;
      if (countSolutions([...given]) !== 1) given[i] = v;
    }
    // The barest grid is fiendish, so put a few cups back to make it a morning puzzle
    cells.filter((i) => given[i] === -1).slice(0, N === 8 ? EXTRA : 2).forEach((i) => { given[i] = solution[i]; });
    return { given, solution };
  }
  /** A hint that explains itself: a square the rules force, and which rule */
  function explain(g: Cell[]): { at: number; v: 0 | 1; why: string } | null {
    const word = (v: number) => (v ? "coffee" : "milk"), other = (v: number) => (1 - v) as 0 | 1;
    for (const row of [true, false]) for (let k = 0; k < N; k++) {
      const idx = (i: number) => (row ? k * N + i : i * N + k), l = line(g, k, row), name = row ? "row" : "column";
      for (let s = 0; s + 2 < N; s++) {
        const [a, b, c] = [l[s], l[s + 1], l[s + 2]];
        if (a !== -1 && a === b && c === -1) return { at: idx(s + 2), v: other(a), why: `Two ${word(a)}s side by side, so the next one along has to be ${word(other(a))}: never three in a ${name}.` };
        if (b !== -1 && b === c && a === -1) return { at: idx(s), v: other(b), why: `Two ${word(b)}s side by side, so the one before them has to be ${word(other(b))}: never three in a ${name}.` };
        if (a !== -1 && a === c && b === -1) return { at: idx(s + 1), v: other(a), why: `With ${word(a)} on both sides, the middle has to be ${word(other(a))}.` };
      }
      for (const v of [0, 1] as const) if (l.filter((x) => x === v).length === N / 2) {
        const i = l.indexOf(-1);
        if (i >= 0) return { at: idx(i), v: other(v), why: `This ${name} already has its ${N / 2} ${word(v)}s, so the rest are ${word(other(v))}.` };
      }
    }
    return null;
  }
  return { N, fits, clashes, isSolved, countSolutions, milkFor, explain };
}
const eight = milkOf(8);
export const { fits, clashes, isSolved, countSolutions, milkFor, explain } = eight;
export const EASY = milkOf(6);
