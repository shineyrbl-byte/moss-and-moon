// Waste log: leftover bakes at closing, and how many to bake tomorrow
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { getMenu } from "./menuStore";
import { unitCost, costTable } from "./profit";
import type { QuoteLine } from "./pricing";

export const WASTE_REASONS = ["leftover", "dropped", "expired", "other"] as const;
const WEEKS = 4;

/** For each bake: average sold and wasted on this weekday, and a suggested amount */
export function bakePlan(forDate: Date) {
  const weekday = forDate.getDay();
  const sameDays = Array.from({ length: WEEKS }, (_, i) => toDateStr(new Date(forDate.getTime() - (i + 1) * 7 * 86_400_000)));
  const sold = new Map<string, number>();
  const placeholders = sameDays.map(() => "?").join(",");
  for (const o of db.prepare(`SELECT lines FROM orders WHERE date(created_at) IN (${placeholders})`).all(...sameDays) as { lines: string }[])
    for (const l of JSON.parse(o.lines) as QuoteLine[]) sold.set(l.itemId, (sold.get(l.itemId) ?? 0) + l.qty);
  const wasted = new Map((db.prepare(`SELECT item_id, SUM(qty) AS q FROM waste WHERE day IN (${placeholders}) GROUP BY item_id`).all(...sameDays) as { item_id: string; q: number }[]).map((w) => [w.item_id, w.q]));
  const daysWithData = (db.prepare(`SELECT COUNT(DISTINCT date(created_at)) AS n FROM orders WHERE date(created_at) IN (${placeholders})`).get(...sameDays) as { n: number }).n;

  return getMenu({ includeHidden: false })
    .filter((m) => m.cat === "bakes" || m.cat === "food")
    .map((m) => {
      const avgSold = daysWithData ? (sold.get(m.id) ?? 0) / daysWithData : null;
      const avgWaste = daysWithData ? (wasted.get(m.id) ?? 0) / daysWithData : null;
      // Bake what usually sells plus a small buffer; less buffer when lots gets thrown away
      const buffer = avgWaste !== null && avgSold && avgWaste > avgSold * 0.2 ? 1.0 : 1.15;
      const suggest = avgSold === null ? null : Math.max(avgSold > 0 ? 2 : 0, Math.ceil(avgSold * buffer));
      return { itemId: m.id, name: m.name, avgSold: avgSold === null ? null : Math.round(avgSold * 10) / 10, avgWaste: avgWaste === null ? null : Math.round(avgWaste * 10) / 10, suggest };
    })
    .sort((a, b) => (b.avgSold ?? 0) - (a.avgSold ?? 0))
    .map((p) => ({ ...p, weekday }));
}

export function logWaste(day: string, entries: { itemId: string; qty: number; reason: string }[], staffId: number | null) {
  const menu = new Map(getMenu({ includeHidden: true }).map((m) => [m.id, m]));
  const costs = costTable();
  const add = db.prepare("INSERT INTO waste (day, item_id, item_name, qty, reason, cost, staff_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
  let n = 0;
  for (const e of entries) {
    const item = menu.get(e.itemId);
    const qty = Math.floor(Number(e.qty));
    if (!item || !(qty >= 1 && qty <= 200)) continue;
    const reason = (WASTE_REASONS as readonly string[]).includes(e.reason) ? e.reason : "leftover";
    add.run(day, item.id, item.name, qty, reason, unitCost(item, {}, costs).cost * qty, staffId);
    n++;
  }
  return n;
}
