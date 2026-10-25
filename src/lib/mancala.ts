// Bean counting: mancala (Kalah) against the café computer. Pure, so the page and tests share it.
// Cups 0-5 are yours (left to right), 6 is your jar. Cups 7-12 are the computer's, 13 is its jar.
export const PITS = 6, START = 4;
export const MY_STORE = 6, AI_STORE = 13;
export type Board = number[];
export type Side = 0 | 1; // 0 is you, 1 is the computer

export const start = (): Board => Array.from({ length: 14 }, (_, i) => (i === MY_STORE || i === AI_STORE ? 0 : START));
export const pitsOf = (side: Side) => [...Array(PITS).keys()].map((i) => (side === 0 ? i : i + 7));
export const storeOf = (side: Side) => (side === 0 ? MY_STORE : AI_STORE);
export const legal = (b: Board, side: Side) => pitsOf(side).filter((i) => b[i] > 0);
export const opposite = (i: number) => 12 - i;

/** Sow the beans from one cup. Returns the new board, who goes next, and what happened. */
export function sow(b: Board, pit: number, side: Side): { board: Board; next: Side; again: boolean; captured: number; over: boolean } | null {
  if (!pitsOf(side).includes(pit) || b[pit] === 0) return null;
  const n = [...b];
  let beans = n[pit], i = pit;
  n[pit] = 0;
  const skip = storeOf(side === 0 ? 1 : 0);
  while (beans > 0) { i = (i + 1) % 14; if (i === skip) continue; n[i]++; beans--; }
  let captured = 0;
  // Last bean in one of your own empty cups: take it and everything opposite
  if (pitsOf(side).includes(i) && n[i] === 1 && n[opposite(i)] > 0) {
    captured = n[opposite(i)] + 1;
    n[storeOf(side)] += captured; n[i] = 0; n[opposite(i)] = 0;
  }
  const again = i === storeOf(side);
  // When one side runs dry, the other side keeps what's left in its cups
  let over = false;
  if (legal(n, 0).length === 0 || legal(n, 1).length === 0) {
    over = true;
    for (const s of [0, 1] as Side[]) for (const p of pitsOf(s)) { n[storeOf(s)] += n[p]; n[p] = 0; }
  }
  return { board: n, next: again ? side : side === 0 ? 1 : 0, again, captured, over };
}

function evaluate(b: Board) { return b[AI_STORE] - b[MY_STORE]; }
function search(b: Board, side: Side, depth: number, alpha: number, beta: number): number {
  const moves = legal(b, side);
  if (depth === 0 || !moves.length) return evaluate(b);
  let best = side === 1 ? -Infinity : Infinity;
  for (const m of moves) {
    const r = sow(b, m, side)!;
    const v = r.over ? evaluate(r.board) * 10 : search(r.board, r.next, depth - 1, alpha, beta);
    if (side === 1) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return best;
}
export type Level = "easy" | "hard";
/** The computer's cup. Easy looks one move ahead and sometimes slips; hard looks seven ahead. */
export function bestPit(b: Board, level: Level, rand: () => number = Math.random): number | null {
  const moves = legal(b, 1);
  if (!moves.length) return null;
  if (level === "easy" && rand() < 0.35) return moves[Math.floor(rand() * moves.length)];
  const depth = level === "easy" ? 1 : 7;
  let best = moves[0], bv = -Infinity;
  for (const m of moves) {
    const r = sow(b, m, 1)!;
    const v = (r.over ? evaluate(r.board) * 10 : search(r.board, r.next, depth - 1, -Infinity, Infinity)) + rand() * 0.1;
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}
