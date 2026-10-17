import { db, cleanText } from "@/lib/db";
import { EVENTS, toDateStr } from "@/lib/cafe";
import { rsvpEmail, sendLater } from "@/lib/email";

const going = (id: string) => (db.prepare("SELECT COUNT(*) AS n FROM rsvps WHERE event_id = ?").get(id) as { n: number }).n;

export async function GET() {
  const today = toDateStr(new Date());
  return Response.json(
    EVENTS.filter((e) => e.date >= today).map((e) => ({ ...e, spotsLeft: Math.max(0, e.capacity - going(e.id)) }))
  );
}

// RSVP to an event
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const ev = EVENTS.find((e) => e.id === b?.eventId);
  const name = cleanText(b?.name, 40);
  const email = cleanText(b?.email, 100).toLowerCase();
  if (!ev) return Response.json({ error: "Event not found." }, { status: 404 });
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Please add your name and email." }, { status: 400 });
  if (going(ev.id) >= ev.capacity) return Response.json({ error: "Sorry, this one is full!" }, { status: 409 });
  try {
    db.prepare("INSERT INTO rsvps (event_id, name, email) VALUES (?, ?, ?)").run(ev.id, name, email);
  } catch {
    return Response.json({ error: "You're already on the list for this one ✿" }, { status: 409 });
  }
  sendLater(email, ...rsvpEmail({ ...ev, name }));
  return Response.json({ ok: true, spotsLeft: ev.capacity - going(ev.id) });
}
