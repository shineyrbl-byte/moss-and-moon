// Daily-puzzle reminders: a push notification once a day at the time you picked, unless you've already played.
import "server-only";
import type webpush from "web-push";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { pushTo } from "./push";
import { isDue, utcDay, utcMinute } from "./reminderTime";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);

export function saveReminder(sub: webpush.PushSubscription, atMin: number, voter: unknown, now = new Date()) {
  // Picking a time that's already gone today starts tomorrow
  const last = utcMinute(now) >= atMin ? utcDay(now) : null;
  db.prepare(`INSERT INTO game_reminders (endpoint, data, voter, at_min, last) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET data = excluded.data, voter = excluded.voter, at_min = excluded.at_min, last = excluded.last`)
    .run(sub.endpoint, JSON.stringify(sub), cleanVoter(voter), atMin, last);
}
export const dropReminder = (endpoint: string) => db.prepare("DELETE FROM game_reminders WHERE endpoint = ?").run(endpoint).changes > 0;

export async function gameReminderTick(now = new Date()) {
  const rows = db.prepare("SELECT endpoint, data, voter, at_min, last FROM game_reminders").all() as { endpoint: string; data: string; voter: string | null; at_min: number; last: string | null }[];
  const today = toDateStr(now);
  for (const r of rows.filter((x) => isDue(x.at_min, x.last, now))) {
    db.prepare("UPDATE game_reminders SET last = ? WHERE endpoint = ?").run(utcDay(now), r.endpoint);
    // Already saved a score today? No need to nudge.
    if (r.voter && db.prepare("SELECT 1 FROM daily_scores WHERE voter = ? AND date = ? LIMIT 1").get(r.voter, today)) continue;
    const ok = await pushTo(JSON.parse(r.data), { title: "Today's puzzles are ready ☕", body: "A fresh crossword, sudoku and more are waiting. Keep your streak going!", url: "/games" }, 6 * 3600);
    if (!ok) dropReminder(r.endpoint);
  }
}
