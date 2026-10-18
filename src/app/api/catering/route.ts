import { db, makeCode, cleanEmail, cleanPhone, cleanText } from "@/lib/db";
import { alertOwner } from "@/lib/push";
import { ownerGate } from "@/lib/auth";
import { parseDate, toDateStr } from "@/lib/cafe";
import { cateringRequestEmail, sendLater } from "@/lib/email";
import { ownerEmail } from "@/lib/owner";
import { limited, tooMany } from "@/lib/rateLimit";
import { CATERING_KINDS, CATERING_LEAD_DAYS, CATERING_MIN_GUESTS, type Catering } from "@/lib/catering";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Anyone: ask for a catering quote
export async function POST(req: Request) {
  if (limited(req, "catering", 10, 3600_000)) return tooMany();
  const b = await req.json().catch(() => null);
  const name = cleanText(b?.name, 60);
  const email = cleanEmail(b?.email);
  const phone = cleanPhone(b?.phone);
  const date = String(b?.date ?? "");
  const time = String(b?.time ?? "");
  const guests = Math.floor(Number(b?.guests));
  const kind = (CATERING_KINDS as readonly string[]).includes(b?.kind) ? b.kind : "other";
  const method = b?.method === "delivery" ? "delivery" : "pickup";
  const address = cleanText(b?.address, 200);
  const details = cleanText(b?.details, 1500);
  if (!name) return Response.json({ error: "Please tell us your name." }, { status: 400 });
  if (!email) return Response.json({ error: "Please add an email so we can send the quote." }, { status: 400 });
  if (phone.length !== 10) return Response.json({ error: "Please enter a 10-digit phone number." }, { status: 400 });
  const earliest = toDateStr(new Date(Date.now() + CATERING_LEAD_DAYS * 86_400_000));
  if (!parseDate(date) || date < earliest) return Response.json({ error: `Please give us at least ${CATERING_LEAD_DAYS} days' notice.` }, { status: 400 });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return Response.json({ error: "Please pick a time." }, { status: 400 });
  if (!(guests >= CATERING_MIN_GUESTS && guests <= 500)) return Response.json({ error: `Catering is for ${CATERING_MIN_GUESTS} to 500 guests. For fewer, just order ahead!` }, { status: 400 });
  if (method === "delivery" && address.length < 10) return Response.json({ error: "Please add the full delivery address." }, { status: 400 });
  if (details.length < 5) return Response.json({ error: "Tell us a little about what you'd like." }, { status: 400 });

  const code = makeCode("CT", 8);
  db.prepare("INSERT INTO catering (code, name, email, phone, event_date, event_time, guests, kind, method, address, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    code, name, email, phone, date, time, guests, kind, method, method === "delivery" ? address : null, details,
  );
  sendLater(email, ...cateringRequestEmail({ code, name, event_date: date, event_time: time, guests }));
  const owner = ownerEmail();
  if (owner) sendLater(owner, `New catering request: ${guests} guests on ${date}`, `<p><b>${esc(name)}</b> (${esc(email)}, ${phone}) would like catering for <b>${guests}</b> on <b>${date} at ${time}</b> (${kind}, ${method}).</p><p style="white-space:pre-line">${esc(details)}</p><p>Send a quote from Staff → Catering.</p>`);
  alertOwner("catering", `Catering request: ${guests} guests`, `${name} · ${date} at ${time}`, "/admin#Catering");
  return Response.json({ ok: true, code });
}

// Owner: every request, newest first
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json(db.prepare("SELECT * FROM catering ORDER BY CASE status WHEN 'requested' THEN 0 WHEN 'accepted' THEN 1 WHEN 'paid' THEN 2 WHEN 'quoted' THEN 3 ELSE 4 END, event_date LIMIT 200").all() as Catering[]);
}
