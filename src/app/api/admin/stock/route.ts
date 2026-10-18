import { recordPrice } from "@/lib/prices";
import { db, cleanText, cleanEmail } from "@/lib/db";
import { isAdmin, unauthorized, ownerGate } from "@/lib/auth";
import { getIngredients } from "@/lib/stock";
import { publish } from "@/lib/live";

// Staff: ingredient levels
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json(getIngredients());
}

// Staff: restock / correct a level ({ id, add } or { id, qty }); owner can also change low_at / name
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!db.prepare("SELECT 1 FROM ingredients WHERE id = ?").get(id)) return Response.json({ error: "Unknown ingredient." }, { status: 404 });
  if (b.add !== undefined) db.prepare("UPDATE ingredients SET qty = MAX(0, qty + ?) WHERE id = ?").run(Number(b.add) || 0, id);
  if (b.qty !== undefined) db.prepare("UPDATE ingredients SET qty = MAX(0, ?) WHERE id = ?").run(Number(b.qty) || 0, id);
  if (b.low_at !== undefined || b.name !== undefined || b.cost !== undefined || b.supplier_email !== undefined || b.reorder_qty !== undefined) {
    {
    const gate = await ownerGate();
    if (gate) return gate;
  }
    if (b.low_at !== undefined) db.prepare("UPDATE ingredients SET low_at = MAX(0, ?) WHERE id = ?").run(Number(b.low_at) || 0, id);
    if (b.name) db.prepare("UPDATE ingredients SET name = ? WHERE id = ?").run(cleanText(b.name, 40), id);
    if (b.supplier_email !== undefined) {
      const email = cleanEmail(b.supplier_email);
      if (b.supplier_email && !email) return Response.json({ error: "That supplier email doesn't look right." }, { status: 400 });
      db.prepare("UPDATE ingredients SET supplier_email = ?, supplier_name = ? WHERE id = ?").run(email || null, cleanText(b.supplier_name, 60) || null, id);
    }
    if (b.reorder_qty !== undefined) db.prepare("UPDATE ingredients SET reorder_qty = ? WHERE id = ?").run(Number(b.reorder_qty) > 0 ? Number(b.reorder_qty) : null, id);
    if (b.cost !== undefined) {
      const c = Number(b.cost);
      if (!(c >= 0 && c <= 10000)) return Response.json({ error: "Cost should be between ₹0 and ₹10,000 per unit." }, { status: 400 });
      const old = (db.prepare("SELECT cost FROM ingredients WHERE id = ?").get(id) as { cost: number | null } | undefined)?.cost ?? null;
      db.prepare("UPDATE ingredients SET cost = ? WHERE id = ?").run(c, id);
      if (old !== c) recordPrice(id, c, cleanText(b.price_note, 80) || null, old);
    }
  }
  publish({ type: "menu" });
  return Response.json({ ok: true });
}

// Owner: add a new ingredient to track
export async function POST(req: Request) {
  {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  const b = await req.json().catch(() => ({}));
  const name = cleanText(b.name, 40);
  const unit = ["g", "ml", "pcs"].includes(b.unit) ? b.unit : "pcs";
  if (!name) return Response.json({ error: "Please name it." }, { status: 400 });
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
  if (db.prepare("SELECT 1 FROM ingredients WHERE id = ?").get(id)) return Response.json({ error: "You already track that." }, { status: 409 });
  db.prepare("INSERT INTO ingredients (id, name, unit, qty, low_at) VALUES (?, ?, ?, ?, ?)").run(id, name, unit, Math.max(0, Number(b.qty) || 0), Math.max(0, Number(b.low_at) || 0));
  return Response.json({ ok: true, id });
}
