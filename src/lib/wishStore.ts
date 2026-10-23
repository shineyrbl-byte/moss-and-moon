// The wish tree. Wishes since the last full moon hang on the tree; their words show once staff have had a look.
import "server-only";
import { db, cleanText } from "./db";
import { fullMoonAround } from "./moon";
import { RIBBONS, WISH_MAX } from "./wishes";

export function treeNow(now = new Date()) {
  const { prev, next } = fullMoonAround(now);
  const rows = db.prepare("SELECT id, text, name, colour, status FROM wishes WHERE created_ms >= ? ORDER BY id").all(prev) as { id: number; text: string; name: string; colour: number; status: string }[];
  const total = (db.prepare("SELECT COUNT(*) AS n FROM wishes").get() as { n: number }).n;
  return {
    since: prev, nextFull: next,
    wishes: rows.map((r) => ({ id: r.id, colour: r.colour, ...(r.status === "approved" ? { text: r.text, name: r.name } : {}) })),
    total, letGo: total - rows.length,
  };
}

export function addWish(b: Record<string, unknown>, now = new Date()) {
  const text = cleanText(b.text, WISH_MAX).replace(/[<>]/g, "");
  if (text.length < 3) return { error: "Write a little wish first ✿" };
  const name = cleanText(b.name, 20).replace(/[<>]/g, "");
  const colour = Math.max(0, Math.min(RIBBONS.length - 1, Math.floor(Number(b.colour) || 0)));
  const { prev } = fullMoonAround(now);
  if ((db.prepare("SELECT COUNT(*) AS n FROM wishes WHERE created_ms >= ?").get(prev) as { n: number }).n >= 300) return { error: "The tree is full until the next full moon ✿" };
  const r = db.prepare("INSERT INTO wishes (text, name, colour, created_ms) VALUES (?, ?, ?, ?)").run(text, name, colour, now.getTime());
  return { ok: true as const, id: Number(r.lastInsertRowid), tree: treeNow(now) };
}

export const wishesForStaff = (now = new Date()) => db.prepare("SELECT id, text, name, status, created_at FROM wishes WHERE created_ms >= ? ORDER BY status = 'pending' DESC, id DESC").all(fullMoonAround(now).prev) as { id: number; text: string; name: string; status: string; created_at: string }[];
export function reviewWish(id: number, approve: boolean) {
  const r = approve ? db.prepare("UPDATE wishes SET status = 'approved' WHERE id = ?").run(id) : db.prepare("DELETE FROM wishes WHERE id = ?").run(id);
  return r.changes > 0;
}
