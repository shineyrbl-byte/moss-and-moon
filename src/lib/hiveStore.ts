// Bean hive: the word lists stay on the server, so the page only learns a word once you've found it.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { playStreak } from "./gameOrders";
import { hiveFor, hiveProblem, isPangram, lettersOf, points, rankOf, rankSteps } from "./hive";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const voterFor = (customerId: number | null, v: unknown) => (customerId ? `c${customerId}` : cleanVoter(v));
const yesterdayOf = (date: string) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

export function hiveToday(customerId: number | null, v: unknown, now = new Date()) {
  const date = toDateStr(now), voter = voterFor(customerId, v), h = hiveFor(date), letters = lettersOf(h);
  const row = voter ? (db.prepare("SELECT words, score FROM hive_games WHERE date = ? AND voter = ?").get(date, voter) as { words: string; score: number } | undefined) : undefined;
  const found = row ? (JSON.parse(row.words) as string[]) : [];
  const score = row?.score ?? 0;
  const steps = rankSteps(h.max);
  const top = steps[steps.length - 2].at;
  const today = db.prepare("SELECT COUNT(*) AS played, COALESCE(SUM(score >= ?), 0) AS strong FROM hive_games WHERE date = ? AND score > 0").get(top, date) as { played: number; strong: number };
  const days = voter ? (db.prepare("SELECT date FROM hive_games WHERE voter = ? AND score > 0").all(voter) as { date: string }[]).map((r) => r.date) : [];
  const y = hiveFor(yesterdayOf(date)), yLetters = lettersOf(y);
  return {
    date, centre: h.centre, outer: h.outer, found, score, max: h.max, rank: rankOf(score, h.max), steps,
    words: h.common.length, pangrams: h.common.filter((w) => isPangram(w, letters)).length,
    today, streak: playStreak(days, date),
    yesterday: { centre: y.centre, outer: y.outer, words: y.common, pangrams: y.common.filter((w) => isPangram(w, yLetters)) },
  };
}

/** { word, voter } */
export function playHive(customerId: number | null, b: Record<string, unknown>, now = new Date()) {
  const voter = voterFor(customerId, b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const word = typeof b.word === "string" ? b.word.trim().toLowerCase().slice(0, 20) : "";
  const date = toDateStr(now), h = hiveFor(date);
  const row = db.prepare("SELECT words FROM hive_games WHERE date = ? AND voter = ?").get(date, voter) as { words: string } | undefined;
  const found = row ? (JSON.parse(row.words) as string[]) : [];
  const problem = hiveProblem(h, word, found);
  if (problem) return { error: problem };
  const words = [...found, word], score = words.reduce((s, w) => s + points(w, lettersOf(h)), 0);
  db.prepare(`INSERT INTO hive_games (date, voter, words, score) VALUES (?, ?, ?, ?)
    ON CONFLICT(date, voter) DO UPDATE SET words = excluded.words, score = excluded.score`).run(date, voter, JSON.stringify(words), score);
  return { ...hiveToday(customerId, b.voter, now), added: { word, points: points(word, lettersOf(h)), pangram: isPangram(word, lettersOf(h)), bonus: !h.common.includes(word) } };
}
