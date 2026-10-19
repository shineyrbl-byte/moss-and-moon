// The café shelf: board games and books. Games can be reserved with a table booking.
import "server-only";
import { db, cleanText } from "./db";
export { SEED_SHELF } from "./shelfSeed";

export type ShelfItem = { id: string; kind: "game" | "book"; title: string; detail: string; minutes: number | null; note: string | null; out: number; sort: number };


export function shelf(): ShelfItem[] {
  return db.prepare("SELECT id, kind, title, detail, minutes, note, out, sort FROM shelf ORDER BY kind DESC, sort, title").all() as ShelfItem[];
}

/** Games already promised to another table near that time (within 2 hours) */
export function gamesTaken(date: string, time: string, exceptCode?: string) {
  const rows = db.prepare("SELECT game, time FROM bookings WHERE date = ? AND game IS NOT NULL AND status IN ('confirmed','pending','seated') AND code != ?").all(date, exceptCode ?? "") as { game: string; time: string }[];
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return new Set(rows.filter((r) => Math.abs(mins(r.time) - mins(time)) < 120).map((r) => r.game));
}

/** Check a game for a booking: returns the game, or why it can't be reserved */
export function checkGame(id: unknown, date: string, time: string): ShelfItem | { error: string } | null {
  if (!id) return null;
  const g = db.prepare("SELECT id, kind, title, detail, minutes, note, out, sort FROM shelf WHERE id = ?").get(String(id)) as ShelfItem | undefined;
  if (!g || g.kind !== "game") return { error: "We couldn't find that game." };
  if (g.out) return { error: `${g.title} is off the shelf right now. Pick another game?` };
  if (gamesTaken(date, time).has(g.id)) return { error: `Another table has ${g.title} around then. Pick another game, or another time?` };
  return g;
}

export function saveShelfItem(b: Record<string, unknown>): ShelfItem | { error: string } {
  const title = cleanText(b.title, 80);
  if (!title) return { error: "Give it a name." };
  const kind = b.kind === "book" ? "book" : "game";
  const id = typeof b.id === "string" && /^[\w-]{1,60}$/.test(b.id) ? b.id : `${kind}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${Math.random().toString(36).slice(2, 5)}`;
  const minutes = Number(b.minutes) > 0 && Number(b.minutes) <= 600 ? Math.round(Number(b.minutes)) : null;
  db.prepare(`INSERT INTO shelf (id, kind, title, detail, minutes, note, out, sort) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort) FROM shelf), 0) + 1)
    ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, title = excluded.title, detail = excluded.detail, minutes = excluded.minutes, note = excluded.note, out = excluded.out`)
    .run(id, kind, title, cleanText(b.detail, 80), minutes, cleanText(b.note, 160) || null, b.out ? 1 : 0);
  return db.prepare("SELECT id, kind, title, detail, minutes, note, out, sort FROM shelf WHERE id = ?").get(id) as ShelfItem;
}

export const deleteShelfItem = (id: string) => db.prepare("DELETE FROM shelf WHERE id = ?").run(id).changes > 0;
