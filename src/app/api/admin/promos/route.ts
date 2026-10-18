import { db, cleanText } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { promoLabel } from "@/lib/pricing";
import { toRule, type PromoRow } from "@/lib/promos";

const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// Owner: all promo codes with how often they've been used
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  const rows = db.prepare("SELECT * FROM promos ORDER BY active DESC, created_at DESC").all() as PromoRow[];
  const saved = db.prepare("SELECT promo, COALESCE(SUM(discount), 0) AS d FROM orders WHERE promo IS NOT NULL GROUP BY promo").all() as { promo: string; d: number }[];
  const map = new Map(saved.map((s) => [s.promo, s.d]));
  return Response.json(rows.map((p) => ({ ...p, label: promoLabel(toRule(p)), discountGiven: map.get(p.code) ?? 0 })));
}

// Owner: create a code
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const code = String(b?.code ?? "").trim().toUpperCase();
  const kind = b?.kind === "amount" ? "amount" : "percent";
  const value = Math.floor(Number(b?.value));
  const minOrder = Math.max(0, Math.floor(Number(b?.minOrder) || 0));
  const maxUses = b?.maxUses === "" || b?.maxUses === null || b?.maxUses === undefined ? null : Math.floor(Number(b.maxUses));
  if (!/^[A-Z0-9]{3,20}$/.test(code)) return Response.json({ error: "Codes are 3–20 letters or numbers, like SUMMER20." }, { status: 400 });
  if (code.startsWith("GIFT")) return Response.json({ error: "Codes can't start with GIFT (that's for gift cards)." }, { status: 400 });
  if (kind === "percent" && !(value >= 1 && value <= 90)) return Response.json({ error: "A percentage between 1 and 90, please." }, { status: 400 });
  if (kind === "amount" && !(value >= 1 && value <= 5000)) return Response.json({ error: "An amount between ₹1 and ₹5,000, please." }, { status: 400 });
  if (maxUses !== null && !(maxUses >= 1)) return Response.json({ error: "Max uses should be 1 or more (or empty for no limit)." }, { status: 400 });
  const starts = day(b?.starts);
  const expires = day(b?.expires);
  if (starts && expires && expires < starts) return Response.json({ error: "It ends before it starts. Check the dates." }, { status: 400 });
  if (db.prepare("SELECT 1 FROM promos WHERE code = ?").get(code)) return Response.json({ error: "That code already exists." }, { status: 409 });
  db.prepare("INSERT INTO promos (code, kind, value, min_order, max_uses, once_per_guest, starts, expires, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    code, kind, value, minOrder, maxUses, b?.oncePerGuest ? 1 : 0, starts, expires, cleanText(b?.note, 80) || null
  );
  return Response.json({ ok: true, code });
}

// Owner: switch a code on or off
export async function PATCH(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const r = db.prepare("UPDATE promos SET active = ? WHERE code = ?").run(b?.active ? 1 : 0, String(b?.code ?? "").toUpperCase());
  if (!r.changes) return Response.json({ error: "Code not found." }, { status: 404 });
  return Response.json({ ok: true });
}

// Owner: delete a code (past orders keep their discount)
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const r = db.prepare("DELETE FROM promos WHERE code = ?").run(String(b?.code ?? "").toUpperCase());
  if (!r.changes) return Response.json({ error: "Code not found." }, { status: 404 });
  return Response.json({ ok: true });
}
