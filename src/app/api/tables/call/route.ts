import { db } from "@/lib/db";
import { TABLE_COUNT } from "@/lib/cafe";
import { isAdmin, unauthorized } from "@/lib/auth";
import { publish } from "@/lib/live";
import { limited, tooMany } from "@/lib/rateLimit";

const REASONS = ["help", "water", "bill", "order"];

// A guest at a table taps "Call staff"
export async function POST(req: Request) {
  if (limited(req, "table-call", 30, 600000)) return tooMany();
  const { table, reason } = await req.json().catch(() => ({}));
  const n = Math.floor(Number(table));
  if (!(n >= 1 && n <= TABLE_COUNT)) return Response.json({ error: "Unknown table." }, { status: 400 });
  if (!REASONS.includes(reason)) return Response.json({ error: "Unknown request." }, { status: 400 });
  // Pressing it twice doesn't send two calls
  const open = db.prepare("SELECT id FROM table_calls WHERE table_no = ? AND reason = ? AND done_at IS NULL").get(n, reason);
  if (!open) {
    db.prepare("INSERT INTO table_calls (table_no, reason) VALUES (?, ?)").run(n, reason);
    publish({ type: "call", table: n, action: "new" });
  }
  return Response.json({ ok: true });
}

// Staff: open calls
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json(db.prepare("SELECT id, table_no, reason, created_at FROM table_calls WHERE done_at IS NULL ORDER BY id").all());
}

// Staff: mark a call as handled
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await req.json().catch(() => ({}));
  const row = db.prepare("SELECT table_no FROM table_calls WHERE id = ?").get(Number(id)) as { table_no: number } | undefined;
  db.prepare("UPDATE table_calls SET done_at = datetime('now','localtime') WHERE id = ?").run(Number(id));
  if (row) publish({ type: "call", table: row.table_no, action: "done" });
  return Response.json({ ok: true });
}
