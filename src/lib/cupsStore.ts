// Cups saved: throwaway cups not used because guests brought their own (orders with the own-cup discount).
import "server-only";
import { db, getSetting, setSetting } from "./db";
import { toDateStr } from "./cafe";
import type { QuoteLine } from "./pricing";

const DRINKS = new Set(["coffee", "tea", "cold"]);
export const DEFAULT_GOAL = 100;

function cupsIn(rows: { lines: string }[]) {
  return rows.reduce((s, r) => s + (JSON.parse(r.lines) as QuoteLine[]).filter((l) => DRINKS.has(l.cat ?? "")).reduce((t, l) => t + l.qty, 0), 0);
}
export function cupsSaved(now = new Date()) {
  const month = toDateStr(now).slice(0, 7);
  const q = (extra: string, ...args: string[]) => cupsIn(db.prepare(`SELECT lines FROM orders WHERE perks LIKE '%own cup%' AND status != 'cancelled' AND sim = 0 ${extra}`).all(...args) as { lines: string }[]);
  const goal = Math.max(1, Number(getSetting("cups_goal")) || DEFAULT_GOAL);
  return { month, thisMonth: q("AND substr(created_at, 1, 7) = ?", month), total: q(""), goal };
}
export function setCupsGoal(v: unknown) {
  const n = Math.round(Number(v));
  if (!(n >= 1 && n <= 100000)) return { error: "Pick a goal between 1 and 100,000 cups." };
  setSetting("cups_goal", String(n));
  return { ok: true, goal: n };
}
