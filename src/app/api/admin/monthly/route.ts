import { ownerGate } from "@/lib/auth";
import { monthlyReport } from "@/lib/monthlyReport";

// Owner: a month's report (?month=YYYY-MM, last month if left out)
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json(monthlyReport(new URL(req.url).searchParams.get("month") ?? ""), { headers: { "Cache-Control": "no-store" } });
}
