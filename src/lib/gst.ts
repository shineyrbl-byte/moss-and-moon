// GST tax invoices. Menu prices include GST; the invoice works backwards to show the
// taxable value and CGST + SGST (half each). Restaurants usually charge 5% with no input
// tax credit; owners set their GSTIN, legal name, address and rate in Admin → Settings.
import "server-only";
import { db, getSetting, setSetting, cleanText } from "./db";

export type GstSettings = { on: boolean; gstin: string; legalName: string; address: string; rate: number; prefix: string };
export const SAC = "996331"; // "Services provided by restaurants, cafes and similar eating facilities"
const DEFAULT: GstSettings = { on: false, gstin: "", legalName: "", address: "", rate: 5, prefix: "MM" };

// 2 digits (state) + 10 (PAN) + 1 (entity) + Z + 1 (checksum)
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function gstSettings(): GstSettings {
  try { return { ...DEFAULT, ...JSON.parse(getSetting("gst") ?? "{}") }; } catch { return DEFAULT; }
}

export function saveGst(raw: Record<string, unknown>): GstSettings | { error: string } {
  const gstin = String(raw.gstin ?? "").trim().toUpperCase();
  const rate = Number(raw.rate);
  const s: GstSettings = {
    on: !!raw.on,
    gstin,
    legalName: cleanText(raw.legalName, 80),
    address: cleanText(raw.address, 160),
    rate: [0, 5, 12, 18].includes(rate) ? rate : 5,
    prefix: (cleanText(raw.prefix, 6).toUpperCase().replace(/[^A-Z0-9]/g, "") || "MM"),
  };
  if (s.on && !GSTIN_RE.test(gstin)) return { error: "That GSTIN doesn't look right. It's 15 characters, like 30ABCDE1234F1Z5." };
  if (s.on && !s.legalName) return { error: "Add the business's legal name as registered for GST." };
  setSetting("gst", JSON.stringify(s));
  return s;
}

/** Indian financial year for a date: April to March, e.g. "2026-27" */
export function financialYear(d: Date) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

/** The order's invoice number, given once it's paid (numbers run in order within each financial year) */
export function invoiceNumber(code: string): string | null {
  const s = gstSettings();
  if (!s.on) return null;
  const o = db.prepare("SELECT invoice_no, pay_status, created_at FROM orders WHERE code = ?").get(code) as { invoice_no: string | null; pay_status: string; created_at: string } | undefined;
  if (!o) return null;
  if (o.invoice_no) return o.invoice_no;
  if (o.pay_status !== "paid" && o.pay_status !== "refunded") return null;
  const fy = financialYear(new Date(o.created_at.replace(" ", "T")));
  const key = `invoice_seq_${fy}`;
  const next = Number(getSetting(key) ?? 0) + 1;
  const no = `${s.prefix}/${fy}/${String(next).padStart(4, "0")}`;
  const r = db.prepare("UPDATE orders SET invoice_no = ? WHERE code = ? AND invoice_no IS NULL").run(no, code);
  if (r.changes) setSetting(key, String(next));
  return (db.prepare("SELECT invoice_no FROM orders WHERE code = ?").get(code) as { invoice_no: string }).invoice_no;
}

/** Tax inside a price that includes GST. Tips aren't taxed; the delivery fee is. */
export function taxSplit(o: { total: number; delivery_fee: number }, rate = gstSettings().rate) {
  const gross = o.total + (o.delivery_fee ?? 0);
  const taxable = Math.round((gross / (1 + rate / 100)) * 100) / 100;
  const tax = Math.round((gross - taxable) * 100) / 100;
  const half = Math.round((tax / 2) * 100) / 100;
  return { gross, taxable, cgst: half, sgst: Math.round((tax - half) * 100) / 100, rate };
}
