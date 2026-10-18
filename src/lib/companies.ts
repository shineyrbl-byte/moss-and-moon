// Company tabs: an office's staff order on the company's account; one invoice a month
import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db, makeCode } from "./db";
import { orderDue, rupees } from "./pricing";
import { gstSettings, taxSplit } from "./gst";
import { sendEmail } from "./email";

export type Company = { id: number; name: string; billing_email: string; gstin: string | null; join_code: string; monthly_limit: number | null; active: number };
type O = { code: string; name: string; created_at: string; total: number; giftcard_used: number; credit_used: number; tip: number; delivery_fee: number; refund_amount: number };

export const newJoinCode = () => makeCode("CO", 6);
/** The company a guest orders for (one at a time) */
export const companyFor = (customerId: number) =>
  (db.prepare("SELECT c.* FROM companies c JOIN company_members m ON m.company_id = c.id WHERE m.customer_id = ? AND c.active = 1 LIMIT 1").get(customerId) as Company | undefined) ?? null;

/** What one person has spent on the company tab this month (for the per-person limit) */
export const spentThisMonth = (companyId: number, customerId: number) =>
  (db.prepare("SELECT COALESCE(SUM(total + delivery_fee + tip), 0) AS s FROM orders WHERE company_id = ? AND customer_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime') AND status != 'cancelled'").get(companyId, customerId) as { s: number }).s;

export function monthOrders(companyId: number, month: string) {
  return db.prepare("SELECT code, name, created_at, total, giftcard_used, credit_used, tip, delivery_fee, refund_amount FROM orders WHERE company_id = ? AND strftime('%Y-%m', created_at) = ? AND status != 'cancelled' ORDER BY id").all(companyId, month) as O[];
}
export const monthTotal = (orders: O[]) => orders.reduce((s, o) => s + orderDue(o) - (o.refund_amount ?? 0), 0);

export function companiesOverview(month: string) {
  const list = db.prepare("SELECT * FROM companies ORDER BY active DESC, name").all() as Company[];
  return list.map((c) => {
    const orders = monthOrders(c.id, month);
    const members = (db.prepare("SELECT cu.id, cu.name, cu.email FROM company_members m JOIN customers cu ON cu.id = m.customer_id WHERE m.company_id = ? ORDER BY cu.name").all(c.id) as { id: number; name: string | null; email: string }[]);
    const invoice = db.prepare("SELECT amount, orders, sent_at, paid_at FROM company_invoices WHERE company_id = ? AND month = ?").get(c.id, month) ?? null;
    const unpaid = db.prepare("SELECT month, amount FROM company_invoices WHERE company_id = ? AND paid_at IS NULL ORDER BY month").all(c.id) as { month: string; amount: number }[];
    return { ...c, members, orders: orders.length, total: Math.round(monthTotal(orders)), invoice, unpaid };
  });
}

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "").trim();
const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function invoicePdf(c: Company, month: string, orders: O[]) {
  const pdf = await PDFDocument.create();
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const gst = gstSettings();
  const BROWN = rgb(0.23, 0.15, 0.13), MUTED = rgb(0.52, 0.4, 0.35);
  const label = new Date(month + "-01T12:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  let page = pdf.addPage([595, 842]);
  let y = 790;
  const text = (t: string, x: number, size = 10, f = sans, color = BROWN) => page.drawText(plain(t), { x, y, size, font: f, color });
  const right = (t: string, size = 10, f = sans) => page.drawText(plain(t), { x: 555 - f.widthOfTextAtSize(plain(t), size), y, size, font: f, color: BROWN });
  text("Moss & Moon", 40, 24, serif); right("MONTHLY INVOICE", 10, bold);
  y -= 18; text(gst.on && gst.address ? gst.address : "14 Willow Lane", 40, 9, sans, MUTED); right(`${c.name} - ${label}`, 10);
  if (gst.on) { y -= 13; text(`GSTIN ${gst.gstin}`, 40, 9, bold); }
  y -= 26; text(`Bill to: ${c.name}${c.gstin ? `  (GSTIN ${c.gstin})` : ""}`, 40, 11, bold);
  y -= 14; text(c.billing_email, 40, 9, sans, MUTED);
  y -= 26; text("Date", 40, 9, bold); text("Order", 120, 9, bold); text("For", 210, 9, bold); right("Amount", 9, bold);
  y -= 6; page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: MUTED });
  for (const o of orders) {
    y -= 16;
    if (y < 120) { page = pdf.addPage([595, 842]); y = 790; }
    text(o.created_at.slice(0, 10), 40, 9); text(o.code, 120, 9); text(o.name.slice(0, 40), 210, 9);
    right(rs(orderDue(o) - (o.refund_amount ?? 0)), 9);
  }
  const total = monthTotal(orders);
  y -= 14; page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: MUTED });
  y -= 20; text(`${orders.length} orders`, 40, 10, sans, MUTED); right(`Total ${rs(total)}`, 13, bold);
  if (gst.on && gst.rate > 0) {
    const t = taxSplit({ total: orders.reduce((s, o) => s + o.total - (o.refund_amount ?? 0), 0), delivery_fee: orders.reduce((s, o) => s + o.delivery_fee, 0) }, gst.rate);
    y -= 18; right(`Taxable ${rs(t.taxable)} - CGST ${rs(t.cgst)} - SGST ${rs(t.sgst)} (prices include GST; tips not taxed)`, 8);
  }
  y -= 30; text("Please pay within 15 days by UPI or bank transfer. Thank you for keeping your team caffeinated!", 40, 9, sans, MUTED);
  return { pdf: await pdf.save(), total };
}

export async function sendInvoice(c: Company, month: string) {
  const orders = monthOrders(c.id, month);
  if (!orders.length) return { error: "No orders on the tab that month." };
  const { pdf, total } = await invoicePdf(c, month, orders);
  db.prepare("INSERT INTO company_invoices (company_id, month, amount, orders) VALUES (?, ?, ?, ?) ON CONFLICT(company_id, month) DO UPDATE SET amount = excluded.amount, orders = excluded.orders, sent_at = datetime('now','localtime')").run(c.id, month, total, orders.length);
  const label = new Date(month + "-01T12:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  await sendEmail(c.billing_email, `Moss & Moon invoice for ${label}: ${rupees(Math.round(total))}`, `<p>Hello ${c.name} team,</p><p>Here's this month's invoice for <b>${orders.length} orders</b> on your Moss &amp; Moon tab: <b>${rupees(Math.round(total))}</b>. The PDF with every order is attached.</p><p>Thank you!</p>`, [{ filename: `moss-moon-${month}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`, content: pdf }]);
  return { ok: true, total, orders: orders.length };
}

/** Invoice paid: the month's tab orders count as paid */
export function invoicePaid(companyId: number, month: string) {
  db.prepare("UPDATE company_invoices SET paid_at = datetime('now','localtime') WHERE company_id = ? AND month = ?").run(companyId, month);
  db.prepare("UPDATE orders SET pay_status = 'paid' WHERE company_id = ? AND strftime('%Y-%m', created_at) = ? AND pay_status = 'unpaid'").run(companyId, month);
}
