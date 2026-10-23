// Song requests: guests ask for a song, staff approve it, and the TV board shows what's playing and what's next.
import "server-only";
import { db, cleanText } from "./db";

export type Song = { id: number; title: string; artist: string; name: string; table_no: number | null; status: "pending" | "queued" | "playing" | "played"; created_at: string };
const COLS = "id, title, artist, name, table_no, status, created_at";
const BAD = /\b(fuck|shit|bitch|cunt|porn|nazi|chutiya|madarchod|bhenchod|gandu)\b/i;
const MAX_WAITING = 40;

export function requestSong(b: Record<string, unknown>): { ok: true; id: number } | { error: string } {
  const title = cleanText(b.title, 80).replace(/[<>]/g, "");
  const artist = cleanText(b.artist, 60).replace(/[<>]/g, "");
  const name = cleanText(b.name, 30).replace(/[<>]/g, "") || "A guest";
  const table = Math.floor(Number(b.table));
  if (title.length < 2) return { error: "Which song?" };
  if ([title, artist, name].some((x) => BAD.test(x))) return { error: "Let's keep it kind ✿" };
  const waiting = db.prepare("SELECT title FROM song_requests WHERE status IN ('pending','queued','playing')").all() as { title: string }[];
  if (waiting.length >= MAX_WAITING) return { error: "The list is full right now. Try again a little later 🎵" };
  if (waiting.some((w) => w.title.toLowerCase() === title.toLowerCase())) return { error: "Someone's already asked for that one. It's on the list 🎶" };
  const r = db.prepare("INSERT INTO song_requests (title, artist, name, table_no) VALUES (?, ?, ?, ?)").run(title, artist, name, table >= 1 && table <= 99 ? table : null);
  return { ok: true, id: Number(r.lastInsertRowid) };
}

/** For guests and the TV: what's on and the next few approved songs */
export function nowPlaying() {
  const playing = (db.prepare(`SELECT ${COLS} FROM song_requests WHERE status = 'playing' ORDER BY played_at DESC LIMIT 1`).get() as Song | undefined) ?? null;
  const next = db.prepare(`SELECT ${COLS} FROM song_requests WHERE status = 'queued' ORDER BY id LIMIT 5`).all() as Song[];
  const pub = (s: Song) => ({ id: s.id, title: s.title, artist: s.artist, name: s.name });
  return { playing: playing && pub(playing), next: next.map(pub) };
}

/** Staff: everything not yet played, plus the last few played */
export const songList = () => db.prepare(`SELECT ${COLS} FROM song_requests WHERE status != 'played' OR played_at >= datetime('now','localtime','-3 hours') ORDER BY CASE status WHEN 'playing' THEN 0 WHEN 'queued' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, id LIMIT 80`).all() as Song[];

/** approve → on the list · play → now playing (the last one counts as played) · done → played · remove → gone */
export function songAction(id: number, action: string) {
  const s = db.prepare("SELECT status FROM song_requests WHERE id = ?").get(id) as { status: string } | undefined;
  if (!s) return false;
  if (action === "approve") db.prepare("UPDATE song_requests SET status = 'queued' WHERE id = ? AND status = 'pending'").run(id);
  else if (action === "play") {
    db.prepare("UPDATE song_requests SET status = 'played' WHERE status = 'playing'").run();
    db.prepare("UPDATE song_requests SET status = 'playing', played_at = datetime('now','localtime') WHERE id = ?").run(id);
  } else if (action === "done") db.prepare("UPDATE song_requests SET status = 'played', played_at = COALESCE(played_at, datetime('now','localtime')) WHERE id = ?").run(id);
  else if (action === "remove") db.prepare("DELETE FROM song_requests WHERE id = ?").run(id);
  else return false;
  return true;
}
