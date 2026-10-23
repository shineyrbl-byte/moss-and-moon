import { ownerGate } from "@/lib/auth";
import { saveProfile, teamForOwner } from "@/lib/team";

export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json({ team: teamForOwner() });
}

// Owner: save one person's public profile ({ id, show, bio, favItem, creationCode, photo, emoji })
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = saveProfile((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
