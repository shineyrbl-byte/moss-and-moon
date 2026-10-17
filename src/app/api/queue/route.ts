import { db } from "@/lib/db";

// How busy is the counter? Used for the "~X min wait" badges.
export async function GET() {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('received','brewing')").get() as { n: number };
  return Response.json({ active: n, minutes: Math.min(45, 5 + n * 3) });
}
