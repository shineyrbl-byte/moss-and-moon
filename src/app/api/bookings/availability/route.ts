import { db } from "@/lib/db";
import { findBranch, slotsFor, TABLES_PER_SLOT } from "@/lib/cafe";

// Which times are free on a given date? ?date=YYYY-MM-DD
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const date = q.get("date") ?? "";
  const branch = findBranch(q.get("branch")).id;
  const used = db
    .prepare("SELECT time, SUM(CASE WHEN guests >= 5 THEN 2 ELSE 1 END) AS n FROM bookings WHERE date = ? AND branch = ? AND status IN ('confirmed','pending') GROUP BY time")
    .all(date, branch) as { time: string; n: number }[];
  const map = new Map(used.map((u) => [u.time, u.n]));
  return Response.json(slotsFor(date, branch).map((time) => ({ time, left: Math.max(0, TABLES_PER_SLOT - (map.get(time) ?? 0)) })));
}
