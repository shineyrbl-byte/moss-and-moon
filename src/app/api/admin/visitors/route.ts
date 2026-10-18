import { ownerGate } from "@/lib/auth";
import { visitorReport } from "@/lib/visitors";

// Owner: visitors, page views, where they came from (?days=7|30|90)
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const d = Number(new URL(req.url).searchParams.get("days"));
  return Response.json(visitorReport([7, 30, 90].includes(d) ? d : 30));
}
