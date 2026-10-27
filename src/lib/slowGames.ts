// Slow games: Connect four or reversi with a friend, by link, one move whenever you like (even one a day).
// The server keeps the board; each player has a secret seat token. Pure, so the server and tests share the rules.
import * as C4 from "./connect4.ts";
import * as RV from "./reversi.ts";

export type Kind = "connect4" | "reversi";
export const KINDS: Record<Kind, { title: string; emoji: string }> = { connect4: { title: "Connect four", emoji: "🔴" }, reversi: { title: "Reversi", emoji: "⚫" } };
export const isKind = (k: unknown): k is Kind => k === "connect4" || k === "reversi";
/** turn: whose move (1 or 2), or 0 when it's over. winner: 1, 2, 0 for a draw, null while playing */
export type State = { kind: Kind; board: number[]; turn: 0 | 1 | 2; winner: 0 | 1 | 2 | null; moves: number; last: number | null };

export function newState(kind: Kind): State {
  return { kind, board: kind === "connect4" ? C4.empty() : RV.start(), turn: 1, winner: null, moves: 0, last: null };
}
/** Play a move for seat p: a column in Connect four, a square in reversi */
export function apply(s: State, p: 1 | 2, move: number): State | { error: string } {
  if (s.turn === 0) return { error: "This game's finished." };
  if (s.turn !== p) return { error: "It's not your turn yet." };
  if (s.kind === "connect4") {
    const b = C4.drop(s.board, move, p);
    if (!b) return { error: "That column's full." };
    const w = C4.winner(b), full = C4.isFull(b);
    const lastRow = [...Array(C4.ROWS).keys()].find((r) => b[r * C4.COLS + move] !== 0)!;
    return { ...s, board: b, moves: s.moves + 1, last: lastRow * C4.COLS + move, turn: w || full ? 0 : (3 - p) as 1 | 2, winner: w ? w.who : full ? 0 : null };
  }
  if (!Number.isInteger(move)) return { error: "Pick a square." };
  const b = RV.play(s.board, move, p);
  if (!b) return { error: "That square doesn't turn any over." };
  const next = RV.nextTurn(b, 3 - p);
  const a = RV.count(b, 1), z = RV.count(b, 2);
  return { ...s, board: b, moves: s.moves + 1, last: move, turn: (next ?? 0) as 0 | 1 | 2, winner: next === null ? (a > z ? 1 : z > a ? 2 : 0) : null };
}
/** Squares or columns seat p can play now */
export function options(s: State, p: 1 | 2): number[] {
  if (s.turn !== p) return [];
  return s.kind === "connect4" ? C4.openCols(s.board) : RV.legal(s.board, p);
}
export const winLine = (s: State) => (s.kind === "connect4" ? C4.winner(s.board)?.cells ?? [] : []);
