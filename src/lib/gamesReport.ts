// Owner's games dashboard: what's played most, where people give up (page visits that never become a saved
// score), and which days' puzzles were hardest. Built from page views and saved scores; nothing new is tracked.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { DAILY_GAMES } from "./gamesStore";
import { defaultMode, isDailyGame } from "./dailyScores";
import { ANY_TIME } from "./gameCatalog";
import { hiddenGames } from "./gameVisibility";

export const median = (xs: number[]) => { if (!xs.length) return null; const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2); };

export function gamesReport(days = 30, now = new Date()) {
  const since = toDateStr(new Date(now.getTime() - (days - 1) * 86_400_000));
  const views = new Map((db.prepare("SELECT path, SUM(n) AS n FROM page_views WHERE day >= ? GROUP BY path").all(since) as { path: string; n: number }[]).map((r) => [r.path, r.n]));
  const hidden = hiddenGames();
  const daily = DAILY_GAMES.filter((g) => isDailyGame(g.id)).map((g) => {
    const rows = db.prepare("SELECT date, voter, ms FROM daily_scores WHERE game = ? AND mode = ? AND date >= ?").all(g.id, defaultMode(g.id as never), since) as { date: string; voter: string; ms: number }[];
    const v = views.get(g.href) ?? 0;
    return { id: g.id, title: g.title, emoji: g.emoji, href: g.href, views: v, saves: rows.length, players: new Set(rows.map((r) => r.voter)).size, finish: v ? Math.min(1, rows.length / v) : null, median: median(rows.map((r) => r.ms)), hidden: !!hidden[g.id], rows };
  });
  // The hardest days: a day's middle score against that game's usual middle score (at least three players that day)
  const hard = daily.flatMap((g) => {
    if (!g.median) return [];
    const byDay = new Map<string, number[]>();
    for (const r of g.rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r.ms]);
    return [...byDay].filter(([, ms]) => ms.length >= 3).map(([date, ms]) => ({ id: g.id, title: g.title, emoji: g.emoji, date, players: ms.length, median: median(ms)!, ratio: median(ms)! / g.median! }));
  }).sort((a, b) => b.ratio - a.ratio).slice(0, 8).filter((h) => h.ratio > 1.15);
  const anyTime = ANY_TIME.map((g) => ({ id: g.id, title: g.title, emoji: g.emoji, href: g.href, views: views.get(g.href) ?? 0, hidden: !!hidden[g.id] })).sort((a, b) => b.views - a.views);
  const perDay = db.prepare("SELECT date, COUNT(*) AS n FROM daily_scores WHERE date >= ? GROUP BY date ORDER BY date").all(since) as { date: string; n: number }[];
  return {
    days, since,
    daily: daily.map(({ rows: _rows, ...g }) => g).sort((a, b) => b.saves - a.saves || b.views - a.views),
    hard, anyTime, perDay,
    totals: { saves: daily.reduce((n, g) => n + g.saves, 0), players: (db.prepare("SELECT COUNT(DISTINCT voter) AS n FROM daily_scores WHERE date >= ?").get(since) as { n: number }).n },
  };
}
