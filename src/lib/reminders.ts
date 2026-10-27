// Friendly nudges by email:
//  - an order has been ready for 10 minutes and nobody has picked it up
//  - a table booking is coming up in the next 2 hours
//  - an event you have a ticket for is tomorrow (from 10am the day before), and game night (by push, if asked for)
import "server-only";
import { db } from "./db";
import { bookingReminderEmail, eventReminderEmail, pickupReminderEmail, sendEmail } from "./email";
import { findEvent } from "./eventsStore";
import { nightReminderTick } from "./cafeExtras";
import { toDateStr } from "./cafe";
import type { QuoteLine } from "./pricing";

export const PICKUP_REMINDER_MIN = 10;
export const BOOKING_REMINDER_MIN = 120;

export async function reminderTick(now = new Date()) {
  // Ready but not collected (pickups only: table orders are carried over, deliveries are on their way)
  const waiting = db
    .prepare(
      `SELECT code, name, email, lines FROM orders
       WHERE status = 'ready' AND pickup_reminded = 0 AND email IS NOT NULL AND table_no IS NULL AND delivery_address IS NULL
         AND ready_at IS NOT NULL AND ready_at <= datetime('now','localtime','-${PICKUP_REMINDER_MIN} minutes')
         AND ready_at >= datetime('now','localtime','-6 hours')
       LIMIT 20`
    )
    .all() as { code: string; name: string; email: string; lines: string }[];
  for (const o of waiting) {
    db.prepare("UPDATE orders SET pickup_reminded = 1 WHERE code = ?").run(o.code);
    await sendEmail(o.email, ...pickupReminderEmail({ ...o, lines: JSON.parse(o.lines) as QuoteLine[] }));
  }

  // Bookings later today, within the next 2 hours (only if booked earlier than that)
  const today = toDateStr(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const soon = db
    .prepare("SELECT id, code, name, email, time, guests, created_at FROM bookings WHERE date = ? AND status = 'confirmed' AND reminded = 0 AND email IS NOT NULL")
    .all(today) as { id: number; code: string; name: string; email: string; time: string; guests: number; created_at: string }[];
  for (const b of soon) {
    const [h, m] = b.time.split(":").map(Number);
    const until = h * 60 + m - nowMin;
    if (until > BOOKING_REMINDER_MIN || until < 0) continue;
    db.prepare("UPDATE bookings SET reminded = 1 WHERE id = ?").run(b.id);
    // Booked in the last 2 hours? They don't need a reminder yet
    const bookedMinsAgo = (now.getTime() - new Date(b.created_at.replace(" ", "T")).getTime()) / 60_000;
    if (bookedMinsAgo < BOOKING_REMINDER_MIN) continue;
    await sendEmail(b.email, ...bookingReminderEmail(b));
  }

  // Events tomorrow: one email per ticket, from 10am the day before
  if (now.getHours() >= 10) {
    const tomorrow = toDateStr(new Date(now.getTime() + 86_400_000));
    const tickets = db.prepare("SELECT code, event_id, name, email, qty FROM tickets WHERE reminded = 0 AND (paid = 1 OR amount = 0) AND email != '' LIMIT 200").all() as { code: string; event_id: string; name: string; email: string; qty: number }[];
    for (const tk of tickets) {
      const ev = findEvent(tk.event_id);
      if (!ev || ev.date !== tomorrow) continue;
      db.prepare("UPDATE tickets SET reminded = 1 WHERE code = ?").run(tk.code);
      await sendEmail(tk.email, ...eventReminderEmail({ title: ev.title, date: ev.date, time: ev.time, name: tk.name, qty: tk.qty, code: tk.code }));
    }
  }
  await nightReminderTick(now);
}
