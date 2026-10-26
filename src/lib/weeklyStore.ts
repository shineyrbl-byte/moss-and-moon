// The puzzle of the week's board: your best time this week, and everyone's.
import "server-only";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { weekOf } from "./polls";
import { minMs } from "./sudoku9";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
export function weeklyBoard(voter?: unknown, now = new Date()) {
  const week = weekOf(toDateStr(now)), v = cleanVoter(voter);
  const top = db.prepare("SELECT name, ms FROM weekly_scores WHERE week = ? ORDER BY ms LIMIT 10").all(week) as { name: string; ms: number }[];
  const mine = v ? ((db.prepare("SELECT ms FROM weekly_scores WHERE week = ? AND voter = ?").get(week, v) as { ms: number } | undefined)?.ms ?? null) : null;
  // Friends you've added, this week
  const friends = v ? (db.prepare(`SELECT c.name, w.ms FROM friends f JOIN friend_codes c ON c.voter = f.friend
    LEFT JOIN weekly_scores w ON w.voter = f.friend AND w.week = ? WHERE f.voter = ? ORDER BY w.ms IS NULL, w.ms`).all(week, v) as { name: string; ms: number | null }[]) : [];
  const played = (db.prepare("SELECT COUNT(*) AS n FROM weekly_scores WHERE week = ?").get(week) as { n: number }).n;
  return { week, top, mine, friends, played };
}
/** { ms, name, voter }: keeps your best this week */
export function submitWeekly(b: Record<string, unknown>, now = new Date()) {
  const voter = cleanVoter(b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const ms = Math.round(Number(b.ms));
  if (!Number.isFinite(ms) || ms < minMs || ms > 24 * 3600_000) return { error: "That time doesn't look right." };
  const name = cleanText(b.name, 20).replace(/[<>]/g, "") || "Guest";
  db.prepare(`INSERT INTO weekly_scores (week, voter, name, ms) VALUES (?, ?, ?, ?)
    ON CONFLICT(week, voter) DO UPDATE SET name = excluded.name, ms = excluded.ms, at = datetime('now') WHERE excluded.ms < weekly_scores.ms`)
    .run(weekOf(toDateStr(now)), voter, name, ms);
  return weeklyBoard(voter, now);
}
