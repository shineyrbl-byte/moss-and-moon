import { db } from "@/lib/db";
import { ownerGate } from "@/lib/auth";

// Staff: remove a review
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  const { id } = await params;
  db.prepare("DELETE FROM reviews WHERE id = ?").run(Number(id));
  return Response.json({ ok: true });
}
