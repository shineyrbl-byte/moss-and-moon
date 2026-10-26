// Saucer mill: nine men's morris. Take turns putting your nine saucers on the board, then slide them along the lines.
// Three in a line (a mill) lets you take one of the other side's saucers. Down to two, or stuck with no move, and you lose.
// With three left you can hop anywhere. Pure, so the page and tests share it.
export type Side = 0 | 1; // 0 you, 1 the computer
export type Level = "easy" | "hard";
export type Move = { from: number | null; to: number; take: number | null };
export type State = { board: (Side | null)[]; hand: [number, number]; turn: Side; quiet: number; winner: Side | "draw" | null };

/** Where each point sits on a 7×7 grid */
export const POINTS: [number, number][] = [
  [0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4],
  [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6],
];
export const MILLS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
  [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23],
];
export const NEXT: number[][] = POINTS.map((_, i) => [...new Set(MILLS.flatMap((m) => {
  const k = m.indexOf(i);
  return k < 0 ? [] : [m[k - 1], m[k + 1]].filter((x) => x !== undefined);
}))]);
export const QUIET_DRAW = 50; // moves in a row with nothing taken, once everything's on the board

export const newGame = (): State => ({ board: Array(24).fill(null), hand: [9, 9], turn: 0, quiet: 0, winner: null });
export const count = (s: State, side: Side) => s.board.filter((x) => x === side).length;
export const inMill = (board: (Side | null)[], i: number) => board[i] !== null && MILLS.some((m) => m.includes(i) && m.every((x) => board[x] === board[i]));
/** Saucers of `side` that can be taken: ones not in a mill, unless every one is */
export function takeable(board: (Side | null)[], side: Side) {
  const mine = board.flatMap((x, i) => (x === side ? [i] : []));
  const loose = mine.filter((i) => !inMill(board, i));
  return loose.length ? loose : mine;
}
export const flying = (s: State, side: Side) => s.hand[side] === 0 && count(s, side) === 3;

/** Every legal move for whoever's turn it is (a move that makes a mill comes once for each saucer it could take) */
export function moves(s: State): Move[] {
  if (s.winner !== null) return [];
  const side = s.turn, foe = (1 - side) as Side, out: Move[] = [];
  const steps: [number | null, number][] = [];
  const empty = s.board.flatMap((x, i) => (x === null ? [i] : []));
  if (s.hand[side] > 0) for (const to of empty) steps.push([null, to]);
  else for (let from = 0; from < 24; from++) {
    if (s.board[from] !== side) continue;
    for (const to of flying(s, side) ? empty : NEXT[from].filter((j) => s.board[j] === null)) steps.push([from, to]);
  }
  for (const [from, to] of steps) {
    const b = [...s.board];
    if (from !== null) b[from] = null;
    b[to] = side;
    if (inMill(b, to)) { const t = takeable(b, foe); if (t.length) for (const take of t) out.push({ from, to, take }); else out.push({ from, to, take: null }); }
    else out.push({ from, to, take: null });
  }
  return out;
}

export function play(s: State, m: Move): State {
  const side = s.turn, foe = (1 - side) as Side;
  const board = [...s.board];
  if (m.from !== null) board[m.from] = null;
  board[m.to] = side;
  if (m.take !== null) board[m.take] = null;
  const hand: [number, number] = [...s.hand];
  if (m.from === null) hand[side]--;
  const placing = hand[0] + hand[1] > 0;
  const t: State = { board, hand, turn: foe, quiet: placing || m.take !== null ? 0 : s.quiet + 1, winner: null };
  if (hand[foe] === 0 && count(t, foe) < 3) t.winner = side;
  else if (!moves(t).length) t.winner = side;
  else if (t.quiet >= QUIET_DRAW) t.winner = "draw";
  return t;
}

/** How good the board looks for `side` */
function score(s: State, side: Side): number {
  if (s.winner === side) return 10_000;
  if (s.winner === (1 - side)) return -10_000;
  if (s.winner === "draw") return 0;
  const foe = (1 - side) as Side;
  const men = (x: Side) => count(s, x) + s.hand[x];
  let v = 100 * (men(side) - men(foe));
  // Two in a line with the third point empty is a mill waiting to happen
  for (const m of MILLS) {
    const xs = m.map((i) => s.board[i]);
    const a = xs.filter((x) => x === side).length, b = xs.filter((x) => x === foe).length, e = xs.filter((x) => x === null).length;
    if (a === 3) v += 12; else if (a === 2 && e === 1) v += 9;
    if (b === 3) v -= 12; else if (b === 2 && e === 1) v -= 9;
  }
  // Room to move matters once everything's down
  if (s.hand[0] + s.hand[1] === 0) {
    const mob = (x: Side) => s.board.reduce<number>((n, y, i) => (y === x ? n + NEXT[i].filter((j) => s.board[j] === null).length : n), 0);
    v += 3 * (mob(side) - mob(foe));
  }
  return v;
}

function search(s: State, depth: number, alpha: number, beta: number, me: Side): number {
  if (depth === 0 || s.winner !== null) return score(s, me) * (s.winner !== null ? 1 + depth : 1);
  const ms = moves(s);
  if (s.turn === me) {
    let best = -Infinity;
    for (const m of ms) { best = Math.max(best, search(play(s, m), depth - 1, alpha, beta, me)); alpha = Math.max(alpha, best); if (alpha >= beta) break; }
    return best;
  }
  let best = Infinity;
  for (const m of ms) { best = Math.min(best, search(play(s, m), depth - 1, alpha, beta, me)); beta = Math.min(beta, best); if (alpha >= beta) break; }
  return best;
}

/** The computer's move. Hard looks three moves ahead; easy one, and sometimes just picks something. */
export function bestMove(s: State, level: Level, rand: () => number = Math.random): Move {
  const ms = moves(s);
  for (let i = ms.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ms[i], ms[j]] = [ms[j], ms[i]]; }
  if (level === "easy" && rand() < 0.35) return ms[0];
  // Look further when there's less to choose from
  const depth = level === "hard" ? (ms.length > 30 ? 2 : ms.length > 12 ? 3 : 4) : 1;
  let best = ms[0], bestV = -Infinity;
  for (const m of ms) {
    const v = search(play(s, m), depth - 1, bestV, Infinity, s.turn);
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}
