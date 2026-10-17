import { db, makeCode, cleanPhone, cleanText, cleanEmail } from "@/lib/db";
import { bookingEmail, sendLater } from "@/lib/email";
import { slotsFor, parseDate, toDateStr, TABLES_PER_SLOT } from "@/lib/cafe";
import { isAdmin, unauthorized } from "@/lib/auth";

/** Tables used in a slot. Groups of 5+ take two tables. */
function tablesUsed(date: string, time: string) {
  const r = db
    .prepare("SELECT COALESCE(SUM(CASE WHEN guests >= 5 THEN 2 ELSE 1 END), 0) AS n FROM bookings WHERE date = ? AND time = ? AND status = 'confirmed'")
    .get(date, time) as { n: number };
  return r.n;
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Invalid request." }, { status: 400 });

  const name = cleanText(b.name, 40);
  const phone = cleanPhone(b.phone);
  const date = String(b.date ?? "");
  const time = String(b.time ?? "");
  const guests = Math.floor(Number(b.guests));
  const note = cleanText(b.note, 200);
  const email = cleanEmail(b.email);
  if (b.email && !email) return Response.json({ error: "That email doesn't look right." }, { status: 400 });

  if (!name) return Response.json({ error: "Please tell us your name." }, { status: 400 });
  if (phone.length !== 10) return Response.json({ error: "Please enter a 10-digit phone number." }, { status: 400 });
  if (!(guests >= 1 && guests <= 8)) return Response.json({ error: "We can seat 1–8 guests online. Call us for bigger groups!" }, { status: 400 });
  const d = parseDate(date);
  if (!d || date < toDateStr(new Date())) return Response.json({ error: "Please pick a date from today onwards." }, { status: 400 });
  if (!slotsFor(date).includes(time)) return Response.json({ error: "That time isn't available — please pick another." }, { status: 400 });

  const need = guests >= 5 ? 2 : 1;
  if (tablesUsed(date, time) + need > TABLES_PER_SLOT)
    return Response.json({ error: "That slot just filled up. Try another time?" }, { status: 409 });

  const code = makeCode("TB");
  db.prepare("INSERT INTO bookings (code, name, phone, email, date, time, guests, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(code, name, phone, email || null, date, time, guests, note);
  if (email) sendLater(email, ...bookingEmail({ code, name, date, time, guests }));
  return Response.json({ code, name, date, time, guests });
}

// Staff: upcoming bookings
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const rows = db
    .prepare("SELECT * FROM bookings WHERE date >= ? ORDER BY date, time LIMIT 200")
    .all(toDateStr(new Date()));
  return Response.json(rows);
}

// Staff: cancel a booking
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { code, status } = await req.json().catch(() => ({}));
  if (!["confirmed", "cancelled", "seated"].includes(status)) return Response.json({ error: "Unknown status." }, { status: 400 });
  db.prepare("UPDATE bookings SET status = ? WHERE code = ?").run(status, String(code));
  return Response.json({ ok: true });
}
