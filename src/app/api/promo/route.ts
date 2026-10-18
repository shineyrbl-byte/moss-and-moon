import { checkPromo } from "@/lib/promos";

// Check a promo code before checkout
export async function POST(req: Request) {
  const { code, phone } = await req.json().catch(() => ({}));
  const r = checkPromo(code, phone);
  if ("error" in r) return Response.json({ error: r.error }, { status: 404 });
  return Response.json({ code: r.rule.code, label: r.label, rule: r.rule });
}
