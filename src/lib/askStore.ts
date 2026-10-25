// Ask us anything: guests ask, staff answer, and answered questions become a living FAQ.
import "server-only";
import { db, cleanText } from "./db";

export const Q_MAX = 200, A_MAX = 600;
const clean = (v: unknown, n: number) => cleanText(v, n).replace(/[<>]/g, "");
type Q = { id: number; q: string; name: string; answer: string | null; answered_by: string | null; status: string; created_at: string; answered_at: string | null };

export const answered = () => db.prepare("SELECT id, q, name, answer, answered_by, answered_at FROM questions WHERE status = 'answered' ORDER BY answered_at DESC LIMIT 200").all() as Q[];

/** { q, name? } */
export function askQuestion(b: Record<string, unknown>) {
  const q = clean(b.q, Q_MAX + 40);
  if (q.length < 10) return { error: "Ask a whole question, please." };
  if (q.length > Q_MAX) return { error: `Keep it under ${Q_MAX} letters.` };
  if (/https?:|www\./i.test(q)) return { error: "No links, please." };
  if ((db.prepare("SELECT COUNT(*) AS n FROM questions WHERE status = 'pending'").get() as { n: number }).n >= 100) return { error: "Lots of questions waiting. Try again later, or ask at the counter!" };
  db.prepare("INSERT INTO questions (q, name) VALUES (?, ?)").run(q, clean(b.name, 20));
  return { ok: true as const };
}

export const questionsForStaff = () => db.prepare("SELECT id, q, name, answer, answered_by, status, created_at, answered_at FROM questions ORDER BY status = 'pending' DESC, id DESC LIMIT 100").all() as Q[];
/** Staff: { id, answer } to answer (or edit an answer), { id, remove: true } to delete */
export function answerQuestion(b: Record<string, unknown>, staffName: string) {
  const id = Math.floor(Number(b.id));
  if (b.remove) return db.prepare("DELETE FROM questions WHERE id = ?").run(id).changes > 0 ? { ok: true as const } : { error: "Not found." };
  const answer = clean(b.answer, A_MAX);
  if (answer.length < 2) return { error: "Write an answer first." };
  const r = db.prepare("UPDATE questions SET answer = ?, answered_by = ?, status = 'answered', answered_at = datetime('now','localtime') WHERE id = ?").run(answer, staffName.trim().split(/\s+/)[0] || null, id);
  return r.changes > 0 ? { ok: true as const } : { error: "Not found." };
}
