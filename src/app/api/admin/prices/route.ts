import { ownerGate } from "@/lib/auth";
import { PRICE_ALERT, priceWatch } from "@/lib/prices";

// Owner: ingredient prices now vs 90 days ago, and what it costs a month
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json({ items: priceWatch(), alertAt: PRICE_ALERT * 100 });
}
