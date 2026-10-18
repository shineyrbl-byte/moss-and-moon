import { ownerGate } from "@/lib/auth";
import { profitReport } from "@/lib/profit";

// Owner: revenue, costs and profit (?days=7|30|90)
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const d = Number(new URL(req.url).searchParams.get("days"));
  return Response.json(profitReport([7, 30, 90].includes(d) ? d : 30));
}
