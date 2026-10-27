// Puzzle maker: design a mini sudoku (6×6, six café treats), check it has exactly one answer, and share it as a link.
// The puzzle travels in the address itself, so nothing is stored on the server. Pure.
import { N, peers } from "./sudoku.ts";

/** Up to `limit` full answers for a board (0 = empty square) */
export function solutions(b0: number[], limit = 2): number[][] {
  const b = [...b0], out: number[][] = [];
  if (b.some((v, p) => v && peers(p).some((q) => b[q] === v))) return out;
  const go = () => {
    if (out.length >= limit) return;
    // The empty square with the fewest options first, so this stays quick even on a nearly blank board
    let best = -1, opts: number[] = [];
    for (let p = 0; p < N * N; p++) {
      if (b[p]) continue;
      const used = new Set(peers(p).map((q) => b[q]));
      const o = [1, 2, 3, 4, 5, 6].filter((v) => !used.has(v));
      if (best < 0 || o.length < opts.length) { best = p; opts = o; if (!o.length) return; }
    }
    if (best < 0) { out.push([...b]); return; }
    for (const v of opts) { b[best] = v; go(); if (out.length >= limit) break; }
    b[best] = 0;
  };
  go();
  return out;
}
export type Verdict = { kind: "none" } | { kind: "many"; differ: number } | { kind: "one"; answer: number[] };
/** Does this design have exactly one answer? If not, why (and a square where two answers differ) */
export function check(b: number[]): Verdict {
  const s = solutions(b, 2);
  if (!s.length) return { kind: "none" };
  if (s.length > 1) return { kind: "many", differ: s[0].findIndex((v, p) => v !== s[1][p]) };
  return { kind: "one", answer: s[0] };
}
/** The design as a short string for the link: one digit per square, 0 for empty */
export const encode = (b: number[]) => b.join("");
export function decode(s: unknown): number[] | null {
  if (typeof s !== "string" || !/^[0-6]{36}$/.test(s)) return null;
  return [...s].map(Number);
}
export const MIN_GIVEN = 4;
