import { groupSummary } from "@/lib/groups";

type Ctx = { params: Promise<{ code: string }> };

// Anyone with the link can see the group tray
export async function GET(_req: Request, { params }: Ctx) {
  const s = groupSummary((await params).code);
  if (!s) return Response.json({ error: "We couldn't find that group order." }, { status: 404 });
  return Response.json(s);
}
