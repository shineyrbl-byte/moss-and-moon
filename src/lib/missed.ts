// Sales we missed because something was sold out, and "tell me when it's back" emails
import "server-only";
import { alertOwner } from "./push";
import { db } from "./db";
import { getMenu, menuLookup } from "./menuStore";
import { sendEmail } from "./email";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const SITE = () => process.env.SITE_URL || "http://localhost:3000";

export function recordMissed(items: { itemId: string; qty?: number }[], reason: "sold out" | "low stock" | "wanted") {
  const find = menuLookup();
  const add = db.prepare("INSERT INTO missed_sales (item_id, item_name, qty, reason) VALUES (?, ?, ?, ?)");
  for (const i of items) {
    const m = find(i.itemId);
    if (!m) continue;
    // First time today someone misses it: tell the owner
    const first = !db.prepare("SELECT 1 FROM missed_sales WHERE item_id = ? AND date(created_at) = date('now','localtime')").get(m.id);
    add.run(m.id, m.name, Math.max(1, Math.min(20, Math.floor(i.qty ?? 1))), reason);
    if (first && reason !== "wanted") alertOwner("soldout", `${m.name} is sold out`, "A guest just tried to order it. Make more, or mark it back when it's ready.", "/admin#Stock");
  }
}

/** Owner: what guests wanted but couldn't get, last 30 days */
export function missedReport() {
  const rows = db.prepare(
    `SELECT item_id, item_name, SUM(qty) AS qty, COUNT(*) AS times, MAX(created_at) AS last
     FROM missed_sales WHERE created_at >= datetime('now','localtime','-30 days') GROUP BY item_id ORDER BY qty DESC LIMIT 20`,
  ).all() as { item_id: string; item_name: string; qty: number; times: number; last: string }[];
  const find = menuLookup();
  const waiting = new Map((db.prepare("SELECT item_id, COUNT(*) AS n FROM stock_alerts WHERE sent_at IS NULL GROUP BY item_id").all() as { item_id: string; n: number }[]).map((r) => [r.item_id, r.n]));
  return rows.map((r) => ({ ...r, lost: Math.round(r.qty * (find(r.item_id)?.price ?? 0)), waiting: waiting.get(r.item_id) ?? 0 }));
}

/** Called every few minutes: email guests whose item is back */
export async function stockAlertTick() {
  const pending = db.prepare("SELECT id, item_id, email FROM stock_alerts WHERE sent_at IS NULL LIMIT 200").all() as { id: number; item_id: string; email: string }[];
  if (!pending.length) return;
  const available = new Map(getMenu().filter((m) => !m.soldOut).map((m) => [m.id, m]));
  for (const a of pending) {
    const m = available.get(a.item_id);
    if (!m) continue;
    if (db.prepare("UPDATE stock_alerts SET sent_at = datetime('now','localtime') WHERE id = ? AND sent_at IS NULL").run(a.id).changes === 0) continue;
    await sendEmail(a.email, `${m.name} is back ✿`, `<p>Good news: <b>${esc(m.name)}</b> is available again at Moss &amp; Moon.</p><p><a href="${SITE()}/#menu">Order it now</a> before it goes again!</p><p style="color:#8a6a5c;font-size:12px">You asked us to tell you. This is a one-off email.</p>`);
  }
  // Tidy up very old alerts
  db.prepare("DELETE FROM stock_alerts WHERE created_at < datetime('now','localtime','-60 days')").run();
}
