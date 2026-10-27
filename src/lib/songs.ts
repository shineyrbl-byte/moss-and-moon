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

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const VOTES = "(SELECT COUNT(*) FROM song_votes v WHERE v.song_id = song_requests.id)";

/** For guests and the TV: what's on and the next approved songs, most votes first (then the order they were asked for) */
export function nowPlaying(voterIn?: unknown) {
  const voter = cleanVoter(voterIn);
  const playing = (db.prepare(`SELECT ${COLS}, ${VOTES} AS votes FROM song_requests WHERE status = 'playing' ORDER BY played_at DESC LIMIT 1`).get() as (Song & { votes: number }) | undefined) ?? null;
  const next = db.prepare(`SELECT ${COLS}, ${VOTES} AS votes FROM song_requests WHERE status = 'queued' ORDER BY votes DESC, id LIMIT 8`).all() as (Song & { votes: number })[];
  const mine = new Set(voter ? (db.prepare("SELECT song_id FROM song_votes WHERE voter = ?").all(voter) as { song_id: number }[]).map((r) => r.song_id) : []);
  const pub = (s: Song & { votes: number }) => ({ id: s.id, title: s.title, artist: s.artist, name: s.name, votes: s.votes, mine: mine.has(s.id) });
  return { playing: playing && pub(playing), next: next.map(pub) };
}
/** A guest's vote for a song on the list (tap again to take it back) */
export function voteSong(b: Record<string, unknown>) {
  const voter = cleanVoter(b.voter), id = Math.floor(Number(b.id));
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const s = db.prepare("SELECT status FROM song_requests WHERE id = ?").get(id) as { status: string } | undefined;
  if (!s || s.status !== "queued") return { error: "You can vote for songs that are up next." };
  if (b.undo) db.prepare("DELETE FROM song_votes WHERE song_id = ? AND voter = ?").run(id, voter);
  else db.prepare("INSERT OR IGNORE INTO song_votes (song_id, voter) VALUES (?, ?)").run(id, voter);
  return nowPlaying(voter);
}

/** Staff: everything not yet played, plus the last few played */
export const songList = () => db.prepare(`SELECT ${COLS}, ${VOTES} AS votes FROM song_requests WHERE status != 'played' OR played_at >= datetime('now','localtime','-3 hours') ORDER BY CASE status WHEN 'playing' THEN 0 WHEN 'queued' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, CASE status WHEN 'queued' THEN -${VOTES} ELSE 0 END, id LIMIT 80`).all() as (Song & { votes: number })[];

/** approve → on the list · play → now playing (the last one counts as played) · done → played · remove → gone */
export function songAction(id: number, action: string) {
  const s = db.prepare("SELECT status FROM song_requests WHERE id = ?").get(id) as { status: string } | undefined;
  if (!s) return false;
  if (action === "approve") db.prepare("UPDATE song_requests SET status = 'queued' WHERE id = ? AND status = 'pending'").run(id);
  else if (action === "play") {
    db.prepare("UPDATE song_requests SET status = 'played' WHERE status = 'playing'").run();
    db.prepare("UPDATE song_requests SET status = 'playing', played_at = datetime('now','localtime') WHERE id = ?").run(id);
  } else if (action === "done") db.prepare("UPDATE song_requests SET status = 'played', played_at = COALESCE(played_at, datetime('now','localtime')) WHERE id = ?").run(id);
  else if (action === "remove") { db.prepare("DELETE FROM song_requests WHERE id = ?").run(id); db.prepare("DELETE FROM song_votes WHERE song_id = ?").run(id); }
  else return false;
  return true;
}
