import { db } from "@/lib/db";
import { HOURS, TABLES_PER_SLOT, busyLevel, forecastDay, openStatus, quietestHour, toDateStr } from "@/lib/cafe";

// "How busy is it right now?" plus a forecast for the rest of today.
export async function GET() {
  const now = new Date();
  const day = now.getDay();
  const status = openStatus(now);

  // Right now: orders in the last 30 minutes + guests booked in the current hour and a half
  const { recent } = db.prepare("SELECT COUNT(*) AS recent FROM orders WHERE created_at >= datetime('now','localtime','-30 minutes')").get() as { recent: number };
  const { active } = db.prepare("SELECT COUNT(*) AS active FROM orders WHERE status IN ('received','brewing')").get() as { active: number };
  const today = toDateStr(now);
  const bookings = db.prepare("SELECT time, guests FROM bookings WHERE date = ? AND status != 'cancelled'").all(today) as { time: string; guests: number }[];
  const mins = now.getHours() * 60 + now.getMinutes();
  const seatedNow = bookings.filter((b) => {
    const [h, m] = b.time.split(":").map(Number);
    const t = h * 60 + m;
    return t <= mins && mins < t + 90;
  }).length;
  const bookedGuests: Record<number, number> = {};
  for (const b of bookings) {
    const h = Number(b.time.slice(0, 2));
    bookedGuests[h] = (bookedGuests[h] ?? 0) + b.guests;
  }

  // History: average orders per hour on this weekday over the last 8 weeks
  const rows = db
    .prepare(
      `SELECT CAST(strftime('%H', created_at) AS INTEGER) AS h, COUNT(*) AS n, COUNT(DISTINCT date(created_at)) AS days
       FROM orders WHERE created_at >= datetime('now','localtime','-56 days') AND CAST(strftime('%w', created_at) AS INTEGER) = ?
       GROUP BY h`
    )
    .all(day) as { h: number; n: number; days: number }[];
  const total = rows.reduce((s, r) => s + r.n, 0);
  const history = total >= 30 ? Object.fromEntries(rows.map((r) => [r.h, r.n / Math.max(1, r.days)])) : null;
  const forecast = forecastDay(day, history, bookedGuests);

  const live = Math.min(1, (recent / 10) * 0.6 + (active / 8) * 0.2 + (seatedNow / TABLES_PER_SLOT) * 0.4);
  const expected = forecast.find((f) => f.hour === now.getHours())?.score ?? 0;
  // Blend what's happening now with what usually happens at this hour
  const score = Math.round(Math.max(live, expected * 0.6 + live * 0.4) * 100) / 100;
  const quiet = quietestHour(forecast, now);

  return Response.json({
    open: status.open,
    level: status.open ? busyLevel(score) : null,
    score,
    quietestHour: quiet,
    forecast,
    hours: HOURS[day],
    basedOn: history ? "history" : "typical",
  });
}
