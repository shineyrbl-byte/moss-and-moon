// Menu explorer: which dishes a signed-in guest has tried, from their own orders.
import "server-only";
import { db } from "./db";
import { getMenu } from "./menuStore";

export const EXPLORE_CATS = [
  { id: "coffee", label: "Coffee", icon: "☕" },
  { id: "tea", label: "Tea & matcha", icon: "🍵" },
  { id: "cold", label: "Cold drinks", icon: "🧊" },
  { id: "food", label: "Food", icon: "🥪" },
  { id: "bakes", label: "Bakes & sweets", icon: "🥐" },
] as const;

export function explorerFor(customerId: number) {
  const rows = db.prepare("SELECT lines, created_at FROM orders WHERE customer_id = ? AND status != 'cancelled' ORDER BY id").all(customerId) as { lines: string; created_at: string }[];
  const first = new Map<string, string>(), times = new Map<string, number>();
  for (const r of rows) for (const l of JSON.parse(r.lines) as { itemId: string; qty: number }[]) {
    if (!first.has(l.itemId)) first.set(l.itemId, r.created_at.slice(0, 10));
    times.set(l.itemId, (times.get(l.itemId) ?? 0) + (l.qty || 1));
  }
  const menu = getMenu().filter((m) => !m.pup && EXPLORE_CATS.some((c) => c.id === m.cat));
  const cats = EXPLORE_CATS.map((c) => {
    const items = menu.filter((m) => m.cat === c.id).map((m) => ({ id: m.id, name: m.name, price: m.price, img: m.img, soldOut: !!m.soldOut, tried: first.get(m.id) ?? null, times: times.get(m.id) ?? 0 }));
    return { ...c, items, tried: items.filter((i) => i.tried).length, total: items.length };
  }).filter((c) => c.total > 0);
  const tried = cats.reduce((n, c) => n + c.tried, 0), total = cats.reduce((n, c) => n + c.total, 0);
  // Something new to try: the untried dish in the category you know least
  const next = [...cats].sort((a, b) => a.tried / a.total - b.tried / b.total).flatMap((c) => c.items.filter((i) => !i.tried && !i.soldOut))[0] ?? null;
  return { cats, tried, total, next };
}
