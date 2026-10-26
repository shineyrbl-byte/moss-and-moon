// My puzzle stats: what you've played and your times, for /my-stats.
import "server-only";
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
  return {
    today,
    games: DAILY_GAMES.map((g) => ({ id: g.id, title: g.title, emoji: g.emoji, href: g.href, days: [...new Set(played[g.id] ?? [])].length, last: [...(played[g.id] ?? [])].sort().pop() ?? null })),
    times: timeStats(rows),
    ...summary(played, today),
  };
}
