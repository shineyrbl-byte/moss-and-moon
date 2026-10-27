import { db } from "@/lib/db";
import { toDateStr } from "@/lib/cafe";
import { DAILY_GAMES } from "@/lib/gamesStore";
import { defaultMode, isDailyGame } from "@/lib/dailyScores";
import { showDaily } from "@/lib/scoreFormat";

// Today's leader on every daily puzzle that's had a score saved, for the café TV (first names only)
export async function GET() {
  const today = toDateStr(new Date());
  const out = DAILY_GAMES.filter((g) => isDailyGame(g.id)).flatMap((g) => {
    const top = db.prepare("SELECT name, MIN(ms) AS ms, COUNT(*) AS n FROM daily_scores WHERE game = ? AND date = ? AND mode = ?").get(g.id, today, defaultMode(g.id as never)) as { name: string | null; ms: number | null; n: number };
    if (top.ms === null || !top.name) return [];
    return [{ game: g.id, title: g.title, emoji: g.emoji, name: top.name.trim().split(/\s+/)[0].slice(0, 14), score: showDaily(g.id, top.ms), players: top.n }];
  }).sort((a, b) => b.players - a.players);
  return Response.json({ today, leaders: out }, { headers: { "Cache-Control": "no-store" } });
}
