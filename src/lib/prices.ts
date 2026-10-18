// Supplier prices: every change to an ingredient's cost is kept, so rises get noticed
import "server-only";
import { db } from "./db";
import { getIngredients, totals } from "./stock";
import { menuLookup } from "./menuStore";
import type { QuoteLine } from "./pricing";

/** A rise of this much (or more) since the price 90 days ago is flagged */
export const PRICE_ALERT = 0.1;

export function recordPrice(ingredientId: string, cost: number, note: string | null, oldCost: number | null) {
  // The first change also keeps the earlier price, so there's something to compare with
  if (oldCost !== null && !db.prepare("SELECT 1 FROM ingredient_prices WHERE ingredient_id = ?").get(ingredientId))
    db.prepare("INSERT INTO ingredient_prices (ingredient_id, cost, note, created_at) VALUES (?, ?, 'earlier price', datetime('now','localtime','-1 second'))").run(ingredientId, oldCost);
  db.prepare("INSERT INTO ingredient_prices (ingredient_id, cost, note) VALUES (?, ?, ?)").run(ingredientId, cost, note);
}

/** How much of each ingredient the last 30 days of orders used */
function usage30() {
  const find = menuLookup();
  const used = new Map<string, number>();
  for (const o of db.prepare("SELECT lines FROM orders WHERE created_at >= datetime('now','localtime','-30 days') AND status != 'cancelled'").all() as { lines: string }[])
    for (const [id, amt] of totals(JSON.parse(o.lines) as QuoteLine[], find)) used.set(id, (used.get(id) ?? 0) + amt);
  return used;
}

/** Each ingredient's price now vs ~90 days ago, and what the change costs a month */
export function priceWatch() {
  const used = usage30();
  return getIngredients()
    .map((i) => {
      const history = db.prepare("SELECT cost, note, created_at FROM ingredient_prices WHERE ingredient_id = ? ORDER BY id").all(i.id) as { cost: number; note: string | null; created_at: string }[];
      if (!history.length || i.cost === null) return null;
      // The price in force 90 days ago (or the earliest one we know)
      const cutoff = new Date(Date.now() - 90 * 86_400_000);
      const old = [...history].reverse().find((h) => new Date(h.created_at.replace(" ", "T")) <= cutoff) ?? history[0];
      const was = old.cost;
      const change = was ? (i.cost - was) / was : 0;
      return {
        id: i.id, name: i.name, unit: i.unit, cost: i.cost, was, change: Math.round(change * 1000) / 10,
        monthly: Math.round((i.cost - was) * (used.get(i.id) ?? 0)),
        alert: change >= PRICE_ALERT,
        history: history.slice(-8).map((h) => ({ cost: h.cost, at: h.created_at.slice(0, 10), note: h.note })),
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.history.length > 0)
    .sort((a, b) => Math.abs(b.monthly) - Math.abs(a.monthly));
}
