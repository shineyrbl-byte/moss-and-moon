import { db } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { getMenu } from "@/lib/menuStore";
import type { QuoteLine } from "@/lib/pricing";

type Row = { created_at: string; lines: string; total: number; tip: number; phone: string; customer_id: number | null; table_no: number | null; delivery_address: string | null; staff_id: number | null };

// Owner: numbers for the Analytics tab. ?days=7|30|90
export async function GET(req: Request) {
  {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  const days = [7, 30, 90].includes(Number(new URL(req.url).searchParams.get("days"))) ? Number(new URL(req.url).searchParams.get("days")) : 30;
  const rows = db
    .prepare(`SELECT created_at, lines, total, tip, phone, customer_id, table_no, delivery_address, staff_id FROM orders WHERE created_at >= datetime('now','localtime','-${days} days')`)
    .all() as Row[];
  const catOf = new Map(getMenu({ includeHidden: true }).map((m) => [m.id, m.cat]));

  // Busiest hours: weekday (0 = Sunday) × hour
  const heat = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const byCat = { coffee: 0, tea: 0, cold: 0, food: 0, bakes: 0 } as Record<string, number>;
  const milk: Record<string, number> = { whole: 0, oat: 0, almond: 0, soy: 0, none: 0 };
  const size: Record<string, number> = { small: 0, regular: 0, large: 0 };
  const temp: Record<string, number> = { hot: 0, iced: 0 };
  let shots = 0, drinks = 0, items = 0, revenue = 0, tips = 0;
  const channels = { pickup: { orders: 0, revenue: 0 }, table: { orders: 0, revenue: 0 }, delivery: { orders: 0, revenue: 0 } };
  const guests = new Map<string, number>();
  const byStaff = new Map<number, number>();

  for (const r of rows) {
    const d = new Date(r.created_at.replace(" ", "T"));
    heat[d.getDay()][d.getHours()]++;
    revenue += r.total;
    tips += r.tip ?? 0;
    const ch = r.delivery_address ? "delivery" : r.table_no ? "table" : "pickup";
    channels[ch].orders++;
    channels[ch].revenue += r.total;
    const who = r.customer_id ? `c${r.customer_id}` : r.phone ? `p${r.phone}` : null;
    if (who) guests.set(who, (guests.get(who) ?? 0) + 1);
    if (r.staff_id) byStaff.set(r.staff_id, (byStaff.get(r.staff_id) ?? 0) + 1);
    for (const l of JSON.parse(r.lines) as QuoteLine[]) {
      const cat = l.cat ?? catOf.get(l.itemId) ?? "bakes";
      byCat[cat] = (byCat[cat] ?? 0) + l.total;
      items += l.qty;
      if (cat === "bakes" || cat === "food") continue;
      drinks += l.qty;
      if (l.opts.milk) milk[l.opts.milk] = (milk[l.opts.milk] ?? 0) + l.qty;
      if (l.opts.size) size[l.opts.size] = (size[l.opts.size] ?? 0) + l.qty;
      if (l.opts.temp) temp[l.opts.temp] = (temp[l.opts.temp] ?? 0) + l.qty;
      if (l.opts.shot) shots += l.qty;
    }
  }

  const names = new Map((db.prepare("SELECT id, name FROM staff").all() as { id: number; name: string }[]).map((s) => [s.id, s.name]));
  const repeat = [...guests.values()].filter((n) => n >= 2).length;

  return Response.json({
    days,
    orders: rows.length,
    revenue,
    avgOrder: rows.length ? Math.round(revenue / rows.length) : 0,
    tips,
    items,
    guests: guests.size,
    repeatRate: guests.size ? Math.round((repeat / guests.size) * 100) : 0,
    heat,
    byCategory: byCat,
    options: { milk, size, temp, extraShot: shots, drinks },
    channels,
    staff: [...byStaff].map(([id, n]) => ({ name: names.get(id) ?? "Former staff", orders: n })).sort((a, b) => b.orders - a.orders),
  });
}
