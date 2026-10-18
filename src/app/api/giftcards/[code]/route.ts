import { db } from "@/lib/db";
import { limited, tooMany } from "@/lib/rateLimit";

// Check a gift card's balance
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (limited(req, "giftcard-lookup", 60, 600000)) return tooMany();
  const { code } = await params;
  const g = db.prepare("SELECT code, amount, balance, to_name FROM giftcards WHERE code = ? AND paid = 1").get(code.trim().toUpperCase());
  if (!g) return Response.json({ error: "We couldn't find that gift card." }, { status: 404 });
  return Response.json(g);
}
