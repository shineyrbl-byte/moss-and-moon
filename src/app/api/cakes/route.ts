import { db, makeCode, cleanEmail, cleanPhone, cleanText } from "@/lib/db";
import { currentStaff, unauthorized } from "@/lib/auth";
import { hoursOn, parseDate, toDateStr } from "@/lib/cafe";
import { CAKES_PER_DAY, CAKE_LEAD_DAYS, CAKE_MESSAGE_MAX, WHOLE_CAKES, wholeCake } from "@/lib/cakes";
import { cakesOn } from "@/lib/cakeOrders";
import { menuLookup } from "@/lib/menuStore";
import { limited, tooMany } from "@/lib/rateLimit";

// The cakes you can order whole (anyone), or the upcoming cake orders (staff, ?orders=1)
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("orders")) {
    if (!(await currentStaff())) return unauthorized();
    return Response.json(db.prepare("SELECT * FROM cake_orders WHERE status IN ('paid','ready') OR (status = 'collected' AND pickup_date >= date('now','localtime','-2 days')) ORDER BY pickup_date, pickup_time").all());
  }
  const find = menuLookup();
  return Response.json({
    cakes: WHOLE_CAKES.map((c) => ({ ...c, item: find(c.itemId) })).filter((c) => c.item),
    leadDays: CAKE_LEAD_DAYS,
  });
}

// Order a whole cake ({ itemId, size, message?, date, time, name, phone, email, note? }); pay with kind "cake"
export async function POST(req: Request) {
  if (limited(req, "cakes", 15, 3600_000)) return tooMany();
  const b = await req.json().catch(() => null);
  const cake = wholeCake(String(b?.itemId ?? ""));
  const item = cake && menuLookup()(cake.itemId);
  if (!cake || !item) return Response.json({ error: "Pick a cake." }, { status: 400 });
  const size = cake.sizes.find((s) => s.id === b?.size);
  if (!size) return Response.json({ error: "Pick a size." }, { status: 400 });
  const name = cleanText(b?.name, 40), phone = cleanPhone(b?.phone), email = cleanEmail(b?.email);
  if (!name || phone.length !== 10 || !email) return Response.json({ error: "Add your name, a 10-digit phone and email." }, { status: 400 });
  const date = String(b?.date ?? ""), time = String(b?.time ?? "");
  const d = parseDate(date);
  if (!d || date < toDateStr(new Date(Date.now() + CAKE_LEAD_DAYS * 86_400_000))) return Response.json({ error: `Cakes need ${CAKE_LEAD_DAYS} days' notice. Please pick a later date.` }, { status: 400 });
  const h = hoursOn(d);
  if (!h) return Response.json({ error: "We're closed that day. Please pick another." }, { status: 400 });
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  const mins = m ? Number(m[1]) * 60 + Number(m[2]) : -1;
  if (!m || mins < h[0] * 60 + 60 || mins > h[1] * 60 - 30) return Response.json({ error: "Pick a pickup time during opening hours (from an hour after opening)." }, { status: 400 });
  if (cakesOn(date) >= CAKES_PER_DAY) return Response.json({ error: "We're fully booked for cakes that day. Could you pick another?" }, { status: 409 });
  const message = cake.message ? cleanText(b?.message, CAKE_MESSAGE_MAX) : "";
  const code = makeCode("CK", 6);
  db.prepare("INSERT INTO cake_orders (code, item_id, cake_name, size, size_label, message, pickup_date, pickup_time, name, phone, email, note, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    code, item.id, item.name, size.id, size.label, message || null, date, time, name, phone, email, cleanText(b?.note, 200) || null, size.price,
  );
  return Response.json({ code, price: size.price });
}
