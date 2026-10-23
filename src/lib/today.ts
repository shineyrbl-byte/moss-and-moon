// "Today at the café": cups poured so far and the most-loved drink, for the home page and TV board.
import "server-only";
import { db } from "./db";
import { menuLookup } from "./menuStore";

const g = globalThis as { __mmToday?: { at: number; v: TodayStats } };
export type TodayStats = { cups: number; orders: number; top: { id: string; name: string; qty: number } | null };

export function todayStats(): TodayStats {
  if (g.__mmToday && Date.now() - g.__mmToday.at < 60_000) return g.__mmToday.v;
  const rows = db.prepare("SELECT lines FROM orders WHERE date(created_at) = date('now','localtime') AND status != 'cancelled'").all() as { lines: string }[];
  const find = menuLookup();
  const qty = new Map<string, number>();
  let cups = 0;
  for (const r of rows) {
    for (const l of JSON.parse(r.lines) as { itemId: string; qty: number; cat?: string }[]) {
      const cat = l.cat ?? find(l.itemId)?.cat;
      if (cat !== "coffee" && cat !== "tea" && cat !== "cold") continue;
      cups += l.qty;
      qty.set(l.itemId, (qty.get(l.itemId) ?? 0) + l.qty);
    }
  }
  const best = [...qty.entries()].sort((a, b) => b[1] - a[1])[0];
  const v: TodayStats = { cups, orders: rows.length, top: best ? { id: best[0], name: find(best[0])?.name ?? best[0], qty: best[1] } : null };
  g.__mmToday = { at: Date.now(), v };
  return v;
}
