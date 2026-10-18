// How many people each hour needs, from past orders and bookings, vs who's on the rota
import "server-only";
import { db } from "./db";
import { TYPICAL_DAY, hoursOn, parseDate } from "./cafe";
import { weekDays } from "./rota";

/** One barista comfortably handles about this many orders an hour */
export const ORDERS_PER_PERSON = 14;
/** Booked guests in an hour that need an extra pair of hands on the floor */
export const GUESTS_PER_FLOOR = 16;
const TYPICAL_PEAK = 18; // orders/hour at a typical busy peak, before there's history

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Average orders per hour for each weekday over the last 8 weeks (null without enough history) */
function history() {
  const rows = db.prepare(
    `SELECT CAST(strftime('%w', created_at) AS INTEGER) AS d, CAST(strftime('%H', created_at) AS INTEGER) AS h, COUNT(*) AS n, COUNT(DISTINCT date(created_at)) AS days
     FROM orders WHERE created_at >= datetime('now','localtime','-56 days') GROUP BY d, h`,
  ).all() as { d: number; h: number; n: number; days: number }[];
  const daysPer = db.prepare(
    `SELECT CAST(strftime('%w', created_at) AS INTEGER) AS d, COUNT(DISTINCT date(created_at)) AS days FROM orders WHERE created_at >= datetime('now','localtime','-56 days') GROUP BY d`,
  ).all() as { d: number; days: number }[];
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (total < 100) return null;
  const dayCount = new Map(daysPer.map((x) => [x.d, x.days]));
  const out: Record<number, Record<number, number>> = {};
  for (const r of rows) (out[r.d] ??= {})[r.h] = r.n / Math.max(1, dayCount.get(r.d) ?? 1);
  return out;
}

export function staffingWeek(monday: string) {
  const hist = history();
  const days = weekDays(monday);
  const shifts = db.prepare("SELECT day, start, end FROM shifts WHERE day BETWEEN ? AND ?").all(days[0], days[6]) as { day: string; start: string; end: string }[];
  const bookings = db.prepare("SELECT date, time, guests FROM bookings WHERE date BETWEEN ? AND ? AND status != 'cancelled'").all(days[0], days[6]) as { date: string; time: string; guests: number }[];
  return {
    estimated: !hist,
    days: days.map((day) => {
      const d = parseDate(day)!;
      const h = hoursOn(d);
      if (!h) return { day, closed: true, hours: [] };
      const hours = [];
      for (let hr = h[0]; hr < h[1]; hr++) {
        const orders = hist ? (hist[d.getDay()]?.[hr] ?? 0) : (TYPICAL_DAY[hr] ?? 0.3) * TYPICAL_PEAK;
        const guests = bookings.filter((b) => b.date === day && Math.abs(mins(b.time) - hr * 60 - 30) < 60).reduce((s, b) => s + b.guests, 0);
        const need = Math.max(1, Math.ceil(orders / ORDERS_PER_PERSON) + (guests >= GUESTS_PER_FLOOR ? 1 : 0));
        // On shift for most of the hour (45+ minutes)
        const have = shifts.filter((s) => s.day === day && Math.min(mins(s.end), (hr + 1) * 60) - Math.max(mins(s.start), hr * 60) >= 45).length;
        hours.push({ hour: hr, orders: Math.round(orders * 10) / 10, guests, need, have });
      }
      return { day, closed: false, hours };
    }),
  };
}
