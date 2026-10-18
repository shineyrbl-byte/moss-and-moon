import { db } from "@/lib/db";
import { currentStaff, unauthorized } from "@/lib/auth";
import { parseDate, toDateStr } from "@/lib/cafe";
import { difference, expectedTakings, getCashup, saveCashup, type Cashup } from "@/lib/cashup";

const withDiff = (c: Cashup | null) => (c ? { ...c, difference: difference(c) } : null);

// Staff: today's expected takings, today's cash-up (if done) and the last 14
export async function GET(req: Request) {
  if (!(await currentStaff())) return unauthorized();
  const q = new URL(req.url).searchParams.get("day");
  const day = q && parseDate(q) ? q : toDateStr(new Date());
  const history = (db.prepare("SELECT * FROM cashups ORDER BY day DESC LIMIT 14").all() as Cashup[]).map(withDiff);
  return Response.json({ day, ...expectedTakings(day), cashup: withDiff(getCashup(day)), history });
}

// Staff: save the count ({ float, cash, upi, card, note, day? })
export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const b = await req.json().catch(() => null);
  const day = typeof b?.day === "string" && parseDate(b.day) ? b.day : toDateStr(new Date());
  if (day > toDateStr(new Date())) return Response.json({ error: "You can't cash up a future day." }, { status: 400 });
  const num = (v: unknown) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) && n >= 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : null;
  };
  const v = { float: num(b?.float), cash: num(b?.cash), upi: num(b?.upi), card: num(b?.card) };
  if (Object.values(v).some((x) => x === null)) return Response.json({ error: "Amounts must be numbers of zero or more." }, { status: 400 });
  const c = saveCashup(day, { ...(v as { float: number; cash: number; upi: number; card: number }), note: String(b?.note ?? "").trim().slice(0, 300) }, me);
  return Response.json({ ok: true, cashup: withDiff(c) });
}
