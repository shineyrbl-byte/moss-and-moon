import { checkPromo } from "@/lib/promos";
import { limited, tooMany } from "@/lib/rateLimit";

// Check a promo code before checkout
export async function POST(req: Request) {
  if (limited(req, "promo", 40, 600000)) return tooMany();
  const { code, phone } = await req.json().catch(() => ({}));
  const r = checkPromo(code, phone);
  if ("error" in r) return Response.json({ error: r.error }, { status: 404 });
  return Response.json({ code: r.rule.code, label: r.label, rule: r.rule });
}
