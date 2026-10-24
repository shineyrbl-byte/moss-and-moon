// Lost & found: staff post what was left behind, guests say "that's mine" and get a code to show at the counter.
import "server-only";
import { randomInt } from "node:crypto";
import { db, cleanText } from "./db";

export const LOST_DAYS = 30;
const clean = (v: unknown, n: number) => cleanText(v, n).replace(/[<>]/g, "");
type Item = { id: number; what: string; where_found: string; found_on: string; img: string | null; claims: number };

/** Still waiting for their owner, found in the last 30 days */
export const lostItems = () => db.prepare(`SELECT i.id, i.what, i.where_found, i.found_on, i.img, (SELECT COUNT(*) FROM lost_claims c WHERE c.item_id = i.id) AS claims
  FROM lost_items i WHERE i.status = 'open' AND i.found_on >= date('now','localtime','-${LOST_DAYS} days') ORDER BY i.found_on DESC, i.id DESC`).all() as Item[];

/** Staff: everything still open (even older), with who's claimed it */
export function lostForStaff() {
  const items = db.prepare("SELECT id, what, where_found, found_on, img, status FROM lost_items WHERE status = 'open' ORDER BY found_on DESC, id DESC LIMIT 100").all() as (Item & { status: string })[];
  const claims = db.prepare("SELECT id, item_id, code, name, detail, created_at FROM lost_claims WHERE item_id IN (SELECT id FROM lost_items WHERE status = 'open') ORDER BY id").all() as { id: number; item_id: number; code: string; name: string; detail: string; created_at: string }[];
  return items.map((i) => ({ ...i, old: i.found_on < new Date(Date.now() - LOST_DAYS * 86400_000).toISOString().slice(0, 10), claims: claims.filter((c) => c.item_id === i.id) }));
}

export function addLost(b: Record<string, unknown>, img: string | null) {
  const what = clean(b.what, 60);
  if (!what) return { error: "What was it? \"Blue umbrella\" is plenty." };
  const found = typeof b.foundOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.foundOn) ? b.foundOn : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const r = db.prepare("INSERT INTO lost_items (what, where_found, found_on, img) VALUES (?, ?, ?, ?)").run(what, clean(b.where, 60), found, img);
  return { ok: true as const, id: Number(r.lastInsertRowid) };
}

/** Guests: { id, name, detail }, describe it so staff know it's really yours */
export function claimLost(b: Record<string, unknown>) {
  const id = Math.floor(Number(b.id));
  const name = clean(b.name, 40), detail = clean(b.detail, 300);
  if (!name) return { error: "Your name, please, so we know who to hand it to." };
  if (detail.length < 8) return { error: "Tell us something only the owner would know (a colour, a sticker, what's inside)." };
  if (!db.prepare(`SELECT 1 FROM lost_items WHERE id = ? AND status = 'open'`).get(id)) return { error: "That one's already gone home." };
  if ((db.prepare("SELECT COUNT(*) AS n FROM lost_claims WHERE item_id = ?").get(id) as { n: number }).n >= 10) return { error: "Lots of people have asked about this one. Come and ask at the counter." };
  const code = `LF-${randomInt(1000, 10000)}`;
  db.prepare("INSERT INTO lost_claims (item_id, code, name, detail) VALUES (?, ?, ?, ?)").run(id, code, name, detail);
  return { ok: true as const, code };
}

/** Staff: back with its owner (or given away) */
export const closeLost = (id: number, status: "returned" | "removed") => db.prepare("UPDATE lost_items SET status = ? WHERE id = ? AND status = 'open'").run(status, id).changes > 0;
