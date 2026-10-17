import { db } from "@/lib/db";
import { findItem } from "@/lib/menu";
import { isAdmin, unauthorized } from "@/lib/auth";

// Which items are sold out right now
export async function GET() {
  const rows = db.prepare("SELECT item_id FROM sold_out").all() as { item_id: string }[];
  return Response.json({ soldOut: rows.map((r) => r.item_id) });
}

// Staff: mark an item sold out / back in stock
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { itemId, soldOut } = await req.json().catch(() => ({}));
  if (!findItem(String(itemId))) return Response.json({ error: "Unknown item." }, { status: 400 });
  if (soldOut) db.prepare("INSERT OR IGNORE INTO sold_out (item_id) VALUES (?)").run(itemId);
  else db.prepare("DELETE FROM sold_out WHERE item_id = ?").run(itemId);
  return Response.json({ ok: true });
}
