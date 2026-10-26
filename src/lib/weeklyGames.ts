// Boards for the puzzles that last all week (the weekly crossword): your best time this week, and everyone's.
import "server-only";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { weekOf } from "./polls";
import { minMs as crossMin } from "./weeklyCrossword";

const GAMES = { crossword: crossMin } as const;
export type WeeklyGame = keyof typeof GAMES;
export const isWeeklyGame = (g: unknown): g is WeeklyGame => typeof g === "string" && g in GAMES;
const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);

export function weeklyGameBoard(game: WeeklyGame, voter?: unknown, now = new Date()) {
  const week = weekOf(toDateStr(now)), v = cleanVoter(voter);
  const top = db.prepare("SELECT name, ms FROM weekly_games WHERE game = ? AND week = ? ORDER BY ms LIMIT 10").all(game, week) as { name: string; ms: number }[];
  const mine = v ? (db.prepare("SELECT ms FROM weekly_games WHERE game = ? AND week = ? AND voter = ?").get(game, week, v) as { ms: number } | undefined) ?? null : null;
  const played = (db.prepare("SELECT COUNT(*) AS n FROM weekly_games WHERE game = ? AND week = ?").get(game, week) as { n: number }).n;
  return { week, top, mine, played };
}
export function submitWeeklyGame(game: WeeklyGame, b: Record<string, unknown>, now = new Date()) {
  const voter = cleanVoter(b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const ms = Math.round(Number(b.ms));
  if (!Number.isFinite(ms) || ms < GAMES[game] || ms > 7 * 24 * 3600_000) return { error: "That time doesn't look right." };
  const name = cleanText(b.name, 20).replace(/[<>]/g, "") || "Guest";
  db.prepare(`INSERT INTO weekly_games (game, week, voter, name, ms) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(game, week, voter) DO UPDATE SET name = excluded.name, ms = excluded.ms, at = datetime('now') WHERE excluded.ms < weekly_games.ms`)
    .run(game, weekOf(toDateStr(now)), voter, name, ms);
  return weeklyGameBoard(game, voter, now);
}
