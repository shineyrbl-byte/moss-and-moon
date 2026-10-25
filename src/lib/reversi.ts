// Bean reversi: Othello against the café computer. 1 is you (coffee beans), 2 is the computer (milk). Pure, so the page and tests share it.
export const N = 8;
export type Board = number[];
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
export const other = (p: number) => 3 - p;

export function start(): Board {
  const b = Array(N * N).fill(0);
  b[27] = 2; b[36] = 2; b[28] = 1; b[35] = 1;
  return b;
}
/** The squares that would turn over if p played at i */
export function flips(b: Board, i: number, p: number): number[] {
  if (b[i] !== 0) return [];
  const r0 = Math.floor(i / N), c0 = i % N, out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === other(p)) { line.push(r * N + c); r += dr; c += dc; }
    if (line.length && r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === p) out.push(...line);
  }
  return out;
}
export const legal = (b: Board, p: number) => b.map((_, i) => i).filter((i) => flips(b, i, p).length > 0);
export function play(b: Board, i: number, p: number): Board | null {
  const f = flips(b, i, p);
  if (!f.length) return null;
  const n = [...b]; n[i] = p; for (const k of f) n[k] = p;
  return n;
}
export const count = (b: Board, p: number) => b.filter((x) => x === p).length;
export const isOver = (b: Board) => !legal(b, 1).length && !legal(b, 2).length;
/** Who moves next: p if they can, otherwise the other player, or null when nobody can */
export function nextTurn(b: Board, p: number): number | null {
  if (legal(b, p).length) return p;
  if (legal(b, other(p)).length) return other(p);
  return null;
}

// Corners are gold, the squares next to them are risky
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -40, -2, -2, -2, -2, -40, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -40, -2, -2, -2, -2, -40, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];
function score(b: Board, p: number) {
  if (isOver(b)) { const d = count(b, p) - count(b, other(p)); return d > 0 ? 10000 + d : d < 0 ? -10000 + d : 0; }
  let s = 0;
  for (let i = 0; i < b.length; i++) if (b[i] === p) s += WEIGHTS[i]; else if (b[i]) s -= WEIGHTS[i];
  return s + 5 * (legal(b, p).length - legal(b, other(p)).length);
}
function search(b: Board, p: number, me: number, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || isOver(b)) return score(b, me);
  const moves = legal(b, p);
  if (!moves.length) return search(b, other(p), me, depth - 1, alpha, beta);
  if (p === me) {
    let v = -Infinity;
    for (const m of moves) { v = Math.max(v, search(play(b, m, p)!, other(p), me, depth - 1, alpha, beta)); alpha = Math.max(alpha, v); if (alpha >= beta) break; }
    return v;
  }
  let v = Infinity;
  for (const m of moves) { v = Math.min(v, search(play(b, m, p)!, other(p), me, depth - 1, alpha, beta)); beta = Math.min(beta, v); if (alpha >= beta) break; }
  return v;
}

export type Level = "easy" | "hard";
/** The computer's move. Easy plays loosely; hard looks four moves ahead. */
export function bestMove(b: Board, p: number, level: Level, rand: () => number = Math.random): number | null {
  const moves = legal(b, p);
  if (!moves.length) return null;
  if (level === "easy") {
    if (rand() < 0.5) return moves[Math.floor(rand() * moves.length)];
    return moves.reduce((a, m) => (flips(b, m, p).length > flips(b, a, p).length ? m : a));
  }
  let best = moves[0], bv = -Infinity;
  for (const m of moves) {
    const v = search(play(b, m, p)!, other(p), p, 3, -Infinity, Infinity) + rand() * 0.5;
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}
