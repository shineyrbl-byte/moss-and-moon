import { db } from "@/lib/db";
import { toDateStr } from "@/lib/cafe";
import { isAdmin, unauthorized } from "@/lib/auth";

// Staff dashboard numbers
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const today = toDateStr(new Date());
  const one = <T,>(sql: string, ...p: (string | number)[]) => db.prepare(sql).get(...p) as T;

  const todayOrders = one<{ n: number; revenue: number }>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE date(created_at) = ?", today
  );
  const active = one<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE status IN ('received','brewing','ready')");
  const bookingsToday = one<{ n: number; guests: number }>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(guests), 0) AS guests FROM bookings WHERE date = ? AND status != 'cancelled'", today
  );
  const rating = one<{ avg: number | null; n: number }>("SELECT ROUND(AVG(rating), 1) AS avg, COUNT(*) AS n FROM reviews");
  const subs = one<{ n: number }>("SELECT COUNT(*) AS n FROM subscribers");
  const members = one<{ n: number }>("SELECT COUNT(*) AS n FROM loyalty");
  const gifts = one<{ n: number; sold: number; outstanding: number }>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS sold, COALESCE(SUM(balance), 0) AS outstanding FROM giftcards WHERE paid = 1"
  );
  const paidOnline = one<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE pay_method = 'online' AND pay_status = 'paid'");
  const allTime = one<{ n: number; revenue: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS revenue FROM orders");

  // Best sellers from all orders
  const counts = new Map<string, number>();
  for (const r of db.prepare("SELECT lines FROM orders").all() as { lines: string }[])
    for (const l of JSON.parse(r.lines) as { name: string; qty: number }[]) counts.set(l.name, (counts.get(l.name) ?? 0) + l.qty);
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, qty]) => ({ name, qty }));

  // Revenue for the last 7 days
  const week = db
    .prepare("SELECT date(created_at) AS day, SUM(total) AS revenue, COUNT(*) AS n FROM orders WHERE date(created_at) >= date(?, '-6 days') GROUP BY day")
    .all(today) as { day: string; revenue: number; n: number }[];
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = toDateStr(d);
    const hit = week.find((w) => w.day === key);
    return { day: key, label: d.toLocaleDateString("en-IN", { weekday: "short" }), revenue: hit?.revenue ?? 0, orders: hit?.n ?? 0 };
  });

  return Response.json({
    todayOrders: todayOrders.n,
    todayRevenue: todayOrders.revenue,
    activeOrders: active.n,
    bookingsToday: bookingsToday.n,
    guestsToday: bookingsToday.guests,
    rating: rating.avg,
    reviewCount: rating.n,
    subscribers: subs.n,
    members: members.n,
    allTimeOrders: allTime.n,
    allTimeRevenue: allTime.revenue,
    giftCards: gifts.n,
    giftSold: gifts.sold,
    giftOutstanding: gifts.outstanding,
    paidOnline: paidOnline.n,
    top,
    days,
  });
}
