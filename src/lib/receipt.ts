// PDF receipts (plain built-in fonts, so "Rs." instead of the ₹ sign)
import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { orderDue, type QuoteLine } from "./pricing";

export type ReceiptOrder = {
  code: string; name: string; created_at: string; lines: QuoteLine[]; subtotal: number; discount: number; total: number; promo: string | null;
  giftcard_used: number; credit_used: number; tip: number; delivery_fee: number; refund_amount: number;
  pay_method: string; pay_status: string; table_no: number | null; delivery_address: string | null; pickup: string;
};

const BROWN = rgb(0.23, 0.15, 0.13);
const MUTED = rgb(0.52, 0.4, 0.35);
const PINK = rgb(0.72, 0.31, 0.43);
const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;
// Built-in PDF fonts only know basic Latin letters: swap or drop anything else
const plain = (s: string) => s.replace(/ · /g, ", ").replace(/·/g, ",").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/×/g, "x").replace(/[^\x20-\x7E]/g, "").trim();

export async function receiptPdf(o: ReceiptOrder) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Moss & Moon receipt ${o.code}`);
  pdf.setAuthor("Moss & Moon");
  const page = pdf.addPage([420, 300 + o.lines.length * 30]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifI = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  let y = height - 50;

  page.drawText("Moss", { x: 40, y, size: 26, font: serif, color: BROWN });
  page.drawText("&", { x: 40 + serif.widthOfTextAtSize("Moss ", 26), y, size: 26, font: serifI, color: PINK });
  page.drawText("Moon", { x: 40 + serif.widthOfTextAtSize("Moss & ", 26), y, size: 26, font: serif, color: BROWN });
  page.drawText("14 Willow Lane", { x: 40, y: y - 16, size: 9, font: sans, color: MUTED });
  const right = (text: string, yy: number, size = 10, font = sans, color = BROWN) => page.drawText(text, { x: width - 40 - font.widthOfTextAtSize(text, size), y: yy, size, font, color });
  right("RECEIPT", y + 6, 9, bold, MUTED);
  right(o.code, y - 8, 14, bold);
  right(new Date(o.created_at.replace(" ", "T")).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }), y - 22, 9, sans, MUTED);

  y -= 56;
  const how = o.delivery_address ? `Delivery to ${plain(o.delivery_address).slice(0, 60)}` : o.table_no ? `Table ${o.table_no}` : o.pickup === "asap" ? "Pickup" : `Pickup at ${o.pickup}`;
  page.drawText(plain(`For ${o.name}`) + ` - ${how}`, { x: 40, y, size: 10, font: sans, color: BROWN });
  y -= 14;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.6, color: MUTED });
  y -= 20;

  for (const l of o.lines) {
    page.drawText(plain(`${l.qty} x ${l.name}`), { x: 40, y, size: 11, font: sans, color: BROWN });
    right(rs(l.total), y, 11);
    if (l.note) page.drawText(plain(l.note).slice(0, 70), { x: 52, y: y - 12, size: 8.5, font: sans, color: MUTED });
    y -= l.note ? 30 : 20;
  }

  page.drawLine({ start: { x: 40, y: y + 6 }, end: { x: width - 40, y: y + 6 }, thickness: 0.6, color: MUTED, dashArray: [3, 3] });
  y -= 10;
  const row = (label: string, value: string, strong = false) => {
    page.drawText(label, { x: 40, y, size: strong ? 12 : 10, font: strong ? bold : sans, color: strong ? BROWN : MUTED });
    right(value, y, strong ? 12 : 10, strong ? bold : sans);
    y -= strong ? 20 : 15;
  };
  row("Subtotal", rs(o.subtotal));
  if (o.discount > 0) row(`Discounts${o.promo ? ` (${plain(o.promo)})` : ""}`, `- ${rs(o.discount)}`);
  if (o.credit_used > 0) row("Account credit", `- ${rs(o.credit_used)}`);
  if (o.giftcard_used > 0) row("Gift card", `- ${rs(o.giftcard_used)}`);
  if (o.delivery_fee > 0) row("Delivery", rs(o.delivery_fee));
  if (o.tip > 0) row("Tip for the team", rs(o.tip));
  y -= 4;
  const due = orderDue(o);
  row(o.pay_status === "paid" || o.pay_status === "refunded" ? "Paid" : "To pay", rs(due), true);
  if (o.refund_amount > 0) row("Refunded", `- ${rs(o.refund_amount)}`);
  const method = o.pay_method === "online" ? "Paid online" : o.pay_method === "giftcard" ? "Covered by gift card / credit" : "Paid at the counter";
  page.drawText(o.pay_status === "unpaid" ? "Not paid yet" : method, { x: 40, y, size: 9, font: sans, color: MUTED });

  page.drawText("Thank you for slowing down with us.", { x: 40, y: 34, size: 11, font: serifI, color: PINK });
  return pdf.save();
}
