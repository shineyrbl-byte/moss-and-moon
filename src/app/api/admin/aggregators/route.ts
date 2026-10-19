import { isAdmin, isOwner, ownerGate, unauthorized } from "@/lib/auth";
import { addAggregatorOrder, aggregatorSettings, aggregatorSummary, isPlatform, saveAggregatorSettings } from "@/lib/aggregators";

// Staff: platform switches and this week's numbers (the webhook secret is for the owner only)
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const { secret, ...s } = aggregatorSettings();
  return Response.json({ ...s, ...((await isOwner()) ? { secret } : {}), summary: aggregatorSummary(7) });
}

// Staff: type in an order from the Swiggy / Zomato tablet ({ platform, ref, customer?, total?, lines })
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  if (!isPlatform(b.platform)) return Response.json({ error: "Pick Swiggy or Zomato." }, { status: 400 });
  const r = addAggregatorOrder(b.platform, b);
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ ok: true, ...r });
}

// Owner: switch platforms on, set markup and commission, or make a new webhook secret
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json(saveAggregatorSettings((await req.json().catch(() => null)) ?? {}));
}
