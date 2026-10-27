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

// Every set of different digits (as bits 1–9) of each length and total, for checking a run can still be finished
const COMBOS: number[][][] = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
for (let m = 2; m < 1 << 10; m += 2) { let n = 0, s = 0; for (let v = 1; v <= 9; v++) if (m & (1 << v)) { n++; s += v; } COMBOS[n][s].push(m); }

/** Up to `limit` answers (tried smallest digit first, square by square, so the same grid always gives the same answers) */
export function answers(white: boolean[], runs: Run[], given: number[], limit = 2): number[][] {
  const cells = [...Array(N * N).keys()].filter((i) => white[i]);
  const runsAt: number[][] = Array.from({ length: N * N }, () => []);
  runs.forEach((r, k) => r.cells.forEach((c) => runsAt[c].push(k)));
  const combos = runs.map((r) => (r.sum >= 0 && r.sum <= 45 ? COMBOS[r.cells.length][r.sum] : []));
  const used = runs.map(() => 0);
  const g = Array(N * N).fill(0), out: number[][] = [];
  // A run is still possible if some set of digits with its length and total holds everything placed in it so far
  const possible = (k: number) => { const u = used[k]; for (const c of combos[k]) if ((c & u) === u) return true; return false; };
  // The digits a run could still take: every set that fits what's placed, minus what's placed
  const open = (k: number) => { const u = used[k]; let m = 0; for (const c of combos[k]) if ((c & u) === u) m |= c; return m & ~u; };
  // Each empty square next to the one just filled must still have a digit it could be
  const roomLeft = (rs: number[]) => {
    for (const r of rs) for (const c of runs[r].cells) {
      if (g[c]) continue;
      let m = 0x3fe; for (const q of runsAt[c]) m &= open(q);
      if (given[c]) m &= 1 << given[c];
      if (!m) return false;
    }
    return true;
  };
  const go = (k: number) => {
    if (out.length >= limit) return;
    if (k === cells.length) { out.push([...g]); return; }
    const i = cells[k], rs = runsAt[i];
    for (let v = 1; v <= 9; v++) {
      if (given[i] && given[i] !== v) continue;
      const bit = 1 << v;
      if (rs.some((r) => used[r] & bit)) continue;
      for (const r of rs) used[r] |= bit;
      if (rs.every(possible)) { g[i] = v; if (roomLeft(rs)) go(k + 1); g[i] = 0; }
      for (const r of rs) used[r] &= ~bit;
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
