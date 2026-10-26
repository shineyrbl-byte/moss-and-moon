// Queue rope: draw one closed loop of rope along the grid lines. A number in a square says how many of its four sides the
// rope runs along. The rope never crosses or touches itself. Each day's grid has exactly one answer. Pure, so the page and
// tests share it.
//
// Inside the solver, a loop is the edge of one region of squares ("inside"), with no holes, that never touches itself
// corner to corner. A clue counts the sides where inside meets outside.
import { seededRand, shuffled } from "./gameOrders.ts";

export const N = 6;
export const minMs = 10000;
export const HINT_MS = 10000;
/** Edges: horizontal ones first ((N+1) rows of N), then vertical ones (N rows of N+1) */
export const H_COUNT = (N + 1) * N, EDGES = H_COUNT + N * (N + 1);
export const hEdge = (r: number, c: number) => r * N + c; // the line above square (r, c), r = 0..N
export const vEdge = (r: number, c: number) => H_COUNT + r * (N + 1) + c; // the line left of square (r, c), c = 0..N
/** The four sides of a square */
export const sides = (i: number) => { const r = Math.floor(i / N), c = i % N; return [hEdge(r, c), hEdge(r + 1, c), vEdge(r, c), vEdge(r, c + 1)]; };

const at = (ins: number[], r: number, c: number) => (r < 0 || r >= N || c < 0 || c >= N ? 0 : ins[r * N + c]);
/** The loop's edges for a region */
export function loopOf(ins: number[]): boolean[] {
  const e = Array(EDGES).fill(false);
  for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) e[hEdge(r, c)] = at(ins, r - 1, c) !== at(ins, r, c);
  for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) e[vEdge(r, c)] = at(ins, r, c - 1) !== at(ins, r, c);
  return e;
}
const count = (ins: number[], i: number) => { const r = Math.floor(i / N), c = i % N, v = ins[i]; return [at(ins, r - 1, c), at(ins, r + 1, c), at(ins, r, c - 1), at(ins, r, c + 1)].filter((x) => x !== v).length; };
/** One region, no holes (everything outside reaches the edge), and no two squares touching only at a corner */
function goodRegion(ins: number[]) {
  const inside = ins.flatMap((v, i) => (v ? [i] : []));
  if (!inside.length) return false;
  const reach = (start: number[], val: number) => {
    const seen = new Set(start), stack = [...start];
    while (stack.length) { const i = stack.pop()!, r = Math.floor(i / N), c = i % N; for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) { if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue; const j = rr * N + cc; if (ins[j] === val && !seen.has(j)) { seen.add(j); stack.push(j); } } }
    return seen.size;
  };
  if (reach([inside[0]], 1) !== inside.length) return false;
  const border = [...Array(N * N).keys()].filter((i) => !ins[i] && (i < N || i >= N * (N - 1) || i % N === 0 || i % N === N - 1));
  if (reach(border, 0) !== N * N - inside.length) return false;
  return noCorners(ins, N);
}
/** No 2×2 block (counting the border as outside) that's a checkerboard */
function noCorners(ins: number[], upTo: number) {
  for (let r = -1; r < Math.min(upTo, N); r++) for (let c = -1; c < N; c++) {
    const a = at(ins, r, c), b = at(ins, r, c + 1), d = at(ins, r + 1, c), e = at(ins, r + 1, c + 1);
    if (a === e && b === d && a !== b) return false;
  }
  return true;
}

/** Up to `limit` answers, as inside/outside for each square */
export function answers(clues: (number | null)[], limit = 2): number[][] {
  const ins = Array(N * N).fill(-1), out: number[][] = [];
  const v = (r: number, c: number) => (r < 0 || r >= N || c < 0 || c >= N ? 0 : ins[r * N + c]);
  // A clue can be checked once its square and all four neighbours are known
  const clueOk = (i: number) => {
    const k = clues[i];
    if (k === null || k === undefined) return true;
    const r = Math.floor(i / N), c = i % N, me = ins[i];
    const ns = [v(r - 1, c), v(r + 1, c), v(r, c - 1), v(r, c + 1)];
    if (me === -1) return true;
    const known = ns.filter((x) => x !== -1), diff = known.filter((x) => x !== me).length, open = ns.length - known.length;
    return diff <= k && diff + open >= k;
  };
  const cornerOk = (r: number, c: number) => {
    // The 2×2 blocks whose bottom-right square is (r, c) and are now fully known
    for (const [rr, cc] of [[r - 1, c - 1], [r - 1, c]]) {
      const a = v(rr, cc), b = v(rr, cc + 1), d = v(rr + 1, cc), e = v(rr + 1, cc + 1);
      if ([a, b, d, e].includes(-1)) continue;
      if (a === e && b === d && a !== b) return false;
    }
    return true;
  };
  const go = (i: number) => {
    if (out.length >= limit) return;
    if (i === N * N) { if (goodRegion(ins) && clues.every((k, j) => k === null || count(ins, j) === k)) out.push([...ins]); return; }
    const r = Math.floor(i / N), c = i % N;
    for (const val of [0, 1]) {
      ins[i] = val;
      const near = [i, i - N, i - 1, i - N + 1].filter((j) => j >= 0 && j < N * N && Math.abs((j % N) - c) <= 1);
      if (near.every(clueOk) && cornerOk(r, c) && (c !== N - 1 || cornerOk(r, c + 1)) && (r !== N - 1 || (cornerOk(r + 1, c) && (c !== N - 1 || cornerOk(r + 1, c + 1))))) go(i + 1);
    }
    ins[i] = -1;
  };
  go(0);
  return out;
}

export function ropeFor(date: string): { clues: (number | null)[]; inside: number[] } {
  const rand = seededRand(`queuerope:${date}`);
  for (;;) {
    // Grow a region a square at a time, keeping it a good one
    const ins = Array(N * N).fill(0);
    ins[Math.floor(rand() * N * N)] = 1;
    const want = Math.floor(N * N * (0.4 + rand() * 0.15));
    for (let tries = 0; tries < 400 && ins.filter(Boolean).length < want; tries++) {
      const edge = [...Array(N * N).keys()].filter((i) => !ins[i] && [i - N, i + N, i % N ? i - 1 : -1, i % N < N - 1 ? i + 1 : -1].some((j) => j >= 0 && j < N * N && ins[j]));
      const i = edge[Math.floor(rand() * edge.length)];
      ins[i] = 1;
      if (!goodRegion(ins)) ins[i] = 0;
    }
    if (!goodRegion(ins)) continue;
    // Every clue, then clues taken away while there's still one answer
    const clues: (number | null)[] = ins.map((_, i) => count(ins, i));
    if (answers(clues).length !== 1) continue;
    const order = shuffled([...Array(N * N).keys()], rand);
    for (const i of order) {
      if (clues.filter((x) => x !== null).length <= 16) break;
      const k = clues[i];
      clues[i] = null;
      if (answers(clues).length !== 1) clues[i] = k;
    }
    return { clues, inside: ins };
  }
}

/** Is a set of drawn edges one simple closed loop that matches every clue? */
export function isSolved(clues: (number | null)[], edges: boolean[]) {
  for (let i = 0; i < N * N; i++) { const k = clues[i]; if (k !== null && sides(i).filter((e) => edges[e]).length !== k) return false; }
  // Every corner has 0 or 2 rope ends, and the rope is one piece
  const ends = (x: number, y: number) => {
    const out: number[] = [];
    if (x < N) out.push(hEdge(y, x)); if (x > 0) out.push(hEdge(y, x - 1));
    if (y < N) out.push(vEdge(y, x)); if (y > 0) out.push(vEdge(y - 1, x));
    return out.filter((e) => edges[e]);
  };
  let used = 0;
  for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) { const n = ends(x, y).length; if (n !== 0 && n !== 2) return false; used += n; }
  const on = edges.flatMap((e, i) => (e ? [i] : []));
  if (!on.length) return false;
  // Walk the rope from one edge and see that it covers them all
  const pts = (e: number): [number, number][] => (e < H_COUNT ? [[e % N, Math.floor(e / N)], [(e % N) + 1, Math.floor(e / N)]] : [[(e - H_COUNT) % (N + 1), Math.floor((e - H_COUNT) / (N + 1))], [(e - H_COUNT) % (N + 1), Math.floor((e - H_COUNT) / (N + 1)) + 1]]);
  const seen = new Set([on[0]]), stack = [on[0]];
  while (stack.length) { const e = stack.pop()!; for (const [x, y] of pts(e)) for (const f of ends(x, y)) if (!seen.has(f)) { seen.add(f); stack.push(f); } }
  return seen.size === on.length && used === on.length * 2;
}
/** Squares whose number is already broken: too many sides drawn, or (with all four sides decided) too few */
export function badClues(clues: (number | null)[], edges: number[]) {
  const bad = new Set<number>();
  for (let i = 0; i < N * N; i++) {
    const k = clues[i];
    if (k === null) continue;
    const s = sides(i), drawn = s.filter((e) => edges[e] === 1).length, crossed = s.filter((e) => edges[e] === 2).length;
    if (drawn > k || 4 - crossed < k) bad.add(i);
  }
  return bad;
}
