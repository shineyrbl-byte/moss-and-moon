// What things cost to make, and how much profit the café keeps.
import "server-only";
import { db } from "./db";
import type { MenuItem } from "./menu";
import { isDrink, type Options, type QuoteLine } from "./pricing";
import { getIngredients, needsFor } from "./stock";
import { menuLookup } from "./menuStore";
import { toDateStr } from "./cafe";

export const CUP_COST = 6; // cup, lid, sleeve, sugar sachet…
export const BAKE_SHARE = 0.35; // a bake with no cost set is guessed at 35% of its price

export function costTable() {
  return new Map(getIngredients().map((i) => [i.id, i.cost ?? 0]));
}

/** Cost to make one, in ₹, plus whether it's a guess */
export function unitCost(item: MenuItem, opts: Options, costs = costTable()) {
  let c = item.cost ?? 0;
  for (const [id, amt] of needsFor(item, opts)) c += amt * (costs.get(id) ?? 0);
  if (isDrink(item.cat)) c += CUP_COST;
  // Syrups, toppings and food add-ons: roughly a third of what they're sold for
  c += ((opts.syrup && opts.syrup !== "none" ? 30 : 0) + (opts.toppings ?? []).length * 10 + (opts.addons ?? []).reduce((s, id) => s + (item.addons?.find((a) => a.id === id)?.price ?? 0), 0)) * 0.35;
  const guessed = !isDrink(item.cat) && item.cost === undefined && !item.uses?.length;
  if (guessed) c = item.price * BAKE_SHARE;
  return { cost: Math.round(c * 100) / 100, guessed };
}

/** Add the cost to each order line (saved with the order, so later price changes don't rewrite history) */
export function withCosts(lines: QuoteLine[], find: (id: string) => MenuItem | undefined) {
  const costs = costTable();
  return lines.map((l) => {
    const item = find(l.itemId);
    return item ? { ...l, cost: Math.round(unitCost(item, l.opts, costs).cost * l.qty * 100) / 100 } : l;
  });
}

type Row = { created_at: string; lines: string; total: number; refund_amount: number };

export function profitReport(days = 30) {
  const since = toDateStr(new Date(Date.now() - (days - 1) * 86_400_000));
  const rows = db.prepare("SELECT created_at, lines, total, refund_amount FROM orders WHERE date(created_at) >= ?").all(since) as Row[];
  const find = menuLookup();
  const costs = costTable();
  const items = new Map<string, { name: string; qty: number; revenue: number; cost: number; guessed: boolean }>();
  const byDay = new Map<string, { revenue: number; cost: number }>();
  let revenue = 0, cost = 0, guessedLines = 0, lineCount = 0;

  for (const o of rows) {
    const lines = JSON.parse(o.lines) as QuoteLine[];
    const gross = lines.reduce((s, l) => s + l.total, 0) || 1;
    const net = o.total - (o.refund_amount ?? 0); // what the café actually keeps after discounts and refunds
    let orderCost = 0;
    for (const l of lines) {
      const item = find(l.itemId);
      const known = l.cost !== undefined;
      const c = known ? l.cost! : item ? unitCost(item, l.opts, costs).cost * l.qty : 0;
      const guessed = !known && !!item && unitCost(item, l.opts, costs).guessed;
      orderCost += c;
      lineCount++;
      if (guessed) guessedLines++;
      const it = items.get(l.name) ?? { name: l.name, qty: 0, revenue: 0, cost: 0, guessed: false };
      it.qty += l.qty;
      it.revenue += (l.total / gross) * net; // share of the discounts
      it.cost += c;
      it.guessed ||= guessed || (item ? unitCost(item, l.opts, costs).guessed : false);
      items.set(l.name, it);
    }
    revenue += net;
    cost += orderCost;
    const d = o.created_at.slice(0, 10);
    const day = byDay.get(d) ?? { revenue: 0, cost: 0 };
    day.revenue += net;
    day.cost += orderCost;
    byDay.set(d, day);
  }

  const waste = db.prepare("SELECT COALESCE(SUM(cost), 0) AS c FROM waste WHERE day >= ?").get(since) as { c: number };
  const r = (n: number) => Math.round(n);
  const daysList = Array.from({ length: days }, (_, i) => toDateStr(new Date(Date.now() - (days - 1 - i) * 86_400_000)));
  return {
    days,
    revenue: r(revenue),
    cost: r(cost),
    waste: r(waste.c),
    profit: r(revenue - cost - waste.c),
    margin: revenue ? Math.round(((revenue - cost - waste.c) / revenue) * 100) : 0,
    estimatedShare: lineCount ? Math.round((guessedLines / lineCount) * 100) : 0,
    daily: daysList.map((d) => {
      const x = byDay.get(d) ?? { revenue: 0, cost: 0 };
      return { day: d, revenue: r(x.revenue), profit: r(x.revenue - x.cost) };
    }),
    items: [...items.values()]
      .map((i) => ({ ...i, revenue: r(i.revenue), cost: r(i.cost), profit: r(i.revenue - i.cost), margin: i.revenue ? Math.round(((i.revenue - i.cost) / i.revenue) * 100) : 0 }))
      .sort((a, b) => b.profit - a.profit),
  };
}
