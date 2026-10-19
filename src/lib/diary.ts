// Coffee diary: a signed-in guest logs the drinks they try (here or anywhere), rates them,
// and gets a taste profile plus a "try this next" pick from our menu.
import "server-only";
import { db, cleanText } from "./db";
import { getMenu } from "./menuStore";
import { isDrink } from "./pricing";
import type { MenuItem } from "./menu";

export type DiaryEntry = { id: number; item_id: string | null; name: string; place: string | null; rating: number; note: string | null; order_code: string | null; created_at: string };

export function diaryEntries(customerId: number): DiaryEntry[] {
  return db.prepare("SELECT id, item_id, name, place, rating, note, order_code, created_at FROM coffee_diary WHERE customer_id = ? ORDER BY id DESC LIMIT 300").all(customerId) as DiaryEntry[];
}

/** Add one entry. A drink from our menu (itemId) or anything else (name + place). */
export function addDiaryEntry(customerId: number, b: Record<string, unknown>): DiaryEntry | { error: string } {
  const rating = Math.floor(Number(b.rating));
  if (!(rating >= 1 && rating <= 5)) return { error: "Give it 1 to 5 stars." };
  const menu = getMenu({ includeHidden: true });
  const item = typeof b.itemId === "string" ? menu.find((m) => m.id === b.itemId) : undefined;
  const name = item ? item.name : cleanText(b.name, 60);
  if (!name) return { error: "What did you drink?" };
  const place = item ? "Moss & Moon" : cleanText(b.place, 60) || null;
  const note = cleanText(b.note, 280) || null;
  // Rating a drink from one of your orders: once per order and dish
  let orderCode: string | null = null;
  if (b.orderCode && item) {
    const code = String(b.orderCode).toUpperCase();
    const mine = db.prepare("SELECT lines FROM orders WHERE code = ? AND customer_id = ?").get(code, customerId) as { lines: string } | undefined;
    if (!mine || !(JSON.parse(mine.lines) as { itemId: string }[]).some((l) => l.itemId === item.id)) return { error: "That drink isn't on one of your orders." };
    if (db.prepare("SELECT 1 FROM coffee_diary WHERE customer_id = ? AND order_code = ? AND item_id = ?").get(customerId, code, item.id)) return { error: "You've already rated that one ✿" };
    orderCode = code;
  }
  if ((db.prepare("SELECT COUNT(*) AS n FROM coffee_diary WHERE customer_id = ?").get(customerId) as { n: number }).n >= 1000) return { error: "Your diary is full. Delete a few old entries?" };
  const r = db.prepare("INSERT INTO coffee_diary (customer_id, item_id, name, place, rating, note, order_code) VALUES (?, ?, ?, ?, ?, ?, ?)").run(customerId, item?.id ?? null, name, place, rating, note, orderCode);
  return db.prepare("SELECT id, item_id, name, place, rating, note, order_code, created_at FROM coffee_diary WHERE id = ?").get(r.lastInsertRowid) as DiaryEntry;
}

export function deleteDiaryEntry(customerId: number, id: number) {
  return db.prepare("DELETE FROM coffee_diary WHERE customer_id = ? AND id = ?").run(customerId, id).changes > 0;
}

/** Drinks from your last 60 days of orders that you haven't rated yet */
export function toRate(customerId: number) {
  const menu = new Map(getMenu({ includeHidden: true }).map((m) => [m.id, m]));
  const rated = new Set((db.prepare("SELECT order_code || '|' || item_id AS k FROM coffee_diary WHERE customer_id = ? AND order_code IS NOT NULL").all(customerId) as { k: string }[]).map((r) => r.k));
  const rows = db.prepare("SELECT code, lines, created_at FROM orders WHERE customer_id = ? AND status != 'cancelled' AND created_at >= datetime('now','localtime','-60 days') ORDER BY id DESC LIMIT 30").all(customerId) as { code: string; lines: string; created_at: string }[];
  const out: { orderCode: string; itemId: string; name: string; date: string }[] = [];
  for (const o of rows) {
    for (const l of JSON.parse(o.lines) as { itemId: string }[]) {
      const m = menu.get(l.itemId);
      if (!m || !isDrink(m.cat) || rated.has(`${o.code}|${m.id}`) || out.some((x) => x.orderCode === o.code && x.itemId === m.id)) continue;
      out.push({ orderCode: o.code, itemId: m.id, name: m.name, date: o.created_at.slice(0, 10) });
    }
  }
  return out.slice(0, 8);
}

const WORDS = { energy: ["gentle", "balanced", "strong"], sweet: ["not sweet", "a little sweet", "sweet"] } as const;

/** Your taste, from the drinks you rated (better ratings count more) */
export function tasteProfile(entries: DiaryEntry[]) {
  const menu = new Map(getMenu().map((m) => [m.id, m]));
  const all = new Map(getMenu({ includeHidden: true }).map((m) => [m.id, m]));
  const withTraits = entries.map((e) => ({ e, m: e.item_id ? all.get(e.item_id) : undefined })).filter((x): x is { e: DiaryEntry; m: MenuItem & { traits: NonNullable<MenuItem["traits"]> } } => !!x.m?.traits);
  const places = new Set(entries.map((e) => e.place ?? "").filter(Boolean)).size;
  const avg = entries.length ? Math.round((entries.reduce((s, e) => s + e.rating, 0) / entries.length) * 10) / 10 : null;
  const best = [...entries].sort((a, b) => b.rating - a.rating || b.id - a.id).slice(0, 3).map((e) => ({ name: e.name, place: e.place, rating: e.rating }));
  if (withTraits.length < 2) return { count: entries.length, avg, places, best, words: null, energy: null, sweet: null, iced: null, tryNext: null };
  // Weight: 5★ counts 4×, 3★ counts 1×, 1★ pulls away a little
  const w = (r: number) => Math.max(0.2, r - 2);
  const total = withTraits.reduce((s, x) => s + w(x.e.rating), 0);
  const energy = withTraits.reduce((s, x) => s + x.m.traits.energy * w(x.e.rating), 0) / total;
  const sweet = withTraits.reduce((s, x) => s + x.m.traits.sweet * w(x.e.rating), 0) / total;
  const iced = withTraits.reduce((s, x) => s + (x.m.traits.temp === "iced" ? 1 : 0) * w(x.e.rating), 0) / total;
  const tried = new Set(entries.map((e) => e.item_id));
  const pick = [...menu.values()]
    .filter((m) => m.traits && !tried.has(m.id) && !m.soldOut && !m.kids)
    .map((m) => ({ m, d: Math.abs(m.traits!.energy - energy) + Math.abs(m.traits!.sweet - sweet) + Math.abs((m.traits!.temp === "iced" ? 1 : 0) - iced) * 1.5 }))
    .sort((a, b) => a.d - b.d)[0]?.m;
  const words = `${WORDS.energy[Math.round(energy)]}, ${WORDS.sweet[Math.round(sweet)]}, ${iced >= 0.6 ? "mostly iced" : iced <= 0.4 ? "mostly hot" : "hot or iced"}`;
  return {
    count: entries.length, avg, places, best, words,
    energy: Math.round((energy / 2) * 100), sweet: Math.round((sweet / 2) * 100), iced: Math.round(iced * 100),
    tryNext: pick ? { id: pick.id, name: pick.name, desc: pick.desc, price: pick.price } : null,
  };
}
