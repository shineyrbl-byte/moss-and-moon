import { groupSummary } from "@/lib/groups";
import { limited, tooMany } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

// Anyone with the link can see the group tray
export async function GET(req: Request, { params }: Ctx) {
  if (limited(req, "group-lookup", 600, 600000)) return tooMany();
  const s = groupSummary((await params).code);
  if (!s) return Response.json({ error: "We couldn't find that group order." }, { status: 404 });
  return Response.json(s);
}
