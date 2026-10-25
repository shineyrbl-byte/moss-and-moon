// Café draughts: English draughts (checkers) against the computer. Pure, so the page and tests share it.
// Board squares 0-63, row 0 at the top. 1 = your man, 2 = your king, -1 = computer man, -2 = computer king.
// You start at the bottom and move up. Captures are compulsory, and a man that reaches the far row is crowned.
export const N = 8;
export type Board = number[];
export type Move = { from: number; path: number[]; caps: number[] }; // path: each square landed on
export const DRAW_AFTER = 40; // moves each without a capture or a man moving

export function start(): Board {
  const b = Array(64).fill(0);
  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / N), c = i % N;
    if ((r + c) % 2 === 1) { if (r < 3) b[i] = -1; else if (r > 4) b[i] = 1; }
  }
  return b;
}
const mine = (v: number, side: 1 | -1) => v * side > 0;
const dirs = (v: number) => (Math.abs(v) === 2 ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : v > 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
const on = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;

function jumps(b: Board, from: number, v: number, caps: number[], path: number[]): Move[] {
  const r = Math.floor(from / N), c = from % N, out: Move[] = [];
  for (const [dr, dc] of dirs(v)) {
    const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
    if (!on(lr, lc)) continue;
    const mid = mr * N + mc, land = lr * N + lc;
    if (b[mid] * v < 0 && !caps.includes(mid) && b[land] === 0) {
      const crowned = Math.abs(v) === 1 && (v > 0 ? lr === 0 : lr === N - 1);
      const nb = [...b]; nb[land] = v; nb[from] = 0;
      // Being crowned ends the move
      const more = crowned ? [] : jumps(nb, land, v, [...caps, mid], [...path, land]);
      out.push(...(more.length ? more : [{ from: -1, path: [...path, land], caps: [...caps, mid] }]));
    }
  }
  return out;
}
/** Every legal move for a side. If any capture is possible, only captures are allowed. */
export function moves(b: Board, side: 1 | -1): Move[] {
  const caps: Move[] = [], steps: Move[] = [];
  for (let i = 0; i < 64; i++) {
    if (!mine(b[i], side)) continue;
    for (const m of jumps(b, i, b[i], [], [])) caps.push({ ...m, from: i });
    const r = Math.floor(i / N), c = i % N;
    for (const [dr, dc] of dirs(b[i])) if (on(r + dr, c + dc) && b[(r + dr) * N + c + dc] === 0) steps.push({ from: i, path: [(r + dr) * N + c + dc], caps: [] });
  }
  return caps.length ? caps : steps;
}
export function apply(b: Board, m: Move): Board {
  const n = [...b], v = n[m.from], to = m.path[m.path.length - 1], r = Math.floor(to / N);
  n[m.from] = 0;
  for (const c of m.caps) n[c] = 0;
  n[to] = Math.abs(v) === 1 && (v > 0 ? r === 0 : r === N - 1) ? v * 2 : v;
  return n;
}
/** A move that resets the draw count: a capture or a man moving */
export const resets = (b: Board, m: Move) => m.caps.length > 0 || Math.abs(b[m.from]) === 1;

const score = (b: Board) => b.reduce((s, v, i) => {
  if (!v) return s;
  const r = Math.floor(i / N);
  // Kings are worth more; men are worth a little more the further they've come
  const val = Math.abs(v) === 2 ? 3 : 1 + (v > 0 ? (N - 1 - r) : r) * 0.05;
  return s + (v < 0 ? val : -val);
}, 0);
function search(b: Board, side: 1 | -1, depth: number, alpha: number, beta: number): number {
  const ms = moves(b, side);
  if (!ms.length) return side === -1 ? -100 - depth : 100 + depth;
  if (depth === 0) return score(b);
  let best = side === -1 ? -Infinity : Infinity;
  for (const m of ms) {
    const v = search(apply(b, m), side === 1 ? -1 : 1, depth - 1, alpha, beta);
    if (side === -1) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return best;
}
export type Level = "easy" | "hard";
/** The computer's move. Easy looks two moves ahead and sometimes wanders; hard looks six ahead. */
export function bestMove(b: Board, level: Level, rand: () => number = Math.random): Move | null {
  const ms = moves(b, -1);
  if (!ms.length) return null;
  if (level === "easy" && rand() < 0.3) return ms[Math.floor(rand() * ms.length)];
  const depth = level === "easy" ? 2 : 6;
  let best = ms[0], bv = -Infinity;
  for (const m of ms) {
    const v = search(apply(b, m), 1, depth - 1, -Infinity, Infinity) + rand() * 0.01;
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}
export const count = (b: Board, side: 1 | -1) => b.filter((v) => mine(v, side)).length;
