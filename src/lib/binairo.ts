// Milk & coffee: fill the grid so no three in a line match and every row and column is half and half. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 8;
export const minMs = 10000;
export const HINT_MS = 10000;
const EXTRA = 6;
export type Cell = 0 | 1 | -1; // 0 milk, 1 coffee, -1 empty

const at = (g: Cell[], r: number, c: number) => g[r * N + c];
const line = (g: Cell[], k: number, row: boolean) => [...Array(N).keys()].map((i) => (row ? at(g, k, i) : at(g, i, k)));

/** Can this value go here without breaking a rule (looking only at what's filled)? */
export function fits(g: Cell[], i: number, v: 0 | 1) {
  const r = Math.floor(i / N), c = i % N;
  const t = [...g]; t[i] = v;
  for (const [l, p] of [[line(t, r, true), c], [line(t, c, false), r]] as const) {
    if (l.filter((x) => x === v).length > N / 2) return false;
    for (let s = Math.max(0, p - 2); s <= Math.min(N - 3, p); s++) if (l[s] === v && l[s + 1] === v && l[s + 2] === v) return false;
  }
  return true;
}

/** Cells that break a rule right now: three in a line, or too many of one in a row or column */
export function clashes(g: Cell[]): Set<number> {
  const bad = new Set<number>();
  for (let k = 0; k < N; k++) for (const row of [true, false]) {
    const idx = (i: number) => (row ? k * N + i : i * N + k);
    const l = line(g, k, row);
    for (let s = 0; s + 2 < N; s++) if (l[s] !== -1 && l[s] === l[s + 1] && l[s] === l[s + 2]) [s, s + 1, s + 2].forEach((x) => bad.add(idx(x)));
    for (const v of [0, 1] as const) if (l.filter((x) => x === v).length > N / 2) l.forEach((x, i) => x === v && bad.add(idx(i)));
  }
  return bad;
}
export const isSolved = (g: Cell[]) => g.every((x) => x !== -1) && clashes(g).size === 0;

/** Count solutions, stopping at `limit` */
export function countSolutions(g: Cell[], limit = 2): number {
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
export function milkFor(date: string): { given: Cell[]; solution: Cell[] } {
  const rand = seededRand(`milk:${date}`);
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
  cells.filter((i) => given[i] === -1).slice(0, EXTRA).forEach((i) => { given[i] = solution[i]; });
  return { given, solution };
}

/** Tapping goes empty, milk, coffee, empty */
export const nextValue = (v: Cell): Cell => (v === -1 ? 0 : v === 0 ? 1 : -1);
