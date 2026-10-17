import { db, cleanText } from "@/lib/db";
import { hashPassword, ownerGate } from "@/lib/auth";

// Owner: manage staff accounts
export async function GET() {
  {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  const rows = db.prepare("SELECT id, name, username, role, active, created_at FROM staff ORDER BY active DESC, name").all();
  const handled = db.prepare("SELECT staff_id, COUNT(*) AS n FROM orders WHERE staff_id IS NOT NULL AND created_at >= datetime('now','localtime','-30 days') GROUP BY staff_id").all() as { staff_id: number; n: number }[];
  const map = new Map(handled.map((h) => [h.staff_id, h.n]));
  return Response.json((rows as { id: number }[]).map((r) => ({ ...r, ordersHandled: map.get(r.id) ?? 0 })));
}

export async function POST(req: Request) {
  {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  const b = await req.json().catch(() => ({}));
  const name = cleanText(b.name, 40);
  const username = String(b.username ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const role = b.role === "owner" ? "owner" : "barista";
  if (!name) return Response.json({ error: "Please add their name." }, { status: 400 });
  if (!/^[a-z0-9._-]{3,20}$/.test(username) || username === "owner") return Response.json({ error: "Username: 3–20 letters or numbers (not \"owner\")." }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "Password needs at least 8 characters." }, { status: 400 });
  if (db.prepare("SELECT 1 FROM staff WHERE username = ?").get(username)) return Response.json({ error: "That username is taken." }, { status: 409 });
  db.prepare("INSERT INTO staff (name, username, password_hash, role) VALUES (?, ?, ?, ?)").run(name, username, hashPassword(password), role);
  return Response.json({ ok: true });
}

// Switch an account on/off, change role, or reset the password
export async function PATCH(req: Request) {
  {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  if (!db.prepare("SELECT 1 FROM staff WHERE id = ?").get(id)) return Response.json({ error: "Not found." }, { status: 404 });
  if (b.active !== undefined) db.prepare("UPDATE staff SET active = ? WHERE id = ?").run(b.active ? 1 : 0, id);
  if (b.role === "owner" || b.role === "barista") db.prepare("UPDATE staff SET role = ? WHERE id = ?").run(b.role, id);
  if (b.password !== undefined) {
    if (String(b.password).length < 8) return Response.json({ error: "Password needs at least 8 characters." }, { status: 400 });
    db.prepare("UPDATE staff SET password_hash = ? WHERE id = ?").run(hashPassword(String(b.password)), id);
  }
  return Response.json({ ok: true });
}
