import { currentStaff, unauthorized } from "@/lib/auth";
import { cleanText } from "@/lib/db";
import { forwardCounts, giveForward } from "@/lib/payForward";

// How many paid-forward coffees are waiting, and how many have been given
export async function GET() {
  return Response.json(forwardCounts(), { headers: { "Cache-Control": "no-store" } });
}

// Staff: hand one out ({ name? } for the cup)
export async function POST(req: Request) {
  if (!(await currentStaff())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const r = await giveForward(cleanText(b.name, 40));
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(r);
}
