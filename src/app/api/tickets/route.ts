import { db, cleanEmail, cleanText, makeCode } from "@/lib/db";
import { EVENTS, toDateStr } from "@/lib/cafe";
import { TICKET_MAX, spotsLeft } from "@/lib/tickets";
import { isAdmin, unauthorized } from "@/lib/auth";

// Reserve tickets for a paid event. They're held for 15 minutes while you pay.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const ev = EVENTS.find((e) => e.id === b?.eventId);
  if (!ev || ev.date < toDateStr(new Date())) return Response.json({ error: "Event not found." }, { status: 404 });
  if (!ev.price) return Response.json({ error: "This one is free, just RSVP ✿" }, { status: 400 });
  const name = cleanText(b?.name, 40);
  const email = cleanEmail(b?.email);
  const qty = Math.floor(Number(b?.qty ?? 1));
  if (!name || !email) return Response.json({ error: "Please add your name and email (your ticket goes there)." }, { status: 400 });
  if (!(qty >= 1 && qty <= TICKET_MAX)) return Response.json({ error: `You can buy 1 to ${TICKET_MAX} tickets at a time.` }, { status: 400 });
  if (spotsLeft(ev.id) < qty) return Response.json({ error: spotsLeft(ev.id) ? `Only ${spotsLeft(ev.id)} spot(s) left.` : "Sorry, this one is sold out!" }, { status: 409 });
  const code = makeCode("TK", 5);
  db.prepare("INSERT INTO tickets (code, event_id, name, email, qty, amount) VALUES (?, ?, ?, ?, ?, ?)").run(code, ev.id, name, email, qty, ev.price * qty);
  return Response.json({ code, amount: ev.price * qty });
}

// Staff: everyone holding a paid ticket, per event
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const rows = db.prepare("SELECT code, event_id, name, email, qty, amount, checked_in, checked_in_at, created_at FROM tickets WHERE paid = 1 ORDER BY event_id, created_at").all();
  return Response.json({ events: EVENTS.filter((e) => e.price > 0), tickets: rows });
}
