import { PROMOS } from "@/lib/pricing";

// Check a promo code before checkout
export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({}));
  const key = String(code ?? "").trim().toUpperCase();
  const p = PROMOS[key];
  if (!p) return Response.json({ error: "That code doesn't look right." }, { status: 404 });
  return Response.json({ code: key, label: p.label });
}
