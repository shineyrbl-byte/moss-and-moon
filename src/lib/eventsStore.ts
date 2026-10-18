// Events, stored in the database and managed in Admin → Events
import "server-only";
import { db, cleanText } from "./db";
import { parseDate, toDateStr, type CafeEvent } from "./cafe";

export function listEvents({ upcoming = false } = {}): CafeEvent[] {
  const all = (db.prepare("SELECT data FROM events").all() as { data: string }[]).map((r) => JSON.parse(r.data) as CafeEvent);
  const today = toDateStr(new Date());
  return all.filter((e) => !upcoming || e.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export const findEvent = (id: string) => {
  const r = db.prepare("SELECT data FROM events WHERE id = ?").get(id) as { data: string } | undefined;
  return r ? (JSON.parse(r.data) as CafeEvent) : undefined;
};

/** Check an event from the admin page; returns the event or a friendly error */
export function cleanEvent(b: Record<string, unknown>, existingId?: string): CafeEvent | { error: string } {
  const title = cleanText(b.title, 60);
  const desc = cleanText(b.desc, 300);
  const date = String(b.date ?? "");
  const time = String(b.time ?? "");
  const capacity = Math.floor(Number(b.capacity));
  const price = Math.floor(Number(b.price ?? 0));
  let img = String(b.img ?? "").trim();
  const m = /images\.unsplash\.com\/photo-([\w-]+)/.exec(img);
  if (m) img = m[1];
  if (!title) return { error: "Give the event a name." };
  if (!parseDate(date)) return { error: "Pick a date." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "Pick a start time." };
  if (!(capacity >= 1 && capacity <= 500)) return { error: "Spots should be between 1 and 500." };
  if (!(price >= 0 && price <= 20000)) return { error: "Ticket price should be ₹0 (free) to ₹20,000." };
  if (!img) img = "1501339847302-ac426a4a7cbb";
  if (!/^[\w-]+$/.test(img) && !/^\/api\/uploads\/[\w-]+\.(jpg|png|webp)$/.test(img)) return { error: "That photo link doesn't look right." };
  const id = existingId ?? `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30)}-${Math.random().toString(36).slice(2, 6)}`;
  // Packages: one per line in the editor, "Open mic + any drink | 150"
  const packages = (Array.isArray(b.packages) ? b.packages : [])
    .slice(0, 6)
    .map((p: { label?: unknown; price?: unknown }, i: number) => ({ id: `p${i + 1}`, label: cleanText(p?.label, 60), price: Math.floor(Number(p?.price)) }))
    .filter((p: { label: string; price: number }) => p.label && p.price > 0 && p.price <= 20000);
  return { id, title, date, time, desc, img, capacity, price, ...(packages.length ? { packages } : {}) };
}

export const saveEvent = (e: CafeEvent) =>
  db.prepare("INSERT INTO events (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data").run(e.id, JSON.stringify(e));

export function deleteEvent(id: string) {
  const sold = (db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE event_id = ? AND paid = 1").get(id) as { n: number }).n;
  if (sold) return { error: `${sold} ticket${sold === 1 ? " has" : "s have"} been sold for this. Refund or keep it instead of deleting.` };
  db.prepare("DELETE FROM events WHERE id = ?").run(id);
  db.prepare("DELETE FROM rsvps WHERE event_id = ?").run(id);
  return { ok: true };
}
