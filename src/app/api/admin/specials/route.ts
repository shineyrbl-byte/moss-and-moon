import { ownerGate } from "@/lib/auth";
import { limited, tooMany } from "@/lib/rateLimit";
import { addSpecial, suggestSpecials } from "@/lib/specials";
import { publish } from "@/lib/live";

// Owner: ideas for today's special
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  if (limited(req, "specials", 20, 3600_000)) return tooMany();
  return Response.json(await suggestSpecials());
}

// Owner: put one on today's menu ({ baseItemId, name, desc, price })
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const price = Number(b?.price);
  const name = String(b?.name ?? "").trim();
  if (!name || !(price > 0 && price <= 2000)) return Response.json({ error: "The special needs a name and a price." }, { status: 400 });
  const item = addSpecial({ baseItemId: String(b?.baseItemId ?? ""), name, desc: String(b?.desc ?? "").trim(), price, why: "" });
  if (!item) return Response.json({ error: "That menu item doesn't exist." }, { status: 404 });
  publish({ type: "menu" });
  return Response.json({ ok: true, item });
}
