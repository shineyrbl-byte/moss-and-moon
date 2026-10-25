// Pour paths: join each pair of matching cups with a pipe, filling every square. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const PATH_MODES = { easy: { size: 5, pairs: 5 }, hard: { size: 7, pairs: 8 } } as const;
export type PathMode = keyof typeof PATH_MODES;
export const pathMode = (v: unknown): PathMode => (v === "hard" ? "hard" : "easy");
export const minMs = (mode: PathMode) => (mode === "easy" ? 3000 : 8000);
export const CUPS = ["☕", "🍵", "🧋", "🥤", "🧃", "🥛", "🍹", "🍯"];

const adjacent = (a: number, b: number, n: number) =>
  (Math.abs(a - b) === 1 && Math.floor(a / n) === Math.floor(b / n)) || Math.abs(a - b) === n;
function around(p: number, n: number) {
  const r = Math.floor(p / n), c = p % n, out: number[] = [];
  if (r > 0) out.push(p - n);
  if (r < n - 1) out.push(p + n);
  if (c > 0) out.push(p - 1);
  if (c < n - 1) out.push(p + 1);
  return out;
}

/**
 * Makes a puzzle by snaking one path through every square, scrambling it, then cutting it into pieces.
 * Each piece's two ends become a pair of cups, so there's always a way to fill the board.
 */
export function makePaths(size: number, pairs: number, rand: () => number) {
  for (;;) {
    let path: number[] = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) path.push(r * size + (r % 2 ? size - 1 - c : c));
    // Backbite moves: join an end to a neighbour and flip the loop that makes
    for (let i = 0; i < size * size * 30; i++) {
      if (rand() < 0.5) path.reverse();
      const end = path[0], nb = around(end, size), t = nb[Math.floor(rand() * nb.length)];
      const k = path.indexOf(t);
      if (k > 1) path = [...path.slice(0, k).reverse(), ...path.slice(k)];
    }
    // Cut it into pieces of at least three squares
    const total = size * size, lens = Array(pairs).fill(3);
    for (let left = total - pairs * 3; left > 0; left--) lens[Math.floor(rand() * pairs)]++;
    const pieces: number[][] = [];
    let at = 0;
    for (const l of lens) { pieces.push(path.slice(at, at + l)); at += l; }
    // A pair sitting side by side is no puzzle
    if (pieces.some((p) => adjacent(p[0], p[p.length - 1], size))) continue;
    return pieces;
  }
}

export function pathsFor(date: string, mode: PathMode) {
  const { size, pairs } = PATH_MODES[mode];
  const solution = makePaths(size, pairs, seededRand(`paths:${date}:${mode}`));
  return { size, ends: solution.map((p) => [p[0], p[p.length - 1]] as [number, number]), solution };
}

/** Every square filled and every pipe running from one cup to its partner */
export function isSolved(size: number, ends: [number, number][], paths: number[][]) {
  const seen = new Set<number>();
  for (let i = 0; i < ends.length; i++) {
    const p = paths[i] ?? [];
    if (p.length < 2) return false;
    const [a, b] = ends[i];
    if (!((p[0] === a && p[p.length - 1] === b) || (p[0] === b && p[p.length - 1] === a))) return false;
    for (let k = 0; k < p.length; k++) {
      if (seen.has(p[k])) return false;
      if (k && !adjacent(p[k - 1], p[k], size)) return false;
      seen.add(p[k]);
    }
  }
  return seen.size === size * size;
}

/**
 * Drag the pipe of colour `c` onto square `to`. Backing up shortens the pipe;
 * crossing another pipe cuts that one back. Returns the new pipes (unchanged if the move isn't allowed).
 */
export function extend(size: number, ends: [number, number][], paths: number[][], c: number, to: number) {
  const p = paths[c];
  if (!p?.length) return paths;
  const last = p[p.length - 1];
  if (to === last) return paths;
  const back = p.indexOf(to);
  if (back >= 0) return paths.map((x, i) => (i === c ? x.slice(0, back + 1) : x));
  if (!adjacent(last, to, size)) return paths;
  // Finished pipes stop at their partner cup
  if (p.length > 1 && ends[c].includes(last)) return paths;
  const owner = ends.findIndex((e) => e.includes(to));
  if (owner >= 0 && owner !== c) return paths;
  return paths.map((x, i) => {
    if (i === c) return [...x, to];
    const k = x.indexOf(to);
    return k >= 0 ? x.slice(0, k) : x;
  });
}
