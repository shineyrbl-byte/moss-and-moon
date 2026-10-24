// Guests vs the barista: one big game of Connect Four the whole café plays. Pure, so the server and tests share it.
// The board is 6 rows × 7 columns, row 0 at the top. 0 = empty, 1 = guests (go first), 2 = the barista.
export const ROWS = 6, COLS = 7;
export type Board = number[]; // ROWS * COLS, row by row
export const empty = (): Board => Array(ROWS * COLS).fill(0);
export const at = (b: Board, r: number, c: number) => b[r * COLS + c];

/** Columns with room left */
export const openCols = (b: Board) => [...Array(COLS).keys()].filter((c) => at(b, 0, c) === 0);

/** Drop a counter; returns the new board, or null if that column is full */
export function drop(b: Board, col: number, who: 1 | 2): Board | null {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return null;
  for (let r = ROWS - 1; r >= 0; r--) if (at(b, r, col) === 0) { const n = [...b]; n[r * COLS + col] = who; return n; }
  return null;
}

const LINES: number[][] = (() => {
  const out: number[][] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [0, 1, 2, 3].map((i) => [r + dr * i, c + dc * i]);
      if (cells.every(([y, x]) => y >= 0 && y < ROWS && x >= 0 && x < COLS)) out.push(cells.map(([y, x]) => y * COLS + x));
    }
  return out;
})();

/** Who has four in a row (and where), or null */
export function winner(b: Board): { who: 1 | 2; cells: number[] } | null {
  for (const l of LINES) { const v = b[l[0]]; if (v && l.every((p) => b[p] === v)) return { who: v as 1 | 2, cells: l }; }
  return null;
}
export const isFull = (b: Board) => openCols(b).length === 0;

// The barista thinks a few moves ahead. Good enough to make you think, not so good it can't be beaten.
function score(b: Board) {
  let s = 0;
  for (const l of LINES) {
    const v = l.map((p) => b[p]);
    const mine = v.filter((x) => x === 2).length, theirs = v.filter((x) => x === 1).length;
    if (mine && theirs) continue;
    s += mine === 3 ? 6 : mine === 2 ? 2 : 0;
    s -= theirs === 3 ? 8 : theirs === 2 ? 2 : 0;
  }
  for (let r = 0; r < ROWS; r++) s += (at(b, r, 3) === 2 ? 3 : 0) - (at(b, r, 3) === 1 ? 3 : 0);
  return s;
}
const ORDER = [3, 2, 4, 1, 5, 0, 6]; // try the middle first
function search(b: Board, depth: number, alpha: number, beta: number, turn: 1 | 2): number {
  const w = winner(b);
  if (w) return w.who === 2 ? 100000 + depth : -100000 - depth;
  if (isFull(b) || depth === 0) return score(b);
  for (const c of ORDER) {
    const n = drop(b, c, turn);
    if (!n) continue;
    const v = search(n, depth - 1, alpha, beta, turn === 2 ? 1 : 2);
    if (turn === 2) alpha = Math.max(alpha, v); else beta = Math.min(beta, v);
    if (alpha >= beta) break;
  }
  return turn === 2 ? alpha : beta;
}
export const BOT_DEPTH = 4;
/** The barista's reply */
export function botMove(b: Board, depth = BOT_DEPTH): number {
  let best = -Infinity, pick = openCols(b)[0];
  for (const c of ORDER) {
    const n = drop(b, c, 2);
    if (!n) continue;
    const v = search(n, depth - 1, -Infinity, Infinity, 1);
    if (v > best) { best = v; pick = c; }
  }
  return pick;
}

/** The guests' move from a round of votes: most votes, ties go to the column nearest the middle */
export function topVote(counts: number[], b: Board): number | null {
  const open = new Set(openCols(b));
  let pick: number | null = null;
  for (const c of ORDER) if (open.has(c) && counts[c] > 0 && (pick === null || counts[c] > counts[pick])) pick = c;
  return pick;
}
