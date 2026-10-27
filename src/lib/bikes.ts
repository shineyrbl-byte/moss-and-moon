// Delivery bikes: find the café's delivery fleet parked in the lane (battleships solitaire). The numbers say how many
// squares in each row and column are bike; bikes never touch, not even corner to corner. A few squares are shown to
// start you off. Each day's lane has one answer. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";
import { makeGrid } from "./grid.ts";

export const N = 8;
export const FLEET = [4, 3, 3, 2, 2, 1, 1]; // 16 squares of bike
export const minMs = 15000;
export const HINT_MS = 15000;
export type Mark = 0 | 1 | 2; // 0 unknown, 1 water, 2 bike
type Ship = { cells: number[] };

const G = makeGrid(N), { rowOf, colOf } = G;
const around = G.block; // the square itself and the ones touching it
/** Every place a bike of this length could go, as square lists (each placement once) */
function spots(len: number): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (c + len <= N) out.push([...Array(len).keys()].map((k) => r * N + c + k));
    if (len > 1 && r + len <= N) out.push([...Array(len).keys()].map((k) => (r + k) * N + c));
  }
  return out;
}
const SPOTS = Object.fromEntries([...new Set(FLEET)].map((l) => [l, spots(l)])) as Record<number, number[][]>;

/** Answers (up to `limit`) given the counts and any squares already shown */
export function answers(rows: number[], cols: number[], shown: Map<number, boolean>, limit = 2): boolean[][] {
  const bike = Array(N * N).fill(false), blocked = Array(N * N).fill(0);
  const rowN = Array(N).fill(0), colN = Array(N).fill(0), out: boolean[][] = [];
  const go = (k: number, minSpot: number) => {
    if (out.length >= limit) return;
    if (k === FLEET.length) {
      if (rowN.every((n, i) => n === rows[i]) && colN.every((n, i) => n === cols[i]) && [...shown].every(([i, b]) => bike[i] === b)) out.push([...bike]);
      return;
    }
    const len = FLEET[k], list = SPOTS[len];
    // Same-length bikes go in increasing spot order, so swapping two identical bikes isn't counted as a new answer
    const from = k > 0 && FLEET[k - 1] === len ? minSpot + 1 : 0;
    for (let s = from; s < list.length; s++) {
      const cells = list[s];
      if (cells.some((i) => blocked[i] || shown.get(i) === false)) continue;
      if (cells.some((i) => rowN[rowOf(i)] + cells.filter((j) => rowOf(j) === rowOf(i)).length > rows[rowOf(i)] || colN[colOf(i)] + cells.filter((j) => colOf(j) === colOf(i)).length > cols[colOf(i)])) continue;
      for (const i of cells) { bike[i] = true; rowN[rowOf(i)]++; colN[colOf(i)]++; }
      const block = [...new Set(cells.flatMap(around))];
      for (const i of block) blocked[i]++;
      // A shown bike square must still be coverable: skip if it's now blocked without being a bike
      const ok = [...shown].every(([i, b]) => !b || bike[i] || !blocked[i]);
      if (ok) go(k + 1, s);
      for (const i of block) blocked[i]--;
      for (const i of cells) { bike[i] = false; rowN[rowOf(i)]--; colN[colOf(i)]--; }
      if (out.length >= limit) return;
    }
  };
  go(0, -1);
  return out;
}

export function bikesFor(date: string) {
  const rand = seededRand(`deliverybikes:${date}`);
  for (;;) {
    // Park the fleet at random, never touching
    const bike = Array(N * N).fill(false), blocked = Array(N * N).fill(false), ships: Ship[] = [];
    let ok = true;
    for (const len of FLEET) {
      const free = SPOTS[len].filter((cells) => cells.every((i) => !blocked[i]));
      if (!free.length) { ok = false; break; }
      const cells = free[Math.floor(rand() * free.length)];
      ships.push({ cells });
      for (const i of cells) bike[i] = true;
      for (const i of cells.flatMap(around)) blocked[i] = true;
    }
    if (!ok) continue;
    const rows = [...Array(N).keys()].map((r) => bike.slice(r * N, r * N + N).filter(Boolean).length);
    const cols = [...Array(N).keys()].map((c) => bike.filter((b, i) => b && colOf(i) === c).length);
    // Show squares where two possible answers disagree, until only one answer is left
    const shown = new Map<number, boolean>();
    for (let k = 0; k < 12; k++) {
      const a = answers(rows, cols, shown);
      if (a.length === 1) return { rows, cols, shown: [...shown].map(([i, b]) => ({ i, bike: b })), answer: bike, ships: ships.map((s) => s.cells) };
      const diff = a[0].map((b, i) => (b !== a[1][i] ? i : -1)).filter((i) => i >= 0);
      const i = diff[Math.floor(rand() * diff.length)];
      shown.set(i, bike[i]);
    }
  }
}
export type Bikes = ReturnType<typeof bikesFor>;
export const isSolved = (p: Bikes, marks: Mark[]) => p.answer.every((b, i) => (marks[i] === 2) === b);
/** Rows and columns with too many bike squares marked, and bikes touching corner to corner */
export function problems(p: Bikes, marks: Mark[]) {
  const bad = new Set<number>();
  for (let r = 0; r < N; r++) if (marks.slice(r * N, r * N + N).filter((m) => m === 2).length > p.rows[r]) bad.add(-1 - r);
  for (let c = 0; c < N; c++) if (marks.filter((m, i) => m === 2 && colOf(i) === c).length > p.cols[c]) bad.add(-100 - c);
  marks.forEach((m, i) => { if (m !== 2) return; for (const j of around(i)) if (j !== i && marks[j] === 2 && rowOf(j) !== rowOf(i) && colOf(j) !== colOf(i)) bad.add(i); });
  return bad;
}
export const nextMark = (m: Mark): Mark => (m === 0 ? 2 : m === 2 ? 1 : 0);
