import { db } from "@/lib/db";
import { rushNow } from "@/lib/rush";

// How busy is the counter? Used for the "~X min wait" badges.
export async function GET() {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('received','brewing')").get() as { n: number };
  const r = rushNow();
  return Response.json({ active: n, minutes: Math.min(60, 5 + n * 3 + r.extra), rush: r.mode });
}
