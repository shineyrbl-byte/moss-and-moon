// Parasols: every terrace table gets its own parasol in a square right next to it (across or down, not corner to corner).
// Parasols never touch each other, not even at the corners, and the numbers say how many go in each row and column.
// Each day's terrace has exactly one answer. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 8;
export const minMs = 5000;
export const HINT_MS = 10000;
export type Mark = 0 | 1 | 2; // 0 empty, 1 grass (crossed out), 2 parasol

const rc = (i: number) => [Math.floor(i / N), i % N] as const;
export const nextTo = (i: number) => {
  const [r, c] = rc(i);
  return [r > 0 ? i - N : -1, r < N - 1 ? i + N : -1, c > 0 ? i - 1 : -1, c < N - 1 ? i + 1 : -1].filter((j) => j >= 0);
};
export const touching = (a: number, b: number) => { const [ar, ac] = rc(a), [br, bc] = rc(b); return a !== b && Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1; };

/** Can every parasol be paired with its own table next to it? */
export function paired(tables: number[], parasols: number[]) {
  if (tables.length !== parasols.length) return false;
  const owner = new Map<number, number>(); // table -> parasol
  const tryAt = (p: number, seen: Set<number>): boolean => {
    for (const t of nextTo(p)) {
      if (!tables.includes(t) || seen.has(t)) continue;
      seen.add(t);
      if (!owner.has(t) || tryAt(owner.get(t)!, seen)) { owner.set(t, p); return true; }
    }
    return false;
  };
  return parasols.every((p) => tryAt(p, new Set()));
}

/** Up to `limit` answers for a terrace */
export function answers(tables: number[], rows: number[], cols: number[], limit = 2): number[][] {
  const tset = new Set(tables);
  const cand = [...Array(N * N).keys()].filter((i) => !tset.has(i) && nextTo(i).some((j) => tset.has(j)));
  const out: number[][] = [], pick: number[] = [];
  const rowN = Array(N).fill(0), colN = Array(N).fill(0);
  // How many candidates are left in each row and column from position k on, for pruning
  const leftRow = cand.map((_, k) => { const a = Array(N).fill(0); for (const x of cand.slice(k)) a[rc(x)[0]]++; return a; });
  const leftCol = cand.map((_, k) => { const a = Array(N).fill(0); for (const x of cand.slice(k)) a[rc(x)[1]]++; return a; });
  const go = (k: number) => {
    if (out.length >= limit) return;
    if (k === cand.length) {
      if (rowN.every((n, r) => n === rows[r]) && colN.every((n, c) => n === cols[c]) && paired(tables, pick)) out.push([...pick]);
      return;
    }
    for (let r = 0; r < N; r++) if (rowN[r] + leftRow[k][r] < rows[r]) return;
    for (let c = 0; c < N; c++) if (colN[c] + leftCol[k][c] < cols[c]) return;
    const x = cand[k], [r, c] = rc(x);
    if (rowN[r] < rows[r] && colN[c] < cols[c] && !pick.some((p) => touching(p, x))) {
      pick.push(x); rowN[r]++; colN[c]++;
      go(k + 1);
      pick.pop(); rowN[r]--; colN[c]--;
    }
    go(k + 1);
  };
  go(0);
  return out;
}

/** Today's terrace: parasols dotted about with a table beside each, kept only if there's one answer */
export function terraceFor(date: string): { tables: number[]; parasols: number[]; rows: number[]; cols: number[] } {
  const rand = seededRand(`parasols:${date}`);
  for (;;) {
    const parasols: number[] = [], tables: number[] = [];
    for (let tries = 0; tries < 300 && parasols.length < 12; tries++) {
      const p = Math.floor(rand() * N * N);
      if (parasols.includes(p) || tables.includes(p) || parasols.some((q) => touching(p, q))) continue;
      const spots = nextTo(p).filter((t) => !parasols.includes(t) && !tables.includes(t));
      if (!spots.length) continue;
      parasols.push(p); tables.push(spots[Math.floor(rand() * spots.length)]);
    }
    if (parasols.length < 10) continue;
    const rows = Array(N).fill(0), cols = Array(N).fill(0);
    for (const p of parasols) { rows[rc(p)[0]]++; cols[rc(p)[1]]++; }
    if (answers(tables, rows, cols).length === 1) return { tables: [...tables].sort((a, b) => a - b), parasols: [...parasols].sort((a, b) => a - b), rows, cols };
  }
}

/** Parasols that break a rule right now: touching another, or not next to any table */
export function clashes(tables: number[], marks: Mark[]): Set<number> {
  const ps = marks.flatMap((m, i) => (m === 2 ? [i] : []));
  const bad = new Set<number>();
  for (const p of ps) {
    if (ps.some((q) => touching(p, q)) || !nextTo(p).some((t) => tables.includes(t))) bad.add(p);
  }
  return bad;
}
export const lineCount = (marks: Mark[], k: number, row: boolean) => marks.filter((m, i) => m === 2 && (row ? Math.floor(i / N) : i % N) === k).length;
export function isSolved(t: { tables: number[]; rows: number[]; cols: number[] }, marks: Mark[]) {
  const ps = marks.flatMap((m, i) => (m === 2 ? [i] : []));
  return clashes(t.tables, marks).size === 0 && t.rows.every((n, r) => lineCount(marks, r, true) === n) && t.cols.every((n, c) => lineCount(marks, c, false) === n) && paired(t.tables, ps);
}
/** Tapping goes empty, grass, parasol, empty */
export const nextMark = (m: Mark): Mark => ((m + 1) % 3) as Mark;
