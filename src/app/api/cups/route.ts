import { ownerGate } from "@/lib/auth";
import { cupsSaved, setCupsGoal } from "@/lib/cupsStore";

export async function GET() {
  return Response.json(cupsSaved(), { headers: { "Cache-Control": "no-store" } });
}

// Owner: { goal } cups a month
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = setCupsGoal(((await req.json().catch(() => null)) ?? {}).goal);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
