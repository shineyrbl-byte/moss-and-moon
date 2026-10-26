// Cookie cutters: fit every cutter into the rolled-out dough with nothing left over and nothing hanging off. Cutters can
// be turned and flipped. The dough is made by laying today's cutters down, so it always fits. Pure.
import { seededRand, shuffled } from "./gameOrders.ts";

export const N = 7;
export const minMs = 8000;
export const HINT_MS = 15000;
export type Shape = [number, number][]; // [row, col] squares

const SHAPES: Record<string, Shape> = {
  I4: [[0, 0], [0, 1], [0, 2], [0, 3]], O: [[0, 0], [0, 1], [1, 0], [1, 1]], T: [[0, 0], [0, 1], [0, 2], [1, 1]],
  L: [[0, 0], [1, 0], [2, 0], [2, 1]], S: [[0, 1], [0, 2], [1, 0], [1, 1]],
  P: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]], U: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]], V: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
  W: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]], Y: [[0, 1], [1, 0], [1, 1], [2, 1], [3, 1]], Z: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]],
  F: [[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]], N5: [[0, 1], [1, 1], [2, 0], [2, 1], [3, 0]], L5: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]],
  X: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]], T5: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]],
};
export const SHAPE_NAMES = Object.keys(SHAPES);

/** Squares moved so the top row is 0 and the leftmost column 0, in reading order */
const norm = (s: Shape): Shape => {
  const r0 = Math.min(...s.map((p) => p[0])), c0 = Math.min(...s.map((p) => p[1]));
  return s.map(([r, c]) => [r - r0, c - c0] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
/** The 8 ways a cutter can lie: 4 turns, then the same flipped */
export function orient(s: Shape, o: number): Shape {
  let out = s.map(([r, c]) => [r, c] as [number, number]);
  if (o >= 4) out = out.map(([r, c]) => [r, -c]);
  for (let k = 0; k < o % 4; k++) out = out.map(([r, c]) => [c, -r]);
  return norm(out);
}
export const shapeOf = (name: string) => SHAPES[name];
/** The squares a cutter covers with its first square (top-left-most) on square `at`, or null if it hangs off the board */
export function cover(s: Shape, o: number, at: number): number[] | null {
  const sh = orient(s, o), [ar, ac] = sh[0], r0 = Math.floor(at / N) - ar, c0 = (at % N) - ac;
  const out: number[] = [];
  for (const [r, c] of sh) { const rr = r0 + r, cc = c0 + c; if (rr < 0 || rr >= N || cc < 0 || cc >= N) return null; out.push(rr * N + cc); }
  return out;
}

const sides = (i: number) => [i - N, i + N, i % N ? i - 1 : -1, i % N < N - 1 ? i + 1 : -1].filter((j) => j >= 0 && j < N * N);

export type Puzzle = { dough: boolean[]; pieces: string[]; answer: { o: number; at: number }[] };
export function cuttersFor(date: string): Puzzle {
  const rand = seededRand(`cookiecutters:${date}`);
  for (;;) {
    const count = 5 + Math.floor(rand() * 2);
    const pieces = shuffled(SHAPE_NAMES, rand).slice(0, count);
    const used = Array(N * N).fill(false), answer: { o: number; at: number }[] = [];
    let ok = true;
    for (let k = 0; k < pieces.length && ok; k++) {
      // Each new cutter goes against the dough so far (the first anywhere near the middle)
      const spots: { o: number; at: number; cells: number[]; contact: number }[] = [];
      for (let o = 0; o < 8; o++) for (let at = 0; at < N * N; at++) {
        const cells = cover(SHAPES[pieces[k]], o, at);
        if (!cells || cells.some((i) => used[i])) continue;
        const contact = cells.reduce((n, i) => n + sides(i).filter((j) => used[j]).length, 0);
        if (k === 0 ? cells.includes(24) : contact > 0) spots.push({ o, at, cells, contact });
      }
      if (!spots.length) { ok = false; break; }
      // Snug spots first, so the dough comes out as one round-ish sheet
      spots.sort((a, b) => b.contact - a.contact || rand() - 0.5);
      const pick = spots[Math.floor(rand() * Math.min(spots.length, 4))];
      pick.cells.forEach((i) => (used[i] = true)); answer.push({ o: pick.o, at: pick.at });
    }
    if (!ok) continue;
    // Not too stringy: most dough squares should have dough on two or more sides
    const lonely = used.filter((u, i) => u && sides(i).filter((j) => used[j]).length < 2).length;
    // No holes: every gap square must reach the edge through other gaps
    const out = new Set<number>(), todo = [...Array(N * N).keys()].filter((i) => !used[i] && (i < N || i >= N * (N - 1) || i % N === 0 || i % N === N - 1));
    todo.forEach((i) => out.add(i));
    while (todo.length) for (const j of sides(todo.pop()!)) if (!used[j] && !out.has(j)) { out.add(j); todo.push(j); }
    const holes = used.filter((u, i) => !u && !out.has(i)).length;
    if (lonely > 3 || holes) continue;
    return { dough: used, pieces, answer };
  }
}

export type Placed = { o: number; at: number } | null;
/** Squares each placed cutter covers, and any overlaps or spills off the dough */
export function layout(p: Puzzle, placed: Placed[]) {
  const owner = Array(N * N).fill(-1), bad = new Set<number>();
  placed.forEach((pl, k) => {
    if (!pl) return;
    const cells = cover(SHAPES[p.pieces[k]], pl.o, pl.at);
    if (!cells) return;
    for (const i of cells) { if (owner[i] >= 0 || !p.dough[i]) bad.add(i); owner[i] = k; }
  });
  return { owner, bad };
}
export const isSolved = (p: Puzzle, placed: Placed[]) => {
  if (placed.some((x) => !x)) return false;
  const { owner, bad } = layout(p, placed);
  return bad.size === 0 && p.dough.every((d, i) => d === (owner[i] >= 0));
};
