import { db } from "@/lib/db";

// Check a gift card's balance
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const g = db.prepare("SELECT code, amount, balance, to_name FROM giftcards WHERE code = ? AND paid = 1").get(code.trim().toUpperCase());
  if (!g) return Response.json({ error: "We couldn't find that gift card." }, { status: 404 });
  return Response.json(g);
}
