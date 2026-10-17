import { db } from "@/lib/db";
import { slotsFor, TABLES_PER_SLOT } from "@/lib/cafe";

// Which times are free on a given date? ?date=YYYY-MM-DD
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  const used = db
    .prepare("SELECT time, SUM(CASE WHEN guests >= 5 THEN 2 ELSE 1 END) AS n FROM bookings WHERE date = ? AND status = 'confirmed' GROUP BY time")
    .all(date) as { time: string; n: number }[];
  const map = new Map(used.map((u) => [u.time, u.n]));
  return Response.json(slotsFor(date).map((time) => ({ time, left: Math.max(0, TABLES_PER_SLOT - (map.get(time) ?? 0)) })));
}
