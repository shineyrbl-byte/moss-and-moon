import { currentCustomer } from "@/lib/account";
import { saveLater } from "@/lib/laterOrders";
import { limited, tooMany } from "@/lib/rateLimit";

// Save an order for tomorrow ({ ...the usual order, pickupDate, pickup: "HH:MM" }); paid at the counter
export async function POST(req: Request) {
  if (limited(req, "orders-later", 20, 600_000)) return tooMany();
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  const r = saveLater(body, await currentCustomer());
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
