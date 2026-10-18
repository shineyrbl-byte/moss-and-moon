import { db, cleanText } from "@/lib/db";
import { placeOrder } from "@/lib/orders";
import { toDateStr } from "@/lib/cafe";
import { currentCustomer } from "@/lib/account";

type Row = { code: string; item_id: string; opts: string; to_name: string; paid: number; order_code: string | null; expires: string };

// Claim a gifted drink: it goes straight into the barista's queue, already paid
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const g = db.prepare("SELECT code, item_id, opts, to_name, paid, order_code, expires FROM drink_gifts WHERE code = ?").get(code) as Row | undefined;
  if (!g || !g.paid) return Response.json({ error: "We couldn't find that gift." }, { status: 404 });
  if (g.order_code) return Response.json({ error: "This drink has already been claimed ✿", orderCode: g.order_code }, { status: 409 });
  if (g.expires < toDateStr(new Date())) return Response.json({ error: "Sorry, this gift has expired. Show it at the counter and we'll sort something out." }, { status: 410 });
  const b = await req.json().catch(() => ({}));

  // Mark it claimed first, so two taps can't make two drinks
  const claim = db.prepare("UPDATE drink_gifts SET order_code = 'claiming' WHERE code = ? AND order_code IS NULL").run(code);
  if (!claim.changes) return Response.json({ error: "This drink has already been claimed ✿" }, { status: 409 });
  const res = await placeOrder(
    { name: cleanText(b?.name, 40) || g.to_name, phone: b?.phone ?? "", table: b?.table, note: `🎁 Gifted drink ${code}`, lines: [{ itemId: g.item_id, opts: JSON.parse(g.opts), qty: 1 }] },
    await currentCustomer(),
    { prepaid: { method: "drinkgift", ref: code } }
  );
  const d = await res.json();
  if (!res.ok) {
    db.prepare("UPDATE drink_gifts SET order_code = NULL WHERE code = ?").run(code);
    return Response.json({ error: d.error ?? "Couldn't claim it right now." }, { status: res.status });
  }
  db.prepare("UPDATE drink_gifts SET order_code = ?, redeemed_at = datetime('now','localtime') WHERE code = ?").run(d.code, code);
  return Response.json({ ok: true, orderCode: d.code });
}
