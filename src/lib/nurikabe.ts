// Garden plots: shade squares to make the path. Each number is a garden plot of that many unshaded squares, with one number
// in each plot, and plots never touch side by side. The path is all one piece, with no 2×2 block of path anywhere.
// Each day's garden has exactly one answer. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 6;
export const minMs = 8000;
export const HINT_MS = 10000;
export type Mark = 0 | 1 | 2; // 0 untouched, 1 path (shaded), 2 garden (dotted)

// Worked out once: the squares beside each square (up, down, left, right)
const NEXT: number[][] = [...Array(N * N).keys()].map((i) => {
  const r = Math.floor(i / N), c = i % N;
  return [r > 0 ? i - N : -1, r < N - 1 ? i + N : -1, c > 0 ? i - 1 : -1, c < N - 1 ? i + 1 : -1].filter((j) => j >= 0);
});
export const nextTo = (i: number): readonly number[] => NEXT[i] ?? [];
/** Every connected shape of `size` squares that holds `seed` and no other number */
export function shapes(clues: number[], seed: number, size: number): number[][] {
  // Shapes are kept by which squares they hold (as one number with a bit per square), so each is found once
  const out = new Map<number, number[]>(), seen = new Set<number>();
  const bit = (i: number) => 2 ** i, keyOf = (set: number[]) => set.reduce((k, i) => k + bit(i), 0);
  const grow = (set: number[], key: number) => {
    if (set.length === size) { if (!out.has(key)) out.set(key, [...set].sort((a, b) => a - b)); return; }
    const edge = new Set<number>();
    for (const i of set) for (const j of NEXT[i]) if (!set.includes(j) && !clues[j]) edge.add(j);
    for (const j of edge) { const k = key + bit(j); if (!seen.has(k)) { seen.add(k); set.push(j); grow(set, k); set.pop(); } }
  };
  grow([seed], keyOf([seed]));
  return [...out.values()];
}
const pathOk = (path: boolean[]) => {
  // No 2×2 block of path
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const i = r * N + c; if (path[i] && path[i + 1] && path[i + N] && path[i + N + 1]) return false; }
  // All one piece
  const cells = path.flatMap((p, i) => (p ? [i] : []));
  if (!cells.length) return false;
  const seen = new Set([cells[0]]), stack = [cells[0]];
  while (stack.length) for (const j of nextTo(stack.pop()!)) if (path[j] && !seen.has(j)) { seen.add(j); stack.push(j); }
  return seen.size === cells.length;
};
/** Up to `limit` answers, as which squares are path */
export function answers(clues: number[], limit = 2): boolean[][] {
  const nums = clues.flatMap((v, i) => (v ? [i] : [])).sort((a, b) => clues[a] - clues[b]);
  const opts = nums.map((i) => shapes(clues, i, clues[i]));
  const owner = Array(N * N).fill(-1), out: boolean[][] = [];
  const go = (k: number) => {
    if (out.length >= limit) return;
    if (k === nums.length) { const path = owner.map((o) => o === -1); if (pathOk(path)) out.push(path); return; }
    for (const sh of opts[k]) {
      // Not overlapping, and not touching another plot side by side
      if (sh.some((i) => owner[i] !== -1 || nextTo(i).some((j) => owner[j] !== -1))) continue;
      sh.forEach((i) => { owner[i] = k; });
      go(k + 1);
      sh.forEach((i) => { owner[i] = -1; });
      if (out.length >= limit) return;
    }
  };
  go(0);
  return out;
}

/** From this day, gardens are grown so the path never breaks up, which is far quicker. Earlier days keep their gardens. */
export const GROWN_FROM = "2026-10-28";
export function gardenFor(date: string): { clues: number[]; path: boolean[] } {
  return date < GROWN_FROM ? scattered(date) : grown(date);
}
/** Plots are added one at a time, and any plot that would cut the path in two (or make it touch another plot) is
 * skipped; then any 2×2 of path left over gets a one-square plot in it. Unique answers only, as before. */
function grown(date: string): { clues: number[]; path: boolean[] } {
  const rand = seededRand(`garden-grown:${date}`);
  const owner = new Int8Array(N * N);
  for (;;) {
    owner.fill(-1);
    let plots = 0;
    for (let tries = 0; tries < 200 && plots < 10; tries++) {
      const seed = Math.floor(rand() * N * N);
      if (owner[seed] !== -1 || NEXT[seed].some((j) => owner[j] !== -1)) continue;
      // Mostly bigger plots: one-square plots give themselves away, and the 2×2 fill-in adds a few anyway
      const want = 2 + Math.floor(rand() * 4), cells = [seed];
      owner[seed] = plots;
      while (cells.length < want) {
        const free: number[] = [];
        for (const c of cells) for (const j of NEXT[c]) if (owner[j] === -1 && !free.includes(j) && NEXT[j].every((k) => owner[k] === -1 || owner[k] === plots)) free.push(j);
        if (!free.length) break;
        const j = free[Math.floor(rand() * free.length)];
        owner[j] = plots;
        if (!joined(owner)) { owner[j] = -1; break; }
        cells.push(j);
      }
      if (!joined(owner)) { for (const c of cells) owner[c] = -1; continue; }
      plots++;
    }
    // Fill any 2×2 block of path with a single-square plot, where one fits
    for (let r = 0; r < N - 1 && plots < 12; r++) for (let c = 0; c < N - 1; c++) {
      const i = r * N + c, block = [i, i + 1, i + N, i + N + 1];
      if (!block.every((b) => owner[b] === -1)) continue;
      for (const b of shuffledCopy(block, rand)) {
        if (NEXT[b].some((j) => owner[j] !== -1)) continue;
        owner[b] = plots;
        if (joined(owner)) { plots++; break; }
        owner[b] = -1;
      }
    }
    if (!pathFits(owner)) continue;
    const path = Array.from(owner, (o) => o === -1), clues = Array(N * N).fill(0);
    for (let k = 0; k < plots; k++) { const cs: number[] = []; for (let i = 0; i < N * N; i++) if (owner[i] === k) cs.push(i); clues[cs[Math.floor(rand() * cs.length)]] = cs.length; }
    if (answers(clues).length === 1) return { clues, path };
  }
}
const shuffledCopy = (a: number[], rand: () => number) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
/** Is all the path one piece? */
function joined(owner: Int8Array) {
  let start = -1, total = 0;
  for (let i = 0; i < N * N; i++) if (owner[i] === -1) { total++; if (start < 0) start = i; }
  if (start < 0) return false;
  seen.fill(0); let top = 0, count = 1; stack[top++] = start; seen[start] = 1;
  while (top) { const i = stack[--top]; for (const j of NEXT[i]) if (owner[j] === -1 && !seen[j]) { seen[j] = 1; count++; stack[top++] = j; } }
  return count === total;
}
/** The original way: scatter plots at random and keep trying until a layout works */
function scattered(date: string): { clues: number[]; path: boolean[] } {
  const rand = seededRand(`garden:${date}`);
  // Most layouts fail (the path breaks up), so one board is reused and checked cheaply; the random draws happen in
  // exactly the same order as always, so every day's garden is unchanged
  const owner = new Int8Array(N * N), cells: number[] = [], free: number[] = [];
  const clear = (i: number) => { for (const j of NEXT[i]) if (owner[j] !== -1) return false; return true; };
  for (;;) {
    // Scatter plots of 1 to 5 squares that don't touch, and keep the rest as path
    owner.fill(-1);
    let plots = 0;
    for (let tries = 0; tries < 80 && plots < 9; tries++) {
      const seed = Math.floor(rand() * N * N);
      if (owner[seed] !== -1 || !clear(seed)) continue;
      const want = 1 + Math.floor(rand() * 5);
      cells.length = 0; cells.push(seed);
      owner[seed] = plots;
      while (cells.length < want) {
        free.length = 0;
        for (const c of cells) for (const j of NEXT[c]) {
          if (owner[j] !== -1) continue;
          let ok = true;
          for (const k of NEXT[j]) if (owner[k] !== -1 && owner[k] !== plots) { ok = false; break; }
          if (ok) free.push(j);
        }
        if (!free.length) break;
        const j = free[Math.floor(rand() * free.length)];
        owner[j] = plots; cells.push(j);
      }
      plots++;
    }
    if (!pathFits(owner)) continue;
    const path = Array.from(owner, (o) => o === -1);
    const clues = Array(N * N).fill(0);
    for (let k = 0; k < plots; k++) { const cs: number[] = []; for (let i = 0; i < N * N; i++) if (owner[i] === k) cs.push(i); clues[cs[Math.floor(rand() * cs.length)]] = cs.length; }
    if (answers(clues).length === 1) return { clues, path };
  }
}
/** The same test as pathOk, straight on the plot board: no 2×2 of path, and all the path joined up */
const seen = new Uint8Array(N * N), stack = new Int8Array(N * N);
function pathFits(owner: Int8Array) {
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const i = r * N + c; if (owner[i] === -1 && owner[i + 1] === -1 && owner[i + N] === -1 && owner[i + N + 1] === -1) return false; }
  let start = -1, total = 0;
  for (let i = 0; i < N * N; i++) if (owner[i] === -1) { total++; if (start < 0) start = i; }
  if (start < 0) return false;
  seen.fill(0); let top = 0, count = 1; stack[top++] = start; seen[start] = 1;
  while (top) { const i = stack[--top]; for (const j of NEXT[i]) if (owner[j] === -1 && !seen[j]) { seen[j] = 1; count++; stack[top++] = j; } }
  return count === total;
}
export function isSolved(clues: number[], marks: Mark[]) {
  const path = marks.map((m) => m === 1);
  if (!pathOk(path)) return false;
  // Every garden piece holds exactly one number, of its size
  const seen = new Set<number>();
  for (let i = 0; i < N * N; i++) {
    if (path[i] || seen.has(i)) continue;
    const piece = [i]; seen.add(i);
    for (let k = 0; k < piece.length; k++) for (const j of nextTo(piece[k])) if (!path[j] && !seen.has(j)) { seen.add(j); piece.push(j); }
    const nums = piece.filter((x) => clues[x]);
    if (nums.length !== 1 || clues[nums[0]] !== piece.length) return false;
  }
  return true;
}
/** Path squares in a 2×2 block, and numbers shaded over */
export function problems(clues: number[], marks: Mark[]) {
  const bad = new Set<number>();
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const q = [r * N + c, r * N + c + 1, (r + 1) * N + c, (r + 1) * N + c + 1]; if (q.every((i) => marks[i] === 1)) q.forEach((i) => bad.add(i)); }
  clues.forEach((v, i) => { if (v && marks[i] === 1) bad.add(i); });
  return bad;
}
export const nextMark = (m: Mark): Mark => ((m + 1) % 3) as Mark;
