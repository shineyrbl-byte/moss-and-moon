// Barista rush: the little game at /play. Scores are checked so they stay believable.
import "server-only";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";

export const ROUND_SECONDS = 60;
export const MAX_SERVED = 40; // nobody makes more than one drink every 1.5 s
export const MAX_PER_DRINK = 300; // 100 + speed bonus + streak

export function saveScore(b: Record<string, unknown>): { ok: true; rank: number } | { error: string } {
  const name = cleanText(b.name, 16).replace(/[<>]/g, "") || "Barista";
  const score = Math.floor(Number(b.score));
  const served = Math.floor(Number(b.served));
  if (!(served >= 0 && served <= MAX_SERVED)) return { error: "That doesn't look like a real round." };
  if (!(score >= 0 && score <= served * MAX_PER_DRINK)) return { error: "That doesn't look like a real round." };
  // A daily challenge round only counts for today
  const today = toDateStr(new Date());
  if (b.daily !== undefined && b.daily !== null && b.daily !== today) return { error: "That daily challenge has finished. Try today's!" };
  const daily = b.daily ? today : null;
  db.prepare("INSERT INTO game_scores (name, score, served, daily) VALUES (?, ?, ?, ?)").run(name, score, served, daily);
  const rank = (daily
    ? db.prepare("SELECT COUNT(DISTINCT name) AS n FROM game_scores WHERE daily = ? AND score > ?").get(daily, score)
    : db.prepare("SELECT COUNT(*) AS n FROM game_scores WHERE score > ?").get(score)) as { n: number };
  return { ok: true, rank: rank.n + 1 };
}

export function leaderboard() {
  const q = (where: string) => db.prepare(`SELECT name, MAX(score) AS score, served FROM game_scores ${where} GROUP BY name ORDER BY score DESC LIMIT 10`).all();
  const today = db.prepare("SELECT name, MAX(score) AS score, served FROM game_scores WHERE daily = ? GROUP BY name ORDER BY score DESC LIMIT 10").all(toDateStr(new Date()));
  return { today, week: q("WHERE created_at >= datetime('now','localtime','-7 days')"), allTime: q("") };
}
