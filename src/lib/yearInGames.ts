// Your year in games: the last twelve months of puzzles and arcade scores, from the boards you've saved to.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { votersFor } from "./syncStore";
import { DAILY_GAMES } from "./gamesStore";
import { defaultMode, isDailyGame } from "./dailyScores";
import { ARCADE } from "./hallOfFame";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The longest run of days in a row in a sorted list of dates */
export function longestRun(days: string[]) {
  let best = 0, run = 0, prev = "";
  for (const d of [...new Set(days)].sort()) {
    const next = prev ? new Date(Date.parse(`${prev}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10) : "";
    run = d === next ? run + 1 : 1; best = Math.max(best, run); prev = d;
  }
  return best;
}

export function yearInGames(customerId: number | null, voter: unknown, now = new Date()) {
  const v = cleanVoter(voter);
  const voters = [...new Set([v, ...votersFor(customerId)].filter(Boolean))] as string[];
  const from = toDateStr(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1));
  if (!voters.length) return { from, solved: 0, days: 0, longest: 0, games: [], months: [], arcade: [], weeks: 0, tournaments: 0 };
  const q = voters.map(() => "?").join(",");
  const rows = db.prepare(`SELECT game, date, mode, ms FROM daily_scores WHERE voter IN (${q}) AND date >= ? ORDER BY date`).all(...voters, from) as { game: string; date: string; mode: string; ms: number }[];
  const byGame = new Map<string, { n: number; best: number | null }>();
  for (const r of rows) {
    const g = byGame.get(r.game) ?? { n: 0, best: null };
    g.n++;
    if (isDailyGame(r.game) && r.mode === defaultMode(r.game) && (g.best === null || r.ms < g.best)) g.best = r.ms;
    byGame.set(r.game, g);
  }
  const games = [...byGame.entries()].map(([id, g]) => { const d = DAILY_GAMES.find((x) => x.id === id); return { id, title: d?.title ?? id, emoji: d?.emoji ?? "🧩", href: d?.href ?? "/games", times: g.n, best: g.best }; }).sort((a, b) => b.times - a.times);
  // Puzzles per month, oldest first
  const months: { month: string; n: number }[] = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ month: MONTHS[d.getMonth()], n: rows.filter((r) => r.date.startsWith(key)).length });
  }
  const arcade = ARCADE.map((g) => ({ ...g, best: (db.prepare(`SELECT MAX(score) AS s FROM arcade_scores WHERE game = ? AND voter IN (${q}) AND week >= ?`).get(g.id, ...voters, from) as { s: number | null }).s })).filter((g) => g.best !== null);
  const weeks = (db.prepare(`SELECT COUNT(DISTINCT week) AS n FROM weekly_scores WHERE voter IN (${q}) AND week >= ?`).get(...voters, from) as { n: number }).n
    + (db.prepare(`SELECT COUNT(DISTINCT week) AS n FROM weekly_games WHERE voter IN (${q}) AND week >= ?`).get(...voters, from) as { n: number }).n;
  const tournaments = (db.prepare("SELECT players FROM tournaments WHERE start >= ?").all(from) as { players: string }[]).filter((t) => (JSON.parse(t.players) as { voter: string }[]).some((p) => voters.includes(p.voter))).length;
  return { from, solved: rows.length, days: new Set(rows.map((r) => r.date)).size, longest: longestRun(rows.map((r) => r.date)), games, months, arcade, weeks, tournaments };
}
