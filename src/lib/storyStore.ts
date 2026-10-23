// Six-word stories: approved by staff, hearted by guests. The week's favourite goes on the TV board.
import "server-only";
import { db, cleanText } from "./db";
import { isSixWords, storyWords } from "./stories";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
type Row = { id: number; text: string; name: string; created_at: string; hearts: number; mine?: number };

export function listStories(voter: unknown, sort: unknown) {
  const v = cleanVoter(voter) ?? "";
  const order = sort === "new" ? "s.id DESC" : "hearts DESC, s.id DESC";
  return db.prepare(`SELECT s.id, s.text, s.name, s.created_at, (SELECT COUNT(*) FROM story_hearts h WHERE h.story_id = s.id) AS hearts,
    EXISTS(SELECT 1 FROM story_hearts h WHERE h.story_id = s.id AND h.voter = ?) AS mine
    FROM stories s WHERE s.status = 'approved' ORDER BY ${order} LIMIT 60`).all(v).map((r) => ({ ...(r as Row), mine: !!(r as Row).mine }));
}

/** The most-hearted story shared in the last 7 days */
export const storyOfWeek = () => (db.prepare(`SELECT s.id, s.text, s.name, (SELECT COUNT(*) FROM story_hearts h WHERE h.story_id = s.id) AS hearts FROM stories s
  WHERE s.status = 'approved' AND s.created_at >= datetime('now','localtime','-7 days') ORDER BY hearts DESC, s.id DESC LIMIT 1`).get() as Row | undefined) ?? null;

export function addStory(b: Record<string, unknown>) {
  const text = cleanText(b.text, 120).replace(/[<>]/g, "");
  if (!isSixWords(text)) return { error: `Exactly six words, please. That's ${storyWords(text).length}.` };
  const name = cleanText(b.name, 20).replace(/[<>]/g, "");
  if ((db.prepare("SELECT COUNT(*) AS n FROM stories WHERE status = 'pending'").get() as { n: number }).n >= 200) return { error: "We've got lots to read right now. Try again tomorrow ✿" };
  db.prepare("INSERT INTO stories (text, name) VALUES (?, ?)").run(text, name);
  return { ok: true as const };
}

export function heartStory(b: Record<string, unknown>) {
  const v = cleanVoter(b.voter);
  const id = Math.floor(Number(b.id));
  if (!v) return { error: "Something went wrong. Refresh and try again." };
  if (!db.prepare("SELECT 1 FROM stories WHERE id = ? AND status = 'approved'").get(id)) return { error: "That story is gone." };
  if (b.on === false) db.prepare("DELETE FROM story_hearts WHERE story_id = ? AND voter = ?").run(id, v);
  else db.prepare("INSERT OR IGNORE INTO story_hearts (story_id, voter) VALUES (?, ?)").run(id, v);
  return { ok: true as const, hearts: (db.prepare("SELECT COUNT(*) AS n FROM story_hearts WHERE story_id = ?").get(id) as { n: number }).n };
}

export const storiesForStaff = () => db.prepare("SELECT id, text, name, status, created_at FROM stories ORDER BY status = 'pending' DESC, id DESC LIMIT 100").all() as { id: number; text: string; name: string; status: string; created_at: string }[];
export function reviewStory(id: number, approve: boolean) {
  if (!approve) db.prepare("DELETE FROM story_hearts WHERE story_id = ?").run(id);
  const r = approve ? db.prepare("UPDATE stories SET status = 'approved' WHERE id = ?").run(id) : db.prepare("DELETE FROM stories WHERE id = ?").run(id);
  return r.changes > 0;
}
