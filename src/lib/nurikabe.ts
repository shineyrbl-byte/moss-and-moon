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

export function gardenFor(date: string): { clues: number[]; path: boolean[] } {
  const rand = seededRand(`garden:${date}`);
  for (;;) {
    // Scatter plots of 1 to 5 squares that don't touch, and keep the rest as path
    const owner = Array(N * N).fill(-1);
    let plots = 0;
    for (let tries = 0; tries < 80 && plots < 9; tries++) {
      const seed = Math.floor(rand() * N * N);
      if (owner[seed] !== -1 || nextTo(seed).some((j) => owner[j] !== -1)) continue;
      const want = 1 + Math.floor(rand() * 5);
      const cells = [seed];
      owner[seed] = plots;
      while (cells.length < want) {
        const free: number[] = [];
        for (const c of cells) for (const j of NEXT[c]) if (owner[j] === -1 && NEXT[j].every((k) => owner[k] === -1 || owner[k] === plots)) free.push(j);
        if (!free.length) break;
        const j = free[Math.floor(rand() * free.length)];
        owner[j] = plots; cells.push(j);
      }
      plots++;
    }
    const path = owner.map((o) => o === -1);
    if (!pathOk(path)) continue;
    const clues = Array(N * N).fill(0);
    for (let k = 0; k < plots; k++) { const cs = owner.flatMap((o, i) => (o === k ? [i] : [])); clues[cs[Math.floor(rand() * cs.length)]] = cs.length; }
    if (answers(clues).length === 1) return { clues, path };
  }
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
