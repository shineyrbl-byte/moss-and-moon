// Reading and editing the menu in the database.
import "server-only";
import { db, getSetting } from "./db";
import { rotationFor, type MenuItem, type Rotation } from "./menu";
import { canMake, stockMap } from "./stock";
import { toDateStr } from "./cafe";
import { currentSeason } from "./seasonStore";

type Row = { id: string; data: string; sort: number };

function soldOutIds() {
  return new Set((db.prepare("SELECT item_id FROM sold_out").all() as { item_id: string }[]).map((r) => r.item_id));
}

/** Seasonal items only show between their dates */
export const inSeason = (m: MenuItem, today = toDateStr(new Date()), season: string | null = currentSeason()) =>
  (!m.from || m.from <= today) && (!m.until || m.until >= today) && (!m.season || m.season === season) && (!m.rotation || m.rotation === rotationNow());

/** Which part of the year's menu is on: by the calendar, unless the owner picked one */
export function rotationNow(): Rotation {
  const o = getSetting("rotation");
  return o === "summer" || o === "monsoon" || o === "winter" ? o : rotationFor();
}

/**
 * The menu in display order. Hidden and out-of-season items are left out unless asked for.
 * An item is sold out if staff said so, or if an ingredient it needs has run out.
 */
export function getMenu({ includeHidden = false } = {}): MenuItem[] {
  const out = soldOutIds();
  const today = toDateStr(new Date());
  const season = currentSeason();
  const have = stockMap();
  const loved = lovedScores();
  return (db.prepare("SELECT id, data, sort FROM menu_items ORDER BY sort, rowid").all() as Row[])
    .map((r) => {
      const m = { ...(JSON.parse(r.data) as MenuItem), id: r.id, ...(loved.has(r.id) ? { loved: loved.get(r.id) } : {}) };
      return { ...m, soldOut: out.has(r.id) || !canMake(m, have) || (m.stock !== undefined && m.stock <= 0) };
    })
    .filter((m) => includeHidden || (!m.hidden && inSeason(m, today, season)));
}

/** Thumbs-up share per item over the last 6 months, for items with at least 10 ratings */
export const LOVED_MIN = 10;
function lovedScores() {
  const rows = db.prepare("SELECT item_id, SUM(up) AS ups, COUNT(*) AS n FROM item_ratings WHERE created_at >= datetime('now','localtime','-180 days') GROUP BY item_id HAVING COUNT(*) >= ?").all(LOVED_MIN) as { item_id: string; ups: number; n: number }[];
  return new Map(rows.map((r) => [r.item_id, Math.round((r.ups / r.n) * 100)]));
}

/** One item that guests can order right now (visible), or undefined */
export function findOrderable(id: string): MenuItem | undefined {
  const r = db.prepare("SELECT id, data FROM menu_items WHERE id = ?").get(id) as Row | undefined;
  if (!r) return undefined;
  const item = { ...(JSON.parse(r.data) as MenuItem), id: r.id };
  return item.hidden || !inSeason(item) ? undefined : item;
}

/** A lookup function for pricing, loaded once per request */
export function menuLookup() {
  const map = new Map(getMenu().map((m) => [m.id, m]));
  return (id: string) => map.get(id);
}

/** Shop items with a stock count: the first one there aren't enough of, or null */
export function shopShortfall(lines: { itemId: string; qty: number }[]) {
  const need = new Map<string, number>();
  for (const l of lines) need.set(l.itemId, (need.get(l.itemId) ?? 0) + l.qty);
  for (const [id, qty] of need) {
    const r = db.prepare("SELECT data FROM menu_items WHERE id = ?").get(id) as { data: string } | undefined;
    const m = r && (JSON.parse(r.data) as MenuItem);
    if (m && m.stock !== undefined && m.stock < qty) return { name: m.name, left: m.stock };
  }
  return null;
}

/** Take sold shop items off their stock count */
export function takeShopStock(lines: { itemId: string; qty: number }[]) {
  for (const l of lines) {
    const r = db.prepare("SELECT data FROM menu_items WHERE id = ?").get(l.itemId) as { data: string } | undefined;
    if (!r) continue;
    const m = JSON.parse(r.data) as MenuItem;
    if (m.stock === undefined) continue;
    db.prepare("UPDATE menu_items SET data = ? WHERE id = ?").run(JSON.stringify({ ...m, stock: Math.max(0, m.stock - l.qty) }), l.itemId);
  }
}

/** Staff: set how many of a shop item are in stock */
export function setShopStock(id: string, stock: number) {
  const r = db.prepare("SELECT data FROM menu_items WHERE id = ?").get(id) as { data: string } | undefined;
  if (!r) return false;
  db.prepare("UPDATE menu_items SET data = ? WHERE id = ?").run(JSON.stringify({ ...JSON.parse(r.data), stock: Math.max(0, Math.min(9999, Math.round(stock))) }), id);
  return true;
}

export function saveItem(item: MenuItem) {
  const { soldOut: _ignored, ...data } = item;
  void _ignored;
  const exists = db.prepare("SELECT sort FROM menu_items WHERE id = ?").get(item.id) as { sort: number } | undefined;
  if (exists) {
    db.prepare("UPDATE menu_items SET data = ? WHERE id = ?").run(JSON.stringify(data), item.id);
  } else {
    // New items go to the end of their category
    const last = db.prepare("SELECT COALESCE(MAX(sort), 0) AS s FROM menu_items").get() as { s: number };
    db.prepare("INSERT INTO menu_items (id, data, sort) VALUES (?, ?, ?)").run(item.id, JSON.stringify(data), last.s + 10);
  }
}

export function deleteItem(id: string) {
  db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
  db.prepare("DELETE FROM sold_out WHERE item_id = ?").run(id);
}

/** Move an item one place up or down within the whole list */
export function moveItem(id: string, dir: -1 | 1) {
  const rows = db.prepare("SELECT id, sort FROM menu_items ORDER BY sort, rowid").all() as { id: string; sort: number }[];
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  const upd = db.prepare("UPDATE menu_items SET sort = ? WHERE id = ?");
  rows.forEach((r, k) => upd.run(k * 10, r.id));
}
