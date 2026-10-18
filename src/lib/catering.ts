// Catering: guests ask for food for an event, the owner sends a quote, the guest accepts and pays
import "server-only";
import { db } from "./db";

export const CATERING_KINDS = ["office", "birthday", "party", "meeting", "other"] as const;
export const CATERING_MIN_GUESTS = 10;
export const CATERING_LEAD_DAYS = 2;

export type Catering = {
  code: string; name: string; email: string; phone: string; event_date: string; event_time: string; guests: number; kind: string;
  method: "pickup" | "delivery"; address: string | null; details: string;
  status: "requested" | "quoted" | "accepted" | "paid" | "done" | "declined";
  amount: number | null; quote_note: string | null; pay_choice: string | null; payment_ref: string | null; quoted_at: string | null; paid_at: string | null; created_at: string;
};

export const getCatering = (code: string) => (db.prepare("SELECT * FROM catering WHERE code = ?").get(code.toUpperCase()) as Catering | undefined) ?? null;

/** What the guest sees (no payment refs) */
export const publicCatering = (c: Catering) => ({
  code: c.code, name: c.name, eventDate: c.event_date, eventTime: c.event_time, guests: c.guests, kind: c.kind, method: c.method, address: c.address,
  details: c.details, status: c.status, amount: c.amount, quoteNote: c.quote_note, payChoice: c.pay_choice, paid: !!c.paid_at,
});

export function markCateringPaid(code: string, ref: string | null) {
  return db.prepare("UPDATE catering SET status = 'paid', payment_ref = COALESCE(?, payment_ref), pay_choice = COALESCE(pay_choice, 'online'), paid_at = datetime('now','localtime') WHERE code = ? AND status IN ('quoted','accepted')").run(ref, code).changes > 0;
}
