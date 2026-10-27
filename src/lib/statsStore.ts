// My puzzle stats: what you've played and your times, for /my-stats.
import "server-only";
import { defaultMode, isDailyGame } from "./dailyScores";
import { db } from "./db";
import { votersFor } from "./syncStore";
import { toDateStr } from "./cafe";
import { DAILY_GAMES, playedMap } from "./gamesStore";
import { summary, timeStats, type TimeRow } from "./stats";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);

export function myStats(customerId: number | null, voter: unknown, now = new Date()) {
  const today = toDateStr(now), v = cleanVoter(voter);
  const played = playedMap(customerId, v);
  const vs = [...new Set([v, ...votersFor(customerId)].filter(Boolean))] as string[];
  const rows = vs.flatMap((x) => db.prepare("SELECT game, mode, ms FROM daily_scores WHERE voter = ?").all(x) as TimeRow[]);
  // Your times on each puzzle over the last 60 days (usual level, best per day), oldest first, for the charts
  const since = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60));
  const hist = vs.flatMap((x) => db.prepare("SELECT game, mode, date, MIN(ms) AS ms FROM daily_scores WHERE voter = ? AND date >= ? GROUP BY game, mode, date").all(x, since) as { game: string; mode: string; date: string; ms: number }[]);
  const history: Record<string, { date: string; ms: number }[]> = {};
  for (const h of hist) { if (!isDailyGame(h.game) || h.mode !== defaultMode(h.game)) continue; (history[h.game] ??= []).push({ date: h.date, ms: h.ms }); }
  for (const k of Object.keys(history)) {
    const best = new Map<string, number>(); for (const x of history[k]) best.set(x.date, Math.min(best.get(x.date) ?? Infinity, x.ms));
    history[k] = [...best].map(([date, ms]) => ({ date, ms })).sort((a, b) => a.date.localeCompare(b.date));
  }
  return {
    today, history,
    games: DAILY_GAMES.map((g) => ({ id: g.id, title: g.title, emoji: g.emoji, href: g.href, days: [...new Set(played[g.id] ?? [])].length, last: [...(played[g.id] ?? [])].sort().pop() ?? null })),
    times: timeStats(rows),
    ...summary(played, today),
  };
}
