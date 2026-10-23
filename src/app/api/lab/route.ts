import { currentCustomer } from "@/lib/account";
import { labBoard, saveCreation } from "@/lib/lab";
import { limited, tooMany } from "@/lib/rateLimit";

export async function GET() {
  return Response.json(labBoard());
}

// Save a creation ({ name, creator, baseId, opts })
export async function POST(req: Request) {
  if (limited(req, "lab", 10, 3600_000)) return tooMany();
  const me = await currentCustomer();
  const r = saveCreation((await req.json().catch(() => null)) ?? {}, me?.id ?? null);
  if ("error" in r) return Response.json(r, { status: 400 });
  return Response.json({ ok: true, creation: r });
}
