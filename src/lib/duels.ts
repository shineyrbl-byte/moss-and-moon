// Daily duels: pick a puzzle and we pair you with a random player who's already saved a score on it today. Their score
// stays hidden until you've saved yours; then it's a win, a loss or a draw.
import "server-only";
import { randomInt } from "node:crypto";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { DAILY_GAMES } from "./gamesStore";
import { defaultMode, isDailyGame } from "./dailyScores";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
type Duel = { game: string; date: string; opp_name: string; opp_ms: number };

/** Puzzles you could duel on right now: someone else has saved a score today */
export function duelOptions(voterIn: unknown, now = new Date()) {
  const voter = cleanVoter(voterIn), today = toDateStr(now);
  return DAILY_GAMES.filter((g) => isDailyGame(g.id)).map((g) => {
    const n = (db.prepare("SELECT COUNT(DISTINCT voter) AS n FROM daily_scores WHERE game = ? AND date = ? AND mode = ? AND voter != ?").get(g.id, today, defaultMode(g.id as never), voter ?? "") as { n: number }).n;
    return { id: g.id, title: g.title, emoji: g.emoji, href: g.href, players: n };
  }).filter((g) => g.players > 0);
}
export function startDuel(voterIn: unknown, game: unknown, now = new Date()) {
  const voter = cleanVoter(voterIn), today = toDateStr(now);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  if (!isDailyGame(game)) return { error: "Pick a daily puzzle." };
  if (db.prepare("SELECT 1 FROM daily_scores WHERE game = ? AND date = ? AND voter = ?").get(game, today, voter)) return { error: "You've already saved a score on that one today, so there's no race left. Pick another." };
  if (db.prepare("SELECT 1 FROM duels WHERE voter = ? AND game = ? AND date = ?").get(voter, game, today)) return duels(voter, now);
  const others = db.prepare("SELECT voter, name, MIN(ms) AS ms FROM daily_scores WHERE game = ? AND date = ? AND mode = ? AND voter != ? GROUP BY voter").all(game, today, defaultMode(game), voter) as { voter: string; name: string; ms: number }[];
  if (!others.length) return { error: "Nobody's saved that one yet today. Try another, or come back later." };
  const o = others[randomInt(others.length)];
  db.prepare("INSERT INTO duels (voter, game, date, opp, opp_name, opp_ms) VALUES (?, ?, ?, ?, ?, ?)").run(voter, game, today, o.voter, o.name, o.ms);
  return duels(voter, now);
}
/** Your duels: today's (with the opponent's score only once yours is in) and your record */
export function duels(voterIn: unknown, now = new Date()) {
  const voter = cleanVoter(voterIn), today = toDateStr(now);
  if (!voter) return { today: [], record: { won: 0, lost: 0, drawn: 0 } };
  const all = db.prepare("SELECT game, date, opp_name, opp_ms FROM duels WHERE voter = ? ORDER BY id DESC LIMIT 200").all(voter) as Duel[];
  const mine = (d: Duel) => (db.prepare("SELECT MIN(ms) AS ms FROM daily_scores WHERE game = ? AND date = ? AND voter = ? AND mode = ?").get(d.game, d.date, voter, isDailyGame(d.game) ? defaultMode(d.game) : "daily") as { ms: number | null }).ms;
  const record = { won: 0, lost: 0, drawn: 0 };
  const list = all.map((d) => {
    const m = mine(d);
    const result = m === null ? (d.date < today ? "lost" : "on") : m < d.opp_ms ? "won" : m > d.opp_ms ? "lost" : "drawn";
    if (result !== "on") record[result as "won" | "lost" | "drawn"]++;
    const g = DAILY_GAMES.find((x) => x.id === d.game);
    return { game: d.game, title: g?.title ?? d.game, emoji: g?.emoji ?? "🧩", href: g?.href ?? "/games", date: d.date, opponent: d.opp_name, result, mine: m, theirs: result === "on" ? null : d.opp_ms };
  });
  return { today: list.filter((d) => d.date === today), recent: list.filter((d) => d.date !== today).slice(0, 10), record };
}
