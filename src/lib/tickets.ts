// Paid event tickets (free events still use a simple RSVP)
import "server-only";
import { db } from "./db";
import { findEvent } from "./eventsStore";

export const TICKET_MAX = 4;
const HOLD_MINUTES = 15; // an unpaid ticket keeps its seats this long

export type TicketRow = {
  code: string; event_id: string; name: string; email: string; qty: number; amount: number;
  paid: number; payment_ref: string | null; checked_in: number; checked_in_at: string | null; created_at: string;
};

/** Seats taken: free RSVPs, paid tickets, and tickets still being paid for */
export function seatsTaken(eventId: string) {
  const rsvps = (db.prepare("SELECT COUNT(*) AS n FROM rsvps WHERE event_id = ?").get(eventId) as { n: number }).n;
  const tickets = (
    db.prepare(`SELECT COALESCE(SUM(qty), 0) AS n FROM tickets WHERE event_id = ? AND (paid = 1 OR created_at >= datetime('now','localtime','-${HOLD_MINUTES} minutes'))`).get(eventId) as { n: number }
  ).n;
  return rsvps + tickets;
}

export const spotsLeft = (eventId: string) => {
  const ev = findEvent(eventId);
  return ev ? Math.max(0, ev.capacity - seatsTaken(eventId)) : 0;
};

export function getTicket(code: string) {
  return db.prepare("SELECT * FROM tickets WHERE code = ?").get(code.toUpperCase()) as TicketRow | undefined;
}
