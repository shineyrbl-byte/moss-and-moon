import { db } from "@/lib/db";
import { findEvent } from "@/lib/eventsStore";
import { getTicket } from "@/lib/tickets";
import { isAdmin, unauthorized } from "@/lib/auth";
import { limited, tooMany } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

// The ticket page (anyone with the code; the email is hidden)
export async function GET(req: Request, { params }: Ctx) {
  if (limited(req, "ticket-lookup", 300, 600000)) return tooMany();
  const t = getTicket((await params).code);
  if (!t) return Response.json({ error: "We couldn't find that ticket." }, { status: 404 });
  const ev = findEvent(t.event_id);
  return Response.json({ code: t.code, name: t.name, qty: t.qty, amount: t.amount, paid: !!t.paid, checkedIn: !!t.checked_in, checkedInAt: t.checked_in_at, event: ev ?? null });
}

// Staff at the door: check a ticket in (once)
export async function PATCH(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const t = getTicket((await params).code);
  if (!t) return Response.json({ error: "We couldn't find that ticket." }, { status: 404 });
  if (!t.paid) return Response.json({ error: "This ticket hasn't been paid for." }, { status: 409 });
  if (t.checked_in) return Response.json({ error: `Already checked in at ${t.checked_in_at?.slice(11, 16)}.` }, { status: 409 });
  db.prepare("UPDATE tickets SET checked_in = 1, checked_in_at = datetime('now','localtime') WHERE code = ?").run(t.code);
  return Response.json({ ok: true, name: t.name, qty: t.qty });
}
