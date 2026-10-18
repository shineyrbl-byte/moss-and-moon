import { db, cleanPhone, cleanText } from "@/lib/db";
import { currentCustomer } from "@/lib/account";
import { MAX_SCHEDULES, badDay, describe, nextRun, type ScheduleRow } from "@/lib/schedules";
import { menuLookup } from "@/lib/menuStore";
import { cleanOptions } from "@/lib/pricing";
import { parseDate } from "@/lib/cafe";

const signIn = () => Response.json({ error: "Please sign in to set up a regular order." }, { status: 401 });

function own(id: unknown, customerId: number) {
  return db.prepare("SELECT * FROM schedules WHERE id = ? AND customer_id = ?").get(Number(id), customerId) as ScheduleRow | undefined;
}

// Your regular orders
export async function GET() {
  const me = await currentCustomer();
  if (!me) return signIn();
  const rows = db.prepare("SELECT * FROM schedules WHERE customer_id = ? ORDER BY id").all(me.id) as ScheduleRow[];
  return Response.json(rows.map((s) => ({ id: s.id, days: s.days.split(",").map(Number), time: s.time, active: !!s.active, skipDate: s.skip_date, lastOrder: s.last_order, summary: describe(s), next: nextRun(s) })));
}

// Make one: { lines, days: [1..5], time: "08:30", name?, phone? }
export async function POST(req: Request) {
  const me = await currentCustomer();
  if (!me) return signIn();
  const b = await req.json().catch(() => null);
  const count = (db.prepare("SELECT COUNT(*) AS n FROM schedules WHERE customer_id = ?").get(me.id) as { n: number }).n;
  if (count >= MAX_SCHEDULES) return Response.json({ error: `You can have up to ${MAX_SCHEDULES} regular orders.` }, { status: 409 });
  const days = [...new Set((Array.isArray(b?.days) ? b.days : []).map(Number).filter((d: number) => d >= 0 && d <= 6))] as number[];
  const time = String(b?.time ?? "");
  if (!days.length) return Response.json({ error: "Pick at least one day." }, { status: 400 });
  if (!/^([01]\d|2[0-3]):(00|15|30|45)$/.test(time)) return Response.json({ error: "Pick a pickup time." }, { status: 400 });
  const bad = badDay(days, time);
  if (bad) return Response.json({ error: `We're not open at ${time} on ${bad}. Pick another time or day.` }, { status: 400 });
  const find = menuLookup();
  const lines = (Array.isArray(b?.lines) ? b.lines : []).slice(0, 10).map((l: { itemId?: string; opts?: unknown; qty?: number }) => {
    const item = find(String(l.itemId));
    const qty = Math.floor(Number(l.qty));
    return item && qty >= 1 && qty <= 10 ? { itemId: item.id, opts: cleanOptions(item, l.opts), qty } : null;
  }).filter(Boolean);
  if (!lines.length) return Response.json({ error: "Nothing to order. Add a drink first." }, { status: 400 });
  const phone = cleanPhone(b?.phone || me.phone || "");
  if (phone.length !== 10) return Response.json({ error: "Add your phone number to your account first." }, { status: 400 });
  const name = cleanText(b?.name || me.name, 40) || "Regular";
  const r = db.prepare("INSERT INTO schedules (customer_id, name, phone, lines, days, time) VALUES (?, ?, ?, ?, ?, ?)").run(me.id, name, phone, JSON.stringify(lines), days.sort().join(","), time);
  return Response.json({ ok: true, id: Number(r.lastInsertRowid) });
}

// Pause / resume ({ id, active }), or skip one day ({ id, skip: "YYYY-MM-DD" | null })
export async function PATCH(req: Request) {
  const me = await currentCustomer();
  if (!me) return signIn();
  const b = await req.json().catch(() => null);
  const s = own(b?.id, me.id);
  if (!s) return Response.json({ error: "Not found." }, { status: 404 });
  if ("active" in (b ?? {})) db.prepare("UPDATE schedules SET active = ? WHERE id = ?").run(b.active ? 1 : 0, s.id);
  if ("skip" in (b ?? {})) db.prepare("UPDATE schedules SET skip_date = ? WHERE id = ?").run(b.skip && parseDate(String(b.skip)) ? String(b.skip) : null, s.id);
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = await currentCustomer();
  if (!me) return signIn();
  const b = await req.json().catch(() => null);
  const s = own(b?.id, me.id);
  if (!s) return Response.json({ error: "Not found." }, { status: 404 });
  db.prepare("DELETE FROM schedules WHERE id = ?").run(s.id);
  return Response.json({ ok: true });
}
