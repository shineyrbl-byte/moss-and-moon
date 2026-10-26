// Bean sums: fill the white squares with 1 to 9 so each run across or down adds up to the clue at its start, with no
// number twice in a run. A few squares are filled in for you, so each day's grid has exactly one answer. Pure, so the page
// and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 8; // including the clue row and column
export const minMs = 10000;
export const HINT_MS = 10000;
export type Run = { cells: number[]; sum: number; across: boolean; clue: number };
export type Puzzle = { white: boolean[]; runs: Run[]; given: number[]; solution: number[] };

/** Every run of two or more white squares, with the black square its clue sits in */
export function runsOf(white: boolean[]): Omit<Run, "sum">[] {
  const out: Omit<Run, "sum">[] = [];
  for (const across of [true, false]) for (let a = 0; a < N; a++) {
    let cur: number[] = [];
    for (let b = 0; b <= N; b++) {
      const i = across ? a * N + b : b * N + a;
      if (b < N && white[i]) { cur.push(i); continue; }
      if (cur.length) out.push({ cells: cur, across, clue: cur[0] - (across ? 1 : N) });
      cur = [];
    }
  }
  return out;
}

/** Up to `limit` answers */
export function answers(white: boolean[], runs: Run[], given: number[], limit = 2): number[][] {
  const cells = [...Array(N * N).keys()].filter((i) => white[i]);
  const runsAt: Run[][] = Array.from({ length: N * N }, () => []);
  for (const r of runs) for (const c of r.cells) runsAt[c].push(r);
  const g = Array(N * N).fill(0), out: number[][] = [];
  const ok = (i: number) => {
    for (const r of runsAt[i]) {
      let sum = 0, filled = 0, used = 0;
      for (const c of r.cells) { const v = g[c]; if (v) { if (used & (1 << v)) return false; used |= 1 << v; sum += v; filled++; } }
      const left = r.cells.length - filled;
      if (!left) { if (sum !== r.sum) return false; continue; }
      // The smallest and largest the empty squares could still add up to
      let lo = 0, hi = 0;
      for (let v = 1, k = 0; v <= 9 && k < left; v++) if (!(used & (1 << v))) { lo += v; k++; }
      for (let v = 9, k = 0; v >= 1 && k < left; v--) if (!(used & (1 << v))) { hi += v; k++; }
      if (sum + lo > r.sum || sum + hi < r.sum) return false;
    }
    return true;
  };
  const go = (k: number) => {
    if (out.length >= limit) return;
    if (k === cells.length) { out.push([...g]); return; }
    const i = cells[k];
    for (let v = 1; v <= 9; v++) {
      if (given[i] && given[i] !== v) continue;
      g[i] = v;
      if (ok(i)) go(k + 1);
      g[i] = 0;
    }
  };
  go(0);
  return out;
}

/** Today's grid */
export function sumsFor(date: string): Puzzle {
  const rand = seededRand(`sums:${date}`);
  for (;;) {
    // Black squares in a pattern that looks the same turned upside down: start with a few at random, then mend it,
    // splitting runs longer than five and blacking out squares left on their own, until every run is 2 to 5 long
    const white = [...Array(N * N).keys()].map((i) => Math.floor(i / N) > 0 && i % N > 0);
    const black = (i: number) => { white[i] = false; const r = Math.floor(i / N), c = i % N; white[(N - r) * N + (N - c)] = false; };
    for (let k = 0; k < 6; k++) black((1 + Math.floor(rand() * (N - 1))) * N + 1 + Math.floor(rand() * (N - 1)));
    for (let fix = 0; fix < 30; fix++) {
      const rs = runsOf(white);
      const long = rs.find((r) => r.cells.length > 5);
      if (long) { black(long.cells[1 + Math.floor(rand() * (long.cells.length - 2))]); continue; }
      const one = rs.find((r) => r.cells.length === 1);
      if (one) { black(one.cells[0]); continue; }
      break;
    }
    const shape = runsOf(white);
    const lone = [...Array(N * N).keys()].some((i) => white[i] && shape.filter((r) => r.cells.includes(i)).length < 2);
    if (lone || shape.some((r) => r.cells.length < 2 || r.cells.length > 5) || white.filter(Boolean).length < 26) continue;
    // Every white square has to be in a run both ways (checked above), and they must all join up
    const ws = [...Array(N * N).keys()].filter((i) => white[i]);
    const seen = new Set([ws[0]]), stack = [ws[0]];
    while (stack.length) { const i = stack.pop()!; for (const j of [i - 1, i + 1, i - N, i + N]) if (j >= 0 && j < N * N && white[j] && !seen.has(j) && (Math.abs(j - i) === N || Math.floor(j / N) === Math.floor(i / N))) { seen.add(j); stack.push(j); } }
    if (seen.size !== ws.length) continue;
    // Fill it with random digits, no repeats in a run
    const runsAt: number[][] = Array.from({ length: N * N }, () => []);
    shape.forEach((r, k) => r.cells.forEach((c) => runsAt[c].push(k)));
    const sol = Array(N * N).fill(0);
    const fill = (k: number): boolean => {
      if (k === ws.length) return true;
      const i = ws[k];
      const opts = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      for (let a = opts.length - 1; a > 0; a--) { const b = Math.floor(rand() * (a + 1)); [opts[a], opts[b]] = [opts[b], opts[a]]; }
      for (const v of opts) {
        if (runsAt[i].some((r) => shape[r].cells.some((c) => sol[c] === v))) continue;
        sol[i] = v;
        if (fill(k + 1)) return true;
        sol[i] = 0;
      }
      return false;
    };
    if (!fill(0)) continue;
    const runs: Run[] = shape.map((r) => ({ ...r, sum: r.cells.reduce((s, c) => s + sol[c], 0) }));
    // Fill in a square wherever two answers differ, until there's only one
    const given = Array(N * N).fill(0);
    let tries = 0;
    for (; tries < 20; tries++) {
      const a = answers(white, runs, given);
      if (a.length === 1) break;
      const diff = ws.filter((i) => a[0][i] !== a[1][i]);
      const pick = diff[Math.floor(rand() * diff.length)];
      given[pick] = sol[pick];
    }
    if (tries === 20 || given.filter(Boolean).length > 8) continue;
    return { white, runs, given, solution: sol };
  }
}

/** Squares breaking a rule: a repeat in a run, or a full run that doesn't add up */
export function problems(p: { runs: Run[] }, g: number[]): Set<number> {
  const bad = new Set<number>();
  for (const r of p.runs) {
    const vals = r.cells.map((c) => g[c]);
    r.cells.forEach((c, k) => { if (g[c] && vals.some((v, j) => j !== k && v === g[c])) bad.add(c); });
    if (vals.every(Boolean) && vals.reduce((s, v) => s + v, 0) !== r.sum) r.cells.forEach((c) => bad.add(c));
  }
  return bad;
}
export const isSolved = (p: Puzzle, g: number[]) => p.white.every((w, i) => !w || (g[i] >= 1 && g[i] <= 9)) && problems(p, g).size === 0;
