import { ownerGate } from "@/lib/auth";
import { missedReport } from "@/lib/missed";

// Owner: what guests wanted but couldn't get
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json(missedReport());
}
