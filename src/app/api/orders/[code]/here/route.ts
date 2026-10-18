import { db, cleanText } from "@/lib/db";
import { publish } from "@/lib/live";
import { limited, tooMany } from "@/lib/rateLimit";

type P = { params: Promise<{ code: string }> };

// The guest is outside / at the counter ({ note? }), so staff can bring it out
export async function POST(req: Request, { params }: P) {
  if (limited(req, "here", 20, 600_000)) return tooMany();
  const code = (await params).code.toUpperCase();
  const o = db.prepare("SELECT status, table_no, delivery_address FROM orders WHERE code = ?").get(code) as { status: string; table_no: number | null; delivery_address: string | null } | undefined;
  if (!o) return Response.json({ error: "We couldn't find that order." }, { status: 404 });
  if (o.table_no || o.delivery_address) return Response.json({ error: "This order comes to you already ✿" }, { status: 400 });
  if (o.status === "collected") return Response.json({ error: "This order has already been collected." }, { status: 409 });
  const b = await req.json().catch(() => null);
  db.prepare("UPDATE orders SET arrived_at = datetime('now','localtime'), arrived_note = ? WHERE code = ?").run(cleanText(b?.note, 80) || null, code);
  publish({ type: "order", code, action: "here" });
  return Response.json({ ok: true });
}
