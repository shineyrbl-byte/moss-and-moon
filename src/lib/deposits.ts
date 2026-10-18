// Deposits for big group bookings: paid online, then carried to the bill as a gift card
import "server-only";
import { db, makeCode } from "./db";
import { DEPOSIT } from "./cafe";
import { bookingEmail, bookingInvite, sendEmail, sendLater } from "./email";
import { rupees } from "./pricing";

type B = { code: string; name: string; email: string | null; date: string; time: string; guests: number; deposit: number; deposit_status: string | null; table_no: number | null };

export const depositFor = (guests: number) => (guests >= DEPOSIT.minGuests ? guests * DEPOSIT.perGuest : 0);

/** Payment confirmed: hold the table and make a gift card for the deposit */
export function depositPaid(code: string, ref: string | null) {
  const b = db.prepare("SELECT code, name, email, date, time, guests, deposit, deposit_status, table_no FROM bookings WHERE code = ?").get(code) as B | undefined;
  if (!b || b.deposit_status !== "due") return false;
  if (db.prepare("UPDATE bookings SET deposit_status = 'paid', status = 'confirmed' WHERE code = ? AND deposit_status = 'due'").run(code).changes === 0) return false;
  const card = makeCode("GC", 8);
  db.prepare("INSERT INTO giftcards (code, amount, balance, from_name, to_name, to_email, message, paid, payment_ref) VALUES (?, ?, ?, 'Booking deposit', ?, ?, ?, 1, ?)").run(
    card, b.deposit, b.deposit, b.name, b.email ?? "", `Deposit for booking ${b.code}`, ref,
  );
  db.prepare("UPDATE bookings SET deposit_card = ? WHERE code = ?").run(card, code);
  if (b.email) {
    const [subject, html] = bookingEmail({ code: b.code, name: b.name, date: b.date, time: b.time, guests: b.guests, table: b.table_no });
    sendLater(b.email, subject, `${html}<p style="background:#fadbe3;border-radius:12px;padding:10px 14px"><b>${rupees(b.deposit)} deposit paid.</b> It comes off your bill: use gift card <b style="font-family:monospace">${card}</b> when you order, or show this email at the counter.</p>`, [bookingInvite(b)]);
  }
  return true;
}

/** Called every minute: big bookings that weren't paid for in time are let go */
export async function depositTick() {
  const stale = db.prepare(`SELECT code, name, email, date, time, guests FROM bookings WHERE deposit_status = 'due' AND status = 'pending' AND created_at < datetime('now','localtime', ?)`).all(`-${DEPOSIT.holdMinutes} minutes`) as B[];
  for (const b of stale) {
    if (db.prepare("UPDATE bookings SET status = 'cancelled' WHERE code = ? AND status = 'pending'").run(b.code).changes === 0) continue;
    if (b.email) await sendEmail(b.email, "Your table wasn't held", `<p>Hi ${b.name}, the deposit for your table for ${b.guests} on ${b.date} at ${b.time} didn't come through, so we've let the table go. You're welcome to book again ✿</p>`);
  }
}

/** A no-show keeps the deposit: the gift card stops working */
export function markNoShow(code: string) {
  const b = db.prepare("SELECT deposit_card, deposit_status FROM bookings WHERE code = ?").get(code) as { deposit_card: string | null; deposit_status: string | null } | undefined;
  if (b?.deposit_card && b.deposit_status === "paid") {
    db.prepare("UPDATE giftcards SET balance = 0 WHERE code = ?").run(b.deposit_card);
    db.prepare("UPDATE bookings SET deposit_status = 'kept' WHERE code = ?").run(code);
  }
}

/** Last 30 days: how many bookings didn't turn up */
export function noShowStats() {
  return db.prepare(
    `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END), 0) AS noShows,
       COALESCE(SUM(CASE WHEN deposit_status = 'kept' THEN deposit ELSE 0 END), 0) AS kept
     FROM bookings WHERE date >= date('now','localtime','-30 days') AND date <= date('now','localtime') AND status IN ('seated','no-show','confirmed')`,
  ).get() as { total: number; noShows: number; kept: number };
}
