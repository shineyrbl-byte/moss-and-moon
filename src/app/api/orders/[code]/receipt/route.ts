import { db } from "@/lib/db";
import { receiptPdf, type ReceiptOrder } from "@/lib/receipt";
import { limited, tooMany } from "@/lib/rateLimit";

// PDF receipt for an order (anyone with the order code, like the order page)
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (limited(req, "receipt", 60, 600000)) return tooMany();
  const code = (await params).code.toUpperCase();
  const row = db
    .prepare(
      `SELECT code, name, created_at, lines, subtotal, discount, total, promo, giftcard_used, credit_used, tip, delivery_fee, refund_amount,
              pay_method, pay_status, table_no, delivery_address, pickup FROM orders WHERE code = ?`
    )
    .get(code) as (Omit<ReceiptOrder, "lines"> & { lines: string }) | undefined;
  if (!row) return Response.json({ error: "Order not found." }, { status: 404 });
  const pdf = await receiptPdf({ ...row, lines: JSON.parse(row.lines) });
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="moss-and-moon-${code}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
