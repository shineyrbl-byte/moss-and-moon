// Shout-outs: guests ask for a message on the TV board on a day they choose. Staff approve each one.
import "server-only";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { shoutProblem, SHOUT_MAX, SHOUT_PER_DAY } from "./shoutouts";

type Shout = { id: number; date: string; text: string; from_name: string; status: string };

export const shoutsOn = (date: string) => db.prepare("SELECT id, date, text, from_name FROM shoutouts WHERE date = ? AND status = 'approved' ORDER BY id").all(date) as Shout[];
export const shoutsToday = (now = new Date()) => shoutsOn(toDateStr(now));

/** { date, text, from? } */
export function addShout(b: Record<string, unknown>, now = new Date()) {
  const text = cleanText(b.text, SHOUT_MAX + 20).replace(/[<>]/g, "");
  const date = String(b.date ?? "");
  const problem = shoutProblem(text, date, toDateStr(now));
  if (problem) return { error: problem };
  if (shoutsOn(date).length >= SHOUT_PER_DAY) return { error: "That day's screen is full. Try the day before?" };
  if ((db.prepare("SELECT COUNT(*) AS n FROM shoutouts WHERE status = 'pending'").get() as { n: number }).n >= 100) return { error: "Lots waiting right now. Try again later." };
  db.prepare("INSERT INTO shoutouts (date, text, from_name) VALUES (?, ?, ?)").run(date, text, cleanText(b.from, 20).replace(/[<>]/g, ""));
  return { ok: true as const };
}

/** Staff: waiting ones, and what's coming up */
export const shoutsForStaff = (now = new Date()) => db.prepare("SELECT id, date, text, from_name, status FROM shoutouts WHERE date >= ? ORDER BY status = 'pending' DESC, date, id LIMIT 100").all(toDateStr(now)) as Shout[];
export function reviewShout(id: number, approve: boolean) {
  const r = approve ? db.prepare("UPDATE shoutouts SET status = 'approved' WHERE id = ?").run(id) : db.prepare("DELETE FROM shoutouts WHERE id = ?").run(id);
  return r.changes > 0;
}
