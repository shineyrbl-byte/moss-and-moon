// Reading and editing the menu in the database.
import "server-only";
import { db } from "./db";
import type { MenuItem } from "./menu";

type Row = { id: string; data: string; sort: number };

function soldOutIds() {
  return new Set((db.prepare("SELECT item_id FROM sold_out").all() as { item_id: string }[]).map((r) => r.item_id));
}

/** The menu in display order. Hidden items are left out unless asked for. */
export function getMenu({ includeHidden = false } = {}): MenuItem[] {
  const out = soldOutIds();
  return (db.prepare("SELECT id, data, sort FROM menu_items ORDER BY sort, rowid").all() as Row[])
    .map((r) => ({ ...(JSON.parse(r.data) as MenuItem), id: r.id, soldOut: out.has(r.id) }))
    .filter((m) => includeHidden || !m.hidden);
}

/** One item that guests can order right now (visible), or undefined */
export function findOrderable(id: string): MenuItem | undefined {
  const r = db.prepare("SELECT id, data FROM menu_items WHERE id = ?").get(id) as Row | undefined;
  if (!r) return undefined;
  const item = { ...(JSON.parse(r.data) as MenuItem), id: r.id };
  return item.hidden ? undefined : item;
}

/** A lookup function for pricing, loaded once per request */
export function menuLookup() {
  const map = new Map(getMenu().map((m) => [m.id, m]));
  return (id: string) => map.get(id);
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
