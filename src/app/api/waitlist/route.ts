import { db, cleanEmail, cleanPhone, cleanText } from "@/lib/db";
import { parseDate, slotsFor, toDateStr } from "@/lib/cafe";
import { isAdmin, unauthorized } from "@/lib/auth";

// Join the waitlist for a full time slot
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const name = cleanText(b?.name, 40);
  const phone = cleanPhone(b?.phone);
  const email = cleanEmail(b?.email);
  const date = String(b?.date ?? "");
  const time = String(b?.time ?? "");
  const guests = Math.floor(Number(b?.guests));
  if (!name || phone.length !== 10) return Response.json({ error: "Please add your name and phone." }, { status: 400 });
  if (!email) return Response.json({ error: "Please add your email so we can tell you when a table opens up." }, { status: 400 });
  if (!parseDate(date) || date < toDateStr(new Date()) || !slotsFor(date).includes(time)) return Response.json({ error: "Please pick a valid date and time." }, { status: 400 });
  if (!(guests >= 1 && guests <= 8)) return Response.json({ error: "1–8 guests, please." }, { status: 400 });
  const dupe = db.prepare("SELECT 1 FROM waitlist WHERE date = ? AND time = ? AND phone = ? AND status = 'waiting'").get(date, time, phone);
  if (!dupe) db.prepare("INSERT INTO waitlist (name, phone, email, date, time, guests) VALUES (?, ?, ?, ?, ?, ?)").run(name, phone, email, date, time, guests);
  const ahead = (db.prepare("SELECT COUNT(*) AS n FROM waitlist WHERE date = ? AND time = ? AND status = 'waiting'").get(date, time) as { n: number }).n;
  return Response.json({ ok: true, position: ahead });
}

// Staff: everyone waiting from today on
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json(db.prepare("SELECT * FROM waitlist WHERE date >= ? AND status = 'waiting' ORDER BY date, time, id").all(toDateStr(new Date())));
}
