import { ownerGate } from "@/lib/auth";
import { listSpots, removeSpot, saveSpot } from "@/lib/nearbyStore";

export async function GET() {
  return Response.json({ spots: listSpots() });
}

// Owner: add or edit a place ({ id? , name, kind, blurb, walk_min, dog, map_url })
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = saveSpot((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Owner: ?id=
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json(removeSpot(Number(new URL(req.url).searchParams.get("id"))));
}
