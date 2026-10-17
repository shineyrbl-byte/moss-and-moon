import { db, cleanPhone, cleanText } from "@/lib/db";
import { currentCustomer } from "@/lib/account";
import { STAMPS_FOR_REWARD } from "@/lib/cafe";

// The signed-in guest's profile, stamps and recent orders
export async function GET() {
  const c = await currentCustomer();
  if (!c) return Response.json({ signedIn: false });
  const card = c.phone ? (db.prepare("SELECT stamps, rewards_used FROM loyalty WHERE phone = ?").get(c.phone) as { stamps: number; rewards_used: number } | undefined) : undefined;
  const orders = db
    .prepare("SELECT code, status, total, giftcard_used, pay_status, created_at, lines FROM orders WHERE customer_id = ? OR (phone != '' AND phone = ?) ORDER BY id DESC LIMIT 30")
    .all(c.id, c.phone ?? "__none__") as Record<string, unknown>[];
  return Response.json({
    signedIn: true,
    customer: { name: c.name, email: c.email, phone: c.phone, birthday: c.birthday, favs: c.favs, referralCode: c.referral_code, credit: c.credit, memberSince: c.created_at },
    stamps: { count: card?.stamps ?? 0, rewardsUsed: card?.rewards_used ?? 0, needed: STAMPS_FOR_REWARD },
    orders: orders.map((o) => ({ ...o, lines: JSON.parse(String(o.lines)) })),
  });
}

// Update name / phone / birthday / favourites
export async function PATCH(req: Request) {
  const c = await currentCustomer();
  if (!c) return Response.json({ error: "Please sign in." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = b.name !== undefined ? cleanText(b.name, 40) || null : c.name;
  const phone = b.phone !== undefined ? cleanPhone(b.phone) || null : c.phone;
  if (phone && phone.length !== 10) return Response.json({ error: "Please enter a 10-digit phone number." }, { status: 400 });
  let birthday = c.birthday;
  if (b.birthday !== undefined) {
    const m = /^(\d{2})-(\d{2})$/.exec(String(b.birthday));
    if (b.birthday && !(m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= 31))
      return Response.json({ error: "Please pick your birthday." }, { status: 400 });
    // Birthdays can be set once, so the treat can't be claimed every week
    if (c.birthday && b.birthday !== c.birthday) return Response.json({ error: "Your birthday is already saved. Ask staff if it needs fixing." }, { status: 400 });
    birthday = b.birthday || c.birthday;
  }
  const favs = Array.isArray(b.favs) ? JSON.stringify(b.favs.filter((x: unknown) => typeof x === "string").slice(0, 100)) : JSON.stringify(c.favs);
  db.prepare("UPDATE customers SET name = ?, phone = ?, birthday = ?, favs = ? WHERE id = ?").run(name, phone, birthday, favs, c.id);
  return Response.json({ ok: true });
}
