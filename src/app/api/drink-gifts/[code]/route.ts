import { db } from "@/lib/db";
import { findOrderable } from "@/lib/menuStore";
import { toDateStr } from "@/lib/cafe";
import { limited, tooMany } from "@/lib/rateLimit";

type Row = { code: string; item_id: string; item_name: string; note: string; amount: number; from_name: string; to_name: string; message: string | null; paid: number; order_code: string | null; redeemed_at: string | null; expires: string };

// The gift card page (anyone with the link). Emails stay private.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (limited(req, "gift-lookup", 300, 600000)) return tooMany();
  const g = db.prepare("SELECT code, item_id, item_name, note, amount, from_name, to_name, message, paid, order_code, redeemed_at, expires FROM drink_gifts WHERE code = ?").get((await params).code.toUpperCase()) as Row | undefined;
  if (!g) return Response.json({ error: "We couldn't find that gift." }, { status: 404 });
  const item = findOrderable(g.item_id);
  return Response.json({
    code: g.code, itemId: g.item_id, itemName: g.item_name, img: item?.img ?? null, note: g.note, amount: g.amount,
    fromName: g.from_name, toName: g.to_name, message: g.message, paid: !!g.paid, orderCode: g.order_code, redeemedAt: g.redeemed_at,
    expires: g.expires, expired: g.expires < toDateStr(new Date()), available: !!item && !item.soldOut,
  });
}
