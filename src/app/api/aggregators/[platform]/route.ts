import { addAggregatorOrder, aggregatorSettings, isPlatform, webhookAllowed } from "@/lib/aggregators";
import { limited, tooMany } from "@/lib/rateLimit";

// Webhook for Swiggy / Zomato orders (from their partner API or a middleware such as UrbanPiper).
// Send header "x-mm-secret: <secret from Settings>" and JSON:
// { ref, customer?, total?, note?, lines: [{ itemId | name, qty }] }
export async function POST(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  if (!isPlatform(platform)) return Response.json({ error: "Unknown platform." }, { status: 404 });
  if (limited(req, "aggregator-hook", 120, 60_000)) return tooMany();
  if (!webhookAllowed(req)) return Response.json({ error: "Wrong or missing secret." }, { status: 401 });
  if (!aggregatorSettings()[platform].on) return Response.json({ error: `${platform} orders are switched off in Settings.` }, { status: 409 });
  const r = addAggregatorOrder(platform, (await req.json().catch(() => null)) ?? {});
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ ok: true, ...r });
}
