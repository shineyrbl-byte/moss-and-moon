import { db, cleanText } from "@/lib/db";
import { listEvents, findEvent, cleanEvent, saveEvent, deleteEvent } from "@/lib/eventsStore";
import { isAdmin, ownerGate } from "@/lib/auth";
import { rsvpEmail, sendLater } from "@/lib/email";
import { seatsTaken } from "@/lib/tickets";
import { limited, tooMany } from "@/lib/rateLimit";

const going = seatsTaken;

// Upcoming events (staff can ask for past ones too with ?all=1)
export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1" && (await isAdmin());
  return Response.json(listEvents({ upcoming: !all }).map((e) => ({ ...e, spotsLeft: Math.max(0, e.capacity - going(e.id)) })));
}

// Owner: add or edit an event ({ id? , title, date, time, desc, img, capacity, price })
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Invalid request." }, { status: 400 });
  const existing = typeof b.id === "string" && b.id ? findEvent(b.id) : undefined;
  if (b.id && !existing) return Response.json({ error: "Event not found." }, { status: 404 });
  const e = cleanEvent(b, existing?.id);
  if ("error" in e) return Response.json(e, { status: 400 });
  if (existing && e.capacity < going(e.id)) return Response.json({ error: `${going(e.id)} people are already coming, so spots can't go below that.` }, { status: 400 });
  saveEvent(e);
  // New event that repeats: every week (or every 2 weeks, or monthly) for a number of times
  const every = b.repeat === "weekly" ? 7 : b.repeat === "fortnightly" ? 14 : b.repeat === "monthly" ? 0 : null;
  const times = Math.min(26, Math.max(1, Math.floor(Number(b.times) || 1)));
  if (!existing && every !== null && times > 1) {
    const series = e.id;
    saveEvent({ ...e, series });
    for (let i = 1; i < times; i++) {
      const d = new Date(e.date + "T12:00");
      if (every) d.setDate(d.getDate() + every * i);
      else d.setMonth(d.getMonth() + i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      saveEvent({ ...e, id: `${e.id}-${date}`, date, series });
    }
    return Response.json({ ...e, series, created: times });
  }
  return Response.json(e);
}

// Owner: delete an event (only if no paid tickets)
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  // { id, series: true } removes this and every later one in its series (skipping any with paid tickets)
  const ev = findEvent(String(b?.id ?? ""));
  if (b?.series && ev?.series) {
    const later = listEvents().filter((x) => x.series === ev.series && x.date >= ev.date);
    const kept = later.map((x) => deleteEvent(x.id)).filter((r) => "error" in r).length;
    return Response.json({ ok: true, removed: later.length - kept, kept });
  }
  const r = deleteEvent(String(b?.id ?? ""));
  return Response.json(r, { status: "error" in r ? 409 : 200 });
}

// RSVP to an event
export async function POST(req: Request) {
  if (limited(req, "rsvp", 30, 600000)) return tooMany();
  const b = await req.json().catch(() => null);
  const ev = findEvent(String(b?.eventId ?? ""));
  if (ev && ev.date < new Date().toISOString().slice(0, 10)) return Response.json({ error: "That event has already happened." }, { status: 410 });
  const name = cleanText(b?.name, 40);
  const email = cleanText(b?.email, 100).toLowerCase();
  if (!ev) return Response.json({ error: "Event not found." }, { status: 404 });
  if (ev.price) return Response.json({ error: "This event needs a ticket." }, { status: 400 });
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
