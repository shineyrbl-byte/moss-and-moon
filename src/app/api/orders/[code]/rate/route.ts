import { db } from "@/lib/db";
import { limited, tooMany } from "@/lib/rateLimit";
import type { QuoteLine } from "@/lib/pricing";

type P = { params: Promise<{ code: string }> };

// Thumbs up or down on something from this order ({ itemId, up }), once it's been made
export async function POST(req: Request, { params }: P) {
  if (limited(req, "rate-item", 60, 600_000)) return tooMany();
  const code = (await params).code.toUpperCase();
  const o = db.prepare("SELECT status, lines FROM orders WHERE code = ?").get(code) as { status: string; lines: string } | undefined;
  if (!o) return Response.json({ error: "Order not found." }, { status: 404 });
  if (!["ready", "collected"].includes(o.status)) return Response.json({ error: "You can rate it once it's ready ✿" }, { status: 409 });
  const b = await req.json().catch(() => null);
  const itemId = String(b?.itemId ?? "");
  if (!(JSON.parse(o.lines) as QuoteLine[]).some((l) => l.itemId === itemId)) return Response.json({ error: "That wasn't in this order." }, { status: 400 });
  db.prepare("INSERT INTO item_ratings (order_code, item_id, up) VALUES (?, ?, ?) ON CONFLICT(order_code, item_id) DO UPDATE SET up = excluded.up").run(code, itemId, b?.up ? 1 : 0);
  return Response.json({ ok: true });
}

// What this order's guest already said
export async function GET(_req: Request, { params }: P) {
  const code = (await params).code.toUpperCase();
  const rows = db.prepare("SELECT item_id, up FROM item_ratings WHERE order_code = ?").all(code) as { item_id: string; up: number }[];
  return Response.json(Object.fromEntries(rows.map((r) => [r.item_id, !!r.up])));
}
