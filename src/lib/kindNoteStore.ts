// Notes for a stranger: notes wait for staff, then go to whoever writes next. Never your own back.
import "server-only";
import { db, cleanText } from "./db";
import { HOUSE_NOTES, NOTE_MAX, noteProblem } from "./kindNotes";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);

/** { text, voter }: saves your note, hands you someone else's */
export function swapNote(b: Record<string, unknown>) {
  const voter = cleanVoter(b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const text = cleanText(b.text, NOTE_MAX).replace(/[<>]/g, "");
  const problem = noteProblem(text);
  if (problem) return { error: problem };
  if ((db.prepare("SELECT COUNT(*) AS n FROM kind_notes WHERE status = 'pending'").get() as { n: number }).n >= 200) return { error: "The jar's full right now. Try again tomorrow ✿" };
  db.prepare("INSERT INTO kind_notes (text, voter) VALUES (?, ?)").run(text, voter);
  // The least-read approved note someone else wrote, with a little luck in the mix
  const pick = db.prepare("SELECT id, text FROM kind_notes WHERE status = 'approved' AND voter != ? ORDER BY given, random() LIMIT 1").get(voter) as { id: number; text: string } | undefined;
  if (pick) {
    db.prepare("UPDATE kind_notes SET given = given + 1 WHERE id = ?").run(pick.id);
    return { ok: true as const, note: pick.text, house: false };
  }
  return { ok: true as const, note: HOUSE_NOTES[Math.floor(Math.random() * HOUSE_NOTES.length)], house: true };
}

export const kindNoteCounts = () => db.prepare("SELECT COUNT(*) AS notes, COALESCE(SUM(given), 0) AS given FROM kind_notes WHERE status = 'approved'").get() as { notes: number; given: number };
export const notesForStaff = () => db.prepare("SELECT id, text, status, given, created_at FROM kind_notes ORDER BY status = 'pending' DESC, id DESC LIMIT 100").all() as { id: number; text: string; status: string; given: number; created_at: string }[];
export function reviewNote(id: number, approve: boolean) {
  const r = approve ? db.prepare("UPDATE kind_notes SET status = 'approved' WHERE id = ?").run(id) : db.prepare("DELETE FROM kind_notes WHERE id = ?").run(id);
  return r.changes > 0;
}
