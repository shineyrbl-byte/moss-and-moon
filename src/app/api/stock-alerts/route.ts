import { db, cleanEmail } from "@/lib/db";
import { menuLookup } from "@/lib/menuStore";
import { recordMissed } from "@/lib/missed";
import { limited, tooMany } from "@/lib/rateLimit";

// "Tell me when it's back" ({ itemId, email })
export async function POST(req: Request) {
  if (limited(req, "stock-alert", 20, 3600_000)) return tooMany();
  const b = await req.json().catch(() => null);
  const email = cleanEmail(b?.email);
  const item = menuLookup()(String(b?.itemId ?? ""));
  if (!item) return Response.json({ error: "That item isn't on the menu." }, { status: 404 });
  if (!email) return Response.json({ error: "Please enter a valid email." }, { status: 400 });
  const r = db.prepare("INSERT OR IGNORE INTO stock_alerts (item_id, email) VALUES (?, ?)").run(item.id, email);
  if (r.changes) recordMissed([{ itemId: item.id }], "wanted");
  else db.prepare("UPDATE stock_alerts SET sent_at = NULL WHERE item_id = ? AND email = ?").run(item.id, email);
  return Response.json({ ok: true });
}
