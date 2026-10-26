// Cake towers: fill the 5×5 grid with cakes 1 to 5 tiers tall, each height once in every row and column. A number round
// the edge says how many cakes you can see looking in from there (a taller cake hides the shorter ones behind it).
// Each day's grid has exactly one answer. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 5;
export const minMs = 8000;
export const HINT_MS = 10000;
const MIN_CLUES = 10;
/** Clues in order: top (left to right), right (top to bottom), bottom (left to right), left (top to bottom). 0 means no clue. */
export type Clues = number[];

export const seen = (line: number[]) => { let top = 0, n = 0; for (const h of line) if (h > top) { top = h; n++; } return n; };
/** The line of squares a clue looks along, nearest first */
export function lineFor(k: number): number[] {
  const side = Math.floor(k / N), i = k % N, idx = [...Array(N).keys()];
  if (side === 0) return idx.map((r) => r * N + i);
  if (side === 1) return idx.map((c) => i * N + (N - 1 - c));
  if (side === 2) return idx.map((r) => (N - 1 - r) * N + i);
  return idx.map((c) => i * N + c);
}
export const cluesOf = (g: number[]): Clues => [...Array(4 * N).keys()].map((k) => seen(lineFor(k).map((x) => g[x])));

// Every order of 1..N, with how many you see from each end
const PERMS: { p: number[]; left: number; right: number }[] = [];
(function make(cur: number[]) {
  if (cur.length === N) { PERMS.push({ p: cur, left: seen(cur), right: seen([...cur].reverse()) }); return; }
  for (let v = 1; v <= N; v++) if (!cur.includes(v)) make([...cur, v]);
})([]);

/** Up to `limit` answers, filling a whole row at a time. `given` can fix some squares (0 = open). */
export function answers(clues: Clues, limit = 2, given: number[] = Array(N * N).fill(0)): number[][] {
  const top = clues.slice(0, N), right = clues.slice(N, 2 * N), bottom = clues.slice(2 * N, 3 * N), left = clues.slice(3 * N);
  const rows: number[][] = [], out: number[][] = [];
  const colUsed = Array(N).fill(0), colTop = Array(N).fill(0), colSeen = Array(N).fill(0);
  const fits = (r: number) => PERMS.filter((x) => (!left[r] || x.left === left[r]) && (!right[r] || x.right === right[r]) && x.p.every((v, c) => !given[r * N + c] || given[r * N + c] === v));
  const options = [...Array(N).keys()].map(fits);
  const go = (r: number) => {
    if (out.length >= limit) return;
    if (r === N) {
      for (let c = 0; c < N; c++) {
        if (top[c] && colSeen[c] !== top[c]) return;
        if (bottom[c] && seen(rows.map((row) => row[c]).reverse()) !== bottom[c]) return;
      }
      out.push(rows.flat());
      return;
    }
    for (const { p } of options[r]) {
      let ok = true;
      for (let c = 0; c < N && ok; c++) {
        if (colUsed[c] & (1 << p[c])) ok = false;
        // Seen from the top can only go up, so stop once it's past the clue
        else if (top[c] && colSeen[c] + (p[c] > colTop[c] ? 1 : 0) > top[c]) ok = false;
      }
      if (!ok) continue;
      const saved = [colTop.slice(), colSeen.slice()];
      p.forEach((v, c) => { colUsed[c] |= 1 << v; if (v > colTop[c]) { colTop[c] = v; colSeen[c]++; } });
      rows.push(p);
      go(r + 1);
      rows.pop();
      p.forEach((v, c) => { colUsed[c] &= ~(1 << v); });
      saved[0].forEach((v, c) => { colTop[c] = v; colSeen[c] = saved[1][c]; });
    }
  };
  go(0);
  return out;
}

/** Today's grid: a random Latin square, then clues taken away while there's still one answer */
export function towersFor(date: string): { clues: Clues; solution: number[] } {
  const rand = seededRand(`towers:${date}`);
  const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  for (;;) {
    // Fill row by row with random choices, starting again on a dead end
    const solution = Array(N * N).fill(0);
    const fill = (i: number): boolean => {
      if (i === N * N) return true;
      const r = Math.floor(i / N), c = i % N;
      for (const v of shuffle([1, 2, 3, 4, 5])) {
        let clash = false;
        for (let k = 0; k < c; k++) if (solution[r * N + k] === v) clash = true;
        for (let k = 0; k < r; k++) if (solution[k * N + c] === v) clash = true;
        if (clash) continue;
        solution[i] = v;
        if (fill(i + 1)) return true;
      }
      solution[i] = 0;
      return false;
    };
    fill(0);
    const clues = cluesOf(solution);
    if (answers(clues).length !== 1) continue;
    // Take clues away while there's still one answer, but stop at ten: the barest grids are a slog
    // (and proving they have one answer gets slow)
    for (const k of shuffle([...Array(4 * N).keys()])) {
      if (clues.filter(Boolean).length <= MIN_CLUES) break;
      const v = clues[k];
      clues[k] = 0;
      if (answers(clues).length !== 1) clues[k] = v;
    }
    return { clues, solution };
  }
}

/** Squares and clues breaking a rule right now */
export function problems(clues: Clues, g: number[]): { cells: Set<number>; clues: Set<number> } {
  const cells = new Set<number>(), bad = new Set<number>();
  for (let i = 0; i < N * N; i++) {
    if (!g[i]) continue;
    const r = Math.floor(i / N), c = i % N;
    for (let k = 0; k < N; k++) if ((k !== c && g[r * N + k] === g[i]) || (k !== r && g[k * N + c] === g[i])) cells.add(i);
  }
  clues.forEach((n, k) => {
    if (!n) return;
    const vals = lineFor(k).map((x) => g[x]);
    if (vals.every((v) => v) && seen(vals) !== n) bad.add(k);
  });
  return { cells, clues: bad };
}
export const isSolved = (clues: Clues, g: number[]) => g.every((v) => v >= 1 && v <= N) && (() => { const p = problems(clues, g); return !p.cells.size && !p.clues.size; })();
