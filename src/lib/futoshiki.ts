// Taller order: fill the 5×5 grid with 1 to 5, each once in every row and column, so that every < or > sign between two
// squares is true. A few numbers are given. Each day's grid has exactly one answer. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 5;
export const minMs = 8000;
export const HINT_MS = 10000;
/** A sign between square a and the square b to its right or below: "<" means a is smaller */
export type Sign = { a: number; b: number; lt: boolean };

const ok = (g: number[], signs: Sign[], i: number) => {
  for (const s of signs) {
    if (s.a !== i && s.b !== i) continue;
    const x = g[s.a], y = g[s.b];
    if (x && y && (s.lt ? x >= y : x <= y)) return false;
    // Something smaller than 1 or bigger than N can't happen
    if (x && !y && ((s.lt && x === N) || (!s.lt && x === 1))) return false;
    if (y && !x && ((s.lt && y === 1) || (!s.lt && y === N))) return false;
  }
  return true;
};
/** Up to `limit` answers */
export function answers(given: number[], signs: Sign[], limit = 2): number[][] {
  const g = [...given], out: number[][] = [];
  const row = Array(N).fill(0), col = Array(N).fill(0);
  given.forEach((v, i) => { if (v) { row[Math.floor(i / N)] |= 1 << v; col[i % N] |= 1 << v; } });
  const go = (i: number) => {
    if (out.length >= limit) return;
    if (i === N * N) { out.push([...g]); return; }
    if (given[i]) { if (ok(g, signs, i)) go(i + 1); return; }
    const r = Math.floor(i / N), c = i % N;
    for (let v = 1; v <= N; v++) {
      if ((row[r] | col[c]) & (1 << v)) continue;
      g[i] = v; row[r] |= 1 << v; col[c] |= 1 << v;
      if (ok(g, signs, i)) go(i + 1);
      g[i] = 0; row[r] &= ~(1 << v); col[c] &= ~(1 << v);
    }
  };
  go(0);
  return out;
}

export function tallerFor(date: string): { given: number[]; signs: Sign[]; solution: number[] } {
  const rand = seededRand(`taller:${date}`);
  const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  for (;;) {
    // A random Latin square, filled square by square
    const sol = Array(N * N).fill(0);
    const fill = (i: number): boolean => {
      if (i === N * N) return true;
      const r = Math.floor(i / N), c = i % N;
      for (const v of shuffle([1, 2, 3, 4, 5])) {
        let clash = false;
        for (let k = 0; k < N; k++) if ((k < c && sol[r * N + k] === v) || (k < r && sol[k * N + c] === v)) clash = true;
        if (clash) continue;
        sol[i] = v;
        if (fill(i + 1)) return true;
      }
      sol[i] = 0;
      return false;
    };
    fill(0);
    // Every sign, then take them (and the givens) away while there's still one answer
    const all: Sign[] = [];
    for (let i = 0; i < N * N; i++) {
      if (i % N < N - 1) all.push({ a: i, b: i + 1, lt: sol[i] < sol[i + 1] });
      if (i < N * (N - 1)) all.push({ a: i, b: i + N, lt: sol[i] < sol[i + N] });
    }
    let signs = shuffle(all).slice(0, 14);
    const given = Array(N * N).fill(0);
    for (const i of shuffle([...Array(N * N).keys()]).slice(0, 3)) given[i] = sol[i];
    if (answers(given, signs).length !== 1) {
      // Add more signs until there's one answer
      for (const s of all) { if (signs.includes(s)) continue; signs.push(s); if (answers(given, signs).length === 1) break; }
      if (answers(given, signs).length !== 1) continue;
    }
    for (const s of shuffle([...signs])) { const t = signs.filter((x) => x !== s); if (answers(given, t).length === 1) signs = t; }
    return { given, signs, solution: sol };
  }
}
/** Squares breaking a rule: a repeat in a row or column, or one side of a sign that's false */
export function problems(signs: Sign[], g: number[]): { cells: Set<number>; signs: Set<number> } {
  const cells = new Set<number>(), bad = new Set<number>();
  for (let i = 0; i < N * N; i++) {
    if (!g[i]) continue;
    const r = Math.floor(i / N), c = i % N;
    for (let k = 0; k < N; k++) if ((k !== c && g[r * N + k] === g[i]) || (k !== r && g[k * N + c] === g[i])) cells.add(i);
  }
  signs.forEach((s, k) => { const x = g[s.a], y = g[s.b]; if (x && y && (s.lt ? x >= y : x <= y)) bad.add(k); });
  return { cells, signs: bad };
}
export const isSolved = (signs: Sign[], g: number[]) => g.every((v) => v >= 1 && v <= N) && (() => { const p = problems(signs, g); return !p.cells.size && !p.signs.size; })();
