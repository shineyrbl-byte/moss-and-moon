// Focus together: who's focusing right now (anonymous pings), and sessions finished today.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
/** A ping keeps you counted for this long */
export const LIVE_MS = 75_000;

export function focusNow(now = Date.now()) {
  db.prepare("DELETE FROM focus_presence WHERE last_ms < ?").run(now - LIVE_MS * 4);
  const live = (db.prepare("SELECT COUNT(*) AS n FROM focus_presence WHERE last_ms >= ?").get(now - LIVE_MS) as { n: number }).n;
  const t = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(minutes), 0) AS m FROM focus_sessions WHERE date = ?").get(toDateStr(new Date(now))) as { n: number; m: number };
  return { live, sessions: t.n, minutes: t.m };
}

/** { voter, event: "ping" | "stop" | "done", minutes? } */
export function focusEvent(b: Record<string, unknown>, now = Date.now()) {
  const v = cleanVoter(b.voter);
  if (!v) return { error: "Something went wrong. Refresh and try again." };
  if (b.event === "stop") db.prepare("DELETE FROM focus_presence WHERE voter = ?").run(v);
  else db.prepare("INSERT INTO focus_presence (voter, last_ms) VALUES (?, ?) ON CONFLICT(voter) DO UPDATE SET last_ms = excluded.last_ms").run(v, now);
  if (b.event === "done") {
    const minutes = Math.round(Number(b.minutes));
    if (!(minutes >= 5 && minutes <= 120)) return { error: "That session doesn't look right." };
    // A session can't finish sooner than it takes
    const last = db.prepare("SELECT MAX(created_ms) AS t FROM focus_sessions WHERE voter = ?").get(v) as { t: number | null };
    if (!last.t || now - last.t >= (minutes - 1) * 60_000) db.prepare("INSERT INTO focus_sessions (date, voter, minutes, created_ms) VALUES (?, ?, ?, ?)").run(toDateStr(new Date(now)), v, minutes, now);
  }
  return focusNow(now);
}
