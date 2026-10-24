// Story chain: one sentence at a time, read by staff first. 20 lines and the story's done.
import "server-only";
import { db, cleanText } from "./db";
import { CHAIN_LINES, lineProblem, OPENERS } from "./storyChain";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
type Line = { id: number; text: string; name: string; voter: string };

function openStory() {
  const s = db.prepare("SELECT id, opener FROM chain_stories WHERE status = 'open' ORDER BY id LIMIT 1").get() as { id: number; opener: string } | undefined;
  if (s) return s;
  const n = (db.prepare("SELECT COUNT(*) AS n FROM chain_stories").get() as { n: number }).n;
  const r = db.prepare("INSERT INTO chain_stories (opener) VALUES (?)").run(OPENERS[n % OPENERS.length]);
  return { id: Number(r.lastInsertRowid), opener: OPENERS[n % OPENERS.length] };
}
const linesOf = (id: number) => db.prepare("SELECT id, text, name, voter FROM chain_lines WHERE story_id = ? AND status = 'approved' ORDER BY id").all(id) as Line[];

export function chainState(voter?: unknown) {
  const s = openStory();
  const v = cleanVoter(voter);
  const lines = linesOf(s.id);
  const waiting = v ? !!db.prepare("SELECT 1 FROM chain_lines WHERE story_id = ? AND voter = ? AND status = 'pending'").get(s.id, v) : false;
  const done = (db.prepare("SELECT id, opener, done_at FROM chain_stories WHERE status = 'done' ORDER BY id DESC LIMIT 10").all() as { id: number; opener: string; done_at: string }[])
    .map((d) => ({ ...d, lines: linesOf(d.id).map((l) => ({ text: l.text, name: l.name })) }));
  return {
    story: { id: s.id, opener: s.opener, lines: lines.map((l) => ({ text: l.text, name: l.name })) },
    left: CHAIN_LINES - 1 - lines.length, waiting, lastIsMine: !!v && lines.at(-1)?.voter === v, done,
  };
}

/** For the TV board: the newest line of the story being written */
export function latestChainLine() {
  const s = openStory();
  const l = linesOf(s.id).at(-1);
  return { text: l?.text ?? s.opener, name: l?.name ?? "", count: linesOf(s.id).length + 1 };
}

/** { text, name?, voter } */
export function addChainLine(b: Record<string, unknown>) {
  const v = cleanVoter(b.voter);
  if (!v) return { error: "Something went wrong. Refresh and try again." };
  const text = cleanText(b.text, 200).replace(/[<>]/g, "");
  const problem = lineProblem(text);
  if (problem) return { error: problem };
  const s = openStory();
  if (db.prepare("SELECT 1 FROM chain_lines WHERE story_id = ? AND voter = ? AND status = 'pending'").get(s.id, v)) return { error: "Your line is waiting to be read. Give it a moment ✿" };
  if (linesOf(s.id).at(-1)?.voter === v) return { error: "You wrote the last line! Let someone else carry it on." };
  if ((db.prepare("SELECT COUNT(*) AS n FROM chain_lines WHERE status = 'pending'").get() as { n: number }).n >= 100) return { error: "Lots of lines waiting right now. Try again later." };
  db.prepare("INSERT INTO chain_lines (story_id, text, name, voter) VALUES (?, ?, ?, ?)").run(s.id, text, cleanText(b.name, 20).replace(/[<>]/g, ""), v);
  return { ok: true as const };
}

export const chainForStaff = () => db.prepare("SELECT l.id, l.text, l.name, l.created_at, s.id AS story_id FROM chain_lines l JOIN chain_stories s ON s.id = l.story_id WHERE l.status = 'pending' AND s.status = 'open' ORDER BY l.id").all() as { id: number; text: string; name: string; created_at: string; story_id: number }[];

/** Staff: approve (adds it to the story) or remove a line */
export function reviewChainLine(id: number, approve: boolean) {
  const l = db.prepare("SELECT l.story_id, s.status FROM chain_lines l JOIN chain_stories s ON s.id = l.story_id WHERE l.id = ? AND l.status = 'pending'").get(id) as { story_id: number; status: string } | undefined;
  if (!l) return false;
  if (!approve) return db.prepare("DELETE FROM chain_lines WHERE id = ?").run(id).changes > 0;
  if (l.status !== "open") return false;
  db.prepare("UPDATE chain_lines SET status = 'approved' WHERE id = ?").run(id);
  if (linesOf(l.story_id).length >= CHAIN_LINES - 1) {
    db.prepare("UPDATE chain_stories SET status = 'done', done_at = datetime('now','localtime') WHERE id = ?").run(l.story_id);
    db.prepare("UPDATE chain_lines SET status = 'late' WHERE story_id = ? AND status = 'pending'").run(l.story_id);
    openStory();
  }
  return true;
}
