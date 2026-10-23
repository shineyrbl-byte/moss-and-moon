// Thank the team: kind notes from guests to someone on the team. Only staff ever see them.
import "server-only";
import { db, cleanText } from "./db";
import type { Staff } from "./auth";

export const NOTE_MAX = 300;

export function addNote(b: Record<string, unknown>) {
  const staffId = Math.floor(Number(b.staffId));
  const shown = db.prepare("SELECT 1 FROM team_profiles p JOIN staff s ON s.id = p.staff_id WHERE p.staff_id = ? AND p.show = 1 AND s.active = 1").get(staffId);
  if (!shown) return { error: "We couldn't find that team member." };
  const text = cleanText(b.text, NOTE_MAX).replace(/[<>]/g, "");
  if (text.length < 3) return { error: "Write a few words first ✿" };
  const name = cleanText(b.name, 30).replace(/[<>]/g, "") || "A guest";
  db.prepare("INSERT INTO team_notes (staff_id, from_name, text) VALUES (?, ?, ?)").run(staffId, name, text);
  return { ok: true as const };
}

type Note = { id: number; staff_id: number; to_name: string; from_name: string; text: string; created_at: string };
/** Owners see every note; everyone else sees their own */
export function notesFor(s: Staff): Note[] {
  const base = "SELECT n.id, n.staff_id, s.name AS to_name, n.from_name, n.text, n.created_at FROM team_notes n JOIN staff s ON s.id = n.staff_id";
  return (s.role === "owner"
    ? db.prepare(`${base} ORDER BY n.id DESC LIMIT 200`).all()
    : db.prepare(`${base} WHERE n.staff_id = ? ORDER BY n.id DESC LIMIT 200`).all(s.id)) as Note[];
}
export const deleteNote = (id: number) => db.prepare("DELETE FROM team_notes WHERE id = ?").run(id).changes > 0;
