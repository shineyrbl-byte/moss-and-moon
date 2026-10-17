import { db } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";

// Staff: remove a review
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await params;
  db.prepare("DELETE FROM reviews WHERE id = ?").run(Number(id));
  return Response.json({ ok: true });
}
