import { isAdmin, ownerGate, unauthorized } from "@/lib/auth";
import { saveTableTags, tagsForStaff } from "@/lib/tableTags";

// Seat tags for each table ({ "1": ["window", "socket"], … })
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json(tagsForStaff());
}

// Owner: replace them
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json({ tags: saveTableTags((await req.json().catch(() => null))?.tags), saved: true });
}
