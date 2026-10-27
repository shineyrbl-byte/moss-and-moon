// Colour pixel pictures: a nonogram in colour. Each row and column lists its runs of colour in order; runs of the same
// colour have at least one gap between them, different colours can touch. Every picture can be solved line by line,
// so there's only one answer. Pure, so the page and tests share it.
import { PICTURES } from "./data/pixels.ts";

export const N = 8;
export const minMs = 10000;
export const HINT_MS = 10000;
export const COLOURS: Record<string, string> = { p: "#e391a8", b: "#8a5a40", g: "#7fa36b", y: "#e8b86a", r: "#c94c4c" };
export const PALETTE = ["p", "b", "g", "y", "r"];
export type Run = { c: string; n: number };
/** A line's runs of colour, in order */
export function runs(line: string): Run[] { const out: Run[] = []; let prev = "."; for (const ch of line) { if (ch !== "." && ch === prev) out[out.length - 1].n++; else if (ch !== ".") out.push({ c: ch, n: 1 }); prev = ch; } return out; }
export const colOf = (rows: string[], c: number) => rows.map((r) => r[c]).join("");
const dayOf = (date: string) => Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86400_000);
export function pictureFor(date: string) {
  const p = PICTURES[((dayOf(date) % PICTURES.length) + PICTURES.length) % PICTURES.length];
  return { ...p, rowClues: p.rows.map(runs), colClues: [...Array(N).keys()].map((c) => runs(colOf(p.rows, c))), colours: [...new Set(p.rows.join("").replace(/\./g, ""))] };
}

/** Every way to lay a line's runs out (as strings), keeping only those that agree with what's known ("?" = unknown) */
function layouts(clue: Run[], known: string): string[] {
  const out: string[] = [];
  const place = (k: number, at: number, acc: string) => {
    if (k === clue.length) { const s = acc.padEnd(N, "."); if ([...s].every((ch, i) => known[i] === "?" || known[i] === ch)) out.push(s); return; }
    const r = clue[k], gap = k > 0 && clue[k - 1].c === r.c ? 1 : 0;
    for (let s = at + gap; s + r.n <= N; s++) {
      const next = acc.padEnd(s, ".") + r.c.repeat(r.n);
      if (![...next].every((ch, i) => known[i] === "?" || known[i] === ch)) continue;
      place(k + 1, s + r.n, next);
    }
  };
  place(0, 0, "");
  return out;
}
/** Solve by lines alone: returns the grid ("?" where lines can't decide) */
export function lineSolve(rowClues: Run[][], colClues: Run[][]) {
  const g = [...Array(N)].map(() => Array(N).fill("?"));
  for (let pass = 0; pass < 40; pass++) {
    let changed = false;
    const fixLine = (clue: Run[], get: (i: number) => string, set: (i: number, v: string) => void) => {
      const known = [...Array(N).keys()].map(get).join(""), opts = layouts(clue, known);
      if (!opts.length) return;
      for (let i = 0; i < N; i++) if (known[i] === "?" && opts.every((o) => o[i] === opts[0][i])) { set(i, opts[0][i]); changed = true; }
    };
    for (let r = 0; r < N; r++) fixLine(rowClues[r], (i) => g[r][i], (i, v) => (g[r][i] = v));
    for (let c = 0; c < N; c++) fixLine(colClues[c], (i) => g[i][c], (i, v) => (g[i][c] = v));
    if (!changed) break;
  }
  return g.map((r) => r.join(""));
}
export const isSolved = (rows: string[], cells: string[]) => rows.join("") === cells.join("");
