// Board game scoreboard: who won which shelf game. Leaderboards per game, and what's most played this month.
import "server-only";
import { db, cleanText } from "./db";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const MONTH = "date('now','localtime','start of month')";

/** Most played this month, and the latest wins */
export function scoreboard() {
  const top = db.prepare(`SELECT p.game_id AS id, s.title, COUNT(*) AS plays FROM game_plays p JOIN shelf s ON s.id = p.game_id
    WHERE p.created_at >= ${MONTH} GROUP BY p.game_id ORDER BY plays DESC, s.title LIMIT 5`).all() as { id: string; title: string; plays: number }[];
  const recent = db.prepare(`SELECT p.id, p.game_id, s.title, p.winner, p.players, p.created_at FROM game_plays p JOIN shelf s ON s.id = p.game_id ORDER BY p.id DESC LIMIT 12`).all() as { id: number; game_id: string; title: string; winner: string; players: number; created_at: string }[];
  const month = (db.prepare(`SELECT COUNT(*) AS n FROM game_plays WHERE created_at >= ${MONTH}`).get() as { n: number }).n;
  return { top, recent, month };
}

/** One game's champions: by wins (names match ignoring case), this month and all time */
export function gameBoard(id: string) {
  const game = db.prepare("SELECT id, title, detail FROM shelf WHERE id = ? AND kind = 'game'").get(id) as { id: string; title: string; detail: string } | undefined;
  if (!game) return null;
  const q = (where: string) => db.prepare(`SELECT MIN(winner) AS name, COUNT(*) AS wins FROM game_plays WHERE game_id = ? ${where} GROUP BY lower(winner) ORDER BY wins DESC, MAX(id) DESC LIMIT 10`).all(id) as { name: string; wins: number }[];
  const plays = (db.prepare("SELECT COUNT(*) AS n FROM game_plays WHERE game_id = ?").get(id) as { n: number }).n;
  return { game, plays, month: q(`AND created_at >= ${MONTH}`), allTime: q("") };
}

/** { game, winner, players, voter } */
export function logPlay(b: Record<string, unknown>) {
  const voter = cleanVoter(b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const game = db.prepare("SELECT id FROM shelf WHERE id = ? AND kind = 'game'").get(String(b.game ?? "")) as { id: string } | undefined;
  if (!game) return { error: "Pick a game from the shelf." };
  const winner = cleanText(b.winner, 20).replace(/[<>]/g, "");
  if (!winner) return { error: "Who won? A first name is fine." };
  const players = Math.round(Number(b.players));
  if (!(players >= 1 && players <= 12)) return { error: "How many of you played? 1 to 12." };
  // One result per game per person every 10 minutes, so a slip of the thumb doesn't count twice
  if (db.prepare("SELECT 1 FROM game_plays WHERE voter = ? AND game_id = ? AND created_at >= datetime('now','localtime','-10 minutes')").get(voter, game.id))
    return { error: "You've just logged this game. Play another round first!" };
  db.prepare("INSERT INTO game_plays (game_id, winner, players, voter) VALUES (?, ?, ?, ?)").run(game.id, winner, players, voter);
  return { ok: true as const, board: gameBoard(game.id) };
}

export const removePlay = (id: number) => db.prepare("DELETE FROM game_plays WHERE id = ?").run(id).changes > 0;
