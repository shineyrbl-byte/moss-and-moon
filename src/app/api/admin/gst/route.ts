import { db } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { gstSettings, invoiceNumber, saveGst, taxSplit } from "@/lib/gst";

// Owner: GST settings, or a month's invoices as a spreadsheet (?report=YYYY-MM)
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const month = new URL(req.url).searchParams.get("report");
  if (!month) return Response.json(gstSettings());
  if (!/^\d{4}-\d{2}$/.test(month)) return Response.json({ error: "Pick a month." }, { status: 400 });
  const s = gstSettings();
  const rows = db
    .prepare("SELECT code, name, created_at, total, delivery_fee, tip, refund_amount, pay_status FROM orders WHERE strftime('%Y-%m', created_at) = ? AND pay_status IN ('paid','refunded') ORDER BY id")
    .all(month) as { code: string; name: string; created_at: string; total: number; delivery_fee: number; tip: number; refund_amount: number; pay_status: string }[];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
  const head = ["Invoice no", "Date", "Order", "Customer", "Taxable value", `CGST ${s.rate / 2}%`, `SGST ${s.rate / 2}%`, "Invoice total", "Tip (not taxed)", "Refunded"];
  let sums = [0, 0, 0, 0];
  const lines = rows.map((o) => {
    const t = taxSplit(o, s.rate);
    sums = [sums[0] + t.taxable, sums[1] + t.cgst, sums[2] + t.sgst, sums[3] + t.gross];
    return [invoiceNumber(o.code) ?? "", o.created_at.slice(0, 10), o.code, o.name, t.taxable.toFixed(2), t.cgst.toFixed(2), t.sgst.toFixed(2), t.gross.toFixed(2), o.tip, o.refund_amount].map(cell).join(",");
  });
  const total = ["TOTAL", "", "", "", ...sums.map((n) => n.toFixed(2)), "", ""].map(cell).join(",");
  const csv = [`${cell(`GST report ${month}`)},${cell(s.legalName)},${cell(`GSTIN ${s.gstin}`)}`, head.map(cell).join(","), ...lines, total].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="gst-${month}.csv"` } });
}

// Owner: save GST settings
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = saveGst((await req.json().catch(() => ({}))) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
