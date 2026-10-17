import { db } from "@/lib/db";
import { deletePhoto } from "@/lib/uploads";
import { ownerGate } from "@/lib/auth";

// Staff: remove a review
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  const { id } = await params;
  const r = db.prepare("SELECT photo FROM reviews WHERE id = ?").get(Number(id)) as { photo: string | null } | undefined;
  if (r?.photo) deletePhoto(r.photo);
  db.prepare("DELETE FROM reviews WHERE id = ?").run(Number(id));
  return Response.json({ ok: true });
}
