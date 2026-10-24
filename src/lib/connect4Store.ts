// Guests vs the barista: votes for each guest move, then the barista replies. Rounds close a while after the first vote.
import "server-only";
import { db } from "./db";
import { botMove, drop, empty, isFull, openCols, topVote, winner, COLS, type Board } from "./connect4";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
/** How long a round stays open after its first vote (tests make it short) */
export const roundMs = () => Number(process.env.C4_ROUND_MS) || 20 * 60_000;
type Game = { id: number; board: string; status: string; round_ends_ms: number | null; moves: number; last_guest: number | null; last_bot: number | null; ended_ms: number | null };

const latest = () => db.prepare("SELECT * FROM c4_games WHERE status != 'reset' ORDER BY id DESC LIMIT 1").get() as Game | undefined;
const newGame = () => { db.prepare("INSERT INTO c4_games (board) VALUES (?)").run(JSON.stringify(empty())); return latest()!; };

/** Play any round that has closed, and start a new game a round after the last one ended */
function settle(now: number): Game {
  let g = latest() ?? newGame();
  if (g.status === "playing" && g.round_ends_ms && now >= g.round_ends_ms) {
    const rows = db.prepare("SELECT col, COUNT(*) AS n FROM c4_votes WHERE game_id = ? AND round = ? GROUP BY col").all(g.id, g.moves) as { col: number; n: number }[];
    const counts = Array(COLS).fill(0);
    rows.forEach((r) => (counts[r.col] = r.n));
    let b = JSON.parse(g.board) as Board;
    const col = topVote(counts, b);
    let status = "playing", bot: number | null = null;
    if (col !== null) {
      b = drop(b, col, 1)!;
      if (winner(b)) status = "guests";
      else if (isFull(b)) status = "draw";
      else {
        bot = botMove(b);
        b = drop(b, bot, 2)!;
        status = winner(b) ? "barista" : isFull(b) ? "draw" : "playing";
      }
    }
    db.prepare("UPDATE c4_games SET board = ?, status = ?, round_ends_ms = NULL, moves = moves + ?, last_guest = ?, last_bot = ?, ended_ms = ? WHERE id = ?")
      .run(JSON.stringify(b), status, col === null ? 0 : 1, col, bot, status === "playing" ? null : now, g.id);
    g = latest()!;
  }
  if (g.status !== "playing" && g.ended_ms && now >= g.ended_ms + roundMs()) g = newGame();
  return g;
}

export function connect4State(voter?: unknown, now = Date.now()) {
  const g = settle(now);
  const b = JSON.parse(g.board) as Board;
  const counts = Array(COLS).fill(0);
  (db.prepare("SELECT col, COUNT(*) AS n FROM c4_votes WHERE game_id = ? AND round = ? GROUP BY col").all(g.id, g.moves) as { col: number; n: number }[]).forEach((r) => (counts[r.col] = r.n));
  const v = cleanVoter(voter);
  const mine = v ? (db.prepare("SELECT col FROM c4_votes WHERE game_id = ? AND round = ? AND voter = ?").get(g.id, g.moves, v) as { col: number } | undefined)?.col ?? null : null;
  const tally = db.prepare("SELECT status, COUNT(*) AS n FROM c4_games WHERE status IN ('guests','barista','draw') GROUP BY status").all() as { status: string; n: number }[];
  const n = (s: string) => tally.find((t) => t.status === s)?.n ?? 0;
  return {
    game: (db.prepare("SELECT COUNT(*) AS n FROM c4_games WHERE status != 'reset' AND id <= ?").get(g.id) as { n: number }).n,
    board: b, status: g.status, moves: g.moves, roundEnds: g.round_ends_ms, counts, mine,
    open: openCols(b), lastGuest: g.last_guest, lastBot: g.last_bot, win: winner(b)?.cells ?? [],
    nextGame: g.status === "playing" ? null : (g.ended_ms ?? now) + roundMs(),
    score: { guests: n("guests"), barista: n("barista"), draws: n("draw") },
  };
}

/** { col, voter }: your vote for the guests' next move (you can change it until the round closes) */
export function voteConnect4(b: Record<string, unknown>, now = Date.now()) {
  const v = cleanVoter(b.voter);
  if (!v) return { error: "Something went wrong. Refresh and try again." };
  const g = settle(now);
  if (g.status !== "playing") return { error: "That game's over. A new one starts soon!" };
  const col = Math.floor(Number(b.col));
  if (!openCols(JSON.parse(g.board) as Board).includes(col)) return { error: "That column's full. Pick another." };
  db.prepare("INSERT INTO c4_votes (game_id, round, voter, col) VALUES (?, ?, ?, ?) ON CONFLICT(game_id, round, voter) DO UPDATE SET col = excluded.col").run(g.id, g.moves, v, col);
  if (!g.round_ends_ms) db.prepare("UPDATE c4_games SET round_ends_ms = ? WHERE id = ?").run(now + roundMs(), g.id);
  return connect4State(v, now);
}

/** Owner: start over (the old game isn't counted) */
export function resetConnect4() {
  const g = latest();
  if (g) db.prepare("UPDATE c4_games SET status = 'reset' WHERE id = ?").run(g.id);
  newGame();
}
