// Supplier reorders: when something runs low, a draft order is ready for the owner to
// approve; approving emails the supplier from Moss & Moon, and "received" restocks it.
import "server-only";
import { db } from "./db";
import { sendEmail } from "./email";
import { ownerEmail } from "./owner";
import { gstSettings } from "./gst";

type Ing = { id: string; name: string; unit: string; qty: number; low_at: number; supplier_name: string | null; supplier_email: string | null; reorder_qty: number | null };
export type PO = { id: number; ingredient_id: string; qty: number; status: "draft" | "sent" | "received" | "dismissed"; created_at: string; sent_at: string | null; received_at: string | null };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fmt = (n: number, unit: string) => (unit === "g" && n >= 1000 ? `${n / 1000} kg` : unit === "ml" && n >= 1000 ? `${n / 1000} L` : `${n} ${unit}`);

export const openPo = (ingredientId: string) => db.prepare("SELECT id FROM purchase_orders WHERE ingredient_id = ? AND status IN ('draft','sent')").get(ingredientId);

export function draftPo(ing: Ing, qty?: number) {
  if (openPo(ing.id)) return null;
  const amount = qty ?? ing.reorder_qty ?? Math.max(ing.low_at * 4, 1);
  const r = db.prepare("INSERT INTO purchase_orders (ingredient_id, qty) VALUES (?, ?)").run(ing.id, amount);
  return Number(r.lastInsertRowid);
}

/** Every 10 minutes: low stock with a supplier → a draft order, and a heads-up for the owner */
export async function reorderTick() {
  const low = db.prepare("SELECT * FROM ingredients WHERE qty <= low_at AND supplier_email IS NOT NULL AND supplier_email != ''").all() as Ing[];
  const made: Ing[] = [];
  for (const ing of low) if (draftPo(ing)) made.push(ing);
  if (made.length && ownerEmail())
    await sendEmail(
      ownerEmail(),
      `Running low: ${made.map((m) => m.name).join(", ")}`,
      `<p>These are running low, so draft orders are ready for your suppliers:</p><ul>${made.map((m) => `<li><b>${esc(m.name)}</b>: ${fmt(Math.round(m.qty), m.unit)} left → order ${fmt(m.reorder_qty ?? m.low_at * 4, m.unit)} from ${esc(m.supplier_name || m.supplier_email!)}</li>`).join("")}</ul><p>Approve them in Admin → Stock → Reorders. Nothing is sent until you do.</p>`
    );
}

export function listPos() {
  return db
    .prepare("SELECT p.*, i.name, i.unit, i.qty AS in_stock, i.supplier_name, i.supplier_email FROM purchase_orders p JOIN ingredients i ON i.id = p.ingredient_id WHERE p.status IN ('draft','sent') OR p.created_at >= datetime('now','localtime','-30 days') ORDER BY p.status = 'draft' DESC, p.id DESC")
    .all();
}

export async function sendPo(id: number, qty?: number) {
  const p = db.prepare("SELECT p.*, i.name, i.unit, i.supplier_name, i.supplier_email FROM purchase_orders p JOIN ingredients i ON i.id = p.ingredient_id WHERE p.id = ?").get(id) as (PO & Ing) | undefined;
  if (!p || p.status !== "draft") return { error: "Only drafts can be sent." };
  if (!p.supplier_email) return { error: "Add the supplier's email first." };
  const amount = qty && qty > 0 ? qty : p.qty;
  const g = gstSettings();
  const ok = await sendEmail(
    p.supplier_email,
    `Order from Moss & Moon: ${fmt(amount, p.unit)} ${p.name}`,
    `<p>Hello${p.supplier_name ? ` ${esc(p.supplier_name)}` : ""},</p>
     <p>We'd like to order:</p>
     <p style="font-size:18px"><b>${fmt(amount, p.unit)} ${esc(p.name)}</b></p>
     <p>Please deliver to <b>${esc(g.on && g.address ? g.address : "Moss & Moon, 14 Willow Lane")}</b>${g.on && g.gstin ? ` (GSTIN ${esc(g.gstin)})` : ""} and reply with the price and delivery date.</p>
     <p>Thank you!<br>Moss &amp; Moon${ownerEmail() ? `<br><a href="mailto:${esc(ownerEmail())}">${esc(ownerEmail())}</a>` : ""}</p>`
  );
  if (!ok) return { error: "The email didn't send. Check Admin → Health." };
  db.prepare("UPDATE purchase_orders SET status = 'sent', qty = ?, sent_at = datetime('now','localtime') WHERE id = ?").run(amount, id);
  return { ok: true };
}

export function receivePo(id: number, qty?: number) {
  const p = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id) as PO | undefined;
  if (!p || p.status !== "sent") return { error: "Only sent orders can be received." };
  const amount = qty && qty > 0 ? qty : p.qty;
  db.prepare("UPDATE ingredients SET qty = qty + ? WHERE id = ?").run(amount, p.ingredient_id);
  db.prepare("UPDATE purchase_orders SET status = 'received', qty = ?, received_at = datetime('now','localtime') WHERE id = ?").run(amount, id);
  return { ok: true };
}

export function dismissPo(id: number) {
  const r = db.prepare("UPDATE purchase_orders SET status = 'dismissed' WHERE id = ? AND status IN ('draft','sent')").run(id);
  return r.changes ? { ok: true } : { error: "Order not found." };
}
