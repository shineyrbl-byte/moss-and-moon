import { db } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { cateringConfirmedEmail, cateringQuoteEmail, sendLater } from "@/lib/email";
import { getCatering, publicCatering } from "@/lib/catering";
import { limited, tooMany } from "@/lib/rateLimit";

type P = { params: Promise<{ code: string }> };

// The guest's page: their request and quote
export async function GET(req: Request, { params }: P) {
  if (limited(req, "catering-view", 60, 600_000)) return tooMany();
  const c = getCatering((await params).code);
  if (!c) return Response.json({ error: "We couldn't find that catering request." }, { status: 404 });
  return Response.json(publicCatering(c));
}

// The guest accepts the quote and pays on the day ({ action: "accept" })
export async function POST(req: Request, { params }: P) {
  if (limited(req, "catering-view", 60, 600_000)) return tooMany();
  const c = getCatering((await params).code);
  if (!c) return Response.json({ error: "Not found." }, { status: 404 });
  if (c.status !== "quoted") return Response.json({ error: c.status === "requested" ? "We haven't sent a quote yet." : "This quote has already been answered." }, { status: 409 });
  db.prepare("UPDATE catering SET status = 'accepted', pay_choice = 'on the day' WHERE code = ?").run(c.code);
  sendLater(c.email, ...cateringConfirmedEmail({ ...c, paid: false }));
  return Response.json({ ok: true });
}

// Owner: send a quote ({ amount, note }), or move it along ({ status: "paid" | "done" | "declined" })
export async function PATCH(req: Request, { params }: P) {
  const gate = await ownerGate();
  if (gate) return gate;
  const c = getCatering((await params).code);
  if (!c) return Response.json({ error: "Not found." }, { status: 404 });
  const b = await req.json().catch(() => null);
  if (b?.amount !== undefined) {
    const amount = Math.round(Number(b.amount));
    if (!(amount > 0 && amount <= 10_000_000)) return Response.json({ error: "Enter the quote amount in rupees." }, { status: 400 });
    if (!["requested", "quoted"].includes(c.status)) return Response.json({ error: "This one is already accepted." }, { status: 409 });
    const note = String(b.note ?? "").trim().slice(0, 1500) || null;
    db.prepare("UPDATE catering SET status = 'quoted', amount = ?, quote_note = ?, quoted_at = datetime('now','localtime') WHERE code = ?").run(amount, note, c.code);
    sendLater(c.email, ...cateringQuoteEmail({ ...c, amount, quote_note: note }));
    return Response.json({ ok: true });
  }
  if (b?.status === "paid") db.prepare("UPDATE catering SET status = 'paid', paid_at = COALESCE(paid_at, datetime('now','localtime')) WHERE code = ? AND status IN ('quoted','accepted')").run(c.code);
  else if (b?.status === "done") db.prepare("UPDATE catering SET status = 'done', paid_at = COALESCE(paid_at, datetime('now','localtime')) WHERE code = ? AND status IN ('accepted','paid')").run(c.code);
  else if (b?.status === "declined") db.prepare("UPDATE catering SET status = 'declined' WHERE code = ? AND status IN ('requested','quoted')").run(c.code);
  else return Response.json({ error: "Unknown change." }, { status: 400 });
  return Response.json({ ok: true, status: getCatering(c.code)!.status });
}
