import { ownerGate } from "@/lib/auth";
import { ispyList, saveIspy } from "@/lib/ispyStore";

// The things to spot
export async function GET() {
  return Response.json({ items: ispyList() });
}

// Owner: { items: [...] } (empty puts the café's list back)
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = (await req.json().catch(() => null)) ?? {};
  return Response.json({ items: saveIspy(b.items) });
}
