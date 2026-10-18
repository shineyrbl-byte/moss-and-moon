// "Goes well with": for each drink, the bake or dish most often ordered with it
import "server-only";
import { db } from "./db";
import { getMenu } from "./menuStore";
import type { QuoteLine } from "./pricing";

const DRINK = new Set(["coffee", "tea", "cold"]);
const FOOD = new Set(["bakes", "food"]);
/** Sensible pairs before there's enough order history */
const STARTERS: Record<string, string[]> = {
  coffee: ["croissant", "cinnamon-roll", "cookie"], tea: ["cookie", "macarons", "croissant"], cold: ["fudge-cake", "cookie", "donut"],
};
const MIN_TOGETHER = 3;
let cache: { at: number; map: Record<string, string> } | null = null;

export function pairings() {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.map;
  const menu = getMenu().filter((m) => !m.soldOut);
  const ok = new Set(menu.filter((m) => FOOD.has(m.cat)).map((m) => m.id));
  const counts = new Map<string, Map<string, number>>();
  for (const o of db.prepare("SELECT lines FROM orders WHERE created_at >= datetime('now','localtime','-90 days') AND status != 'cancelled'").all() as { lines: string }[]) {
    const lines = JSON.parse(o.lines) as QuoteLine[];
    const drinks = [...new Set(lines.filter((l) => DRINK.has(l.cat ?? "")).map((l) => l.itemId))];
    const foods = [...new Set(lines.filter((l) => FOOD.has(l.cat ?? "") && ok.has(l.itemId)).map((l) => l.itemId))];
    for (const d of drinks) for (const f of foods) {
      const m = counts.get(d) ?? new Map<string, number>();
      m.set(f, (m.get(f) ?? 0) + 1);
      counts.set(d, m);
    }
  }
  const map: Record<string, string> = {};
  for (const m of menu.filter((x) => DRINK.has(x.cat))) {
    const best = [...(counts.get(m.id) ?? [])].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= MIN_TOGETHER) map[m.id] = best[0];
    else { const s = (STARTERS[m.cat] ?? []).find((id) => ok.has(id)); if (s) map[m.id] = s; }
  }
  cache = { at: Date.now(), map };
  return map;
}
