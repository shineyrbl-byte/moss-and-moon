// My puzzle stats: sums over the days you played and your times. Pure, so the server, page and tests share it.
import { longestRun } from "./trophies.ts";

export type TimeRow = { game: string; mode: string; ms: number };
export type TimeStat = { game: string; mode: string; n: number; best: number; typical: number };

export function median(xs: number[]) {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y), m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}
/** Best and typical (median) time for each game and mode */
export function timeStats(rows: TimeRow[]): TimeStat[] {
  const by = new Map<string, TimeRow[]>();
  for (const r of rows) { const k = `${r.game}|${r.mode}`; by.set(k, [...(by.get(k) ?? []), r]); }
  return [...by.values()].map((rs) => ({ game: rs[0].game, mode: rs[0].mode, n: rs.length, best: Math.min(...rs.map((r) => r.ms)), typical: median(rs.map((r) => r.ms)) }));
}

const day = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const str = (t: number) => new Date(t).toISOString().slice(0, 10);
/** Days in a row up to today (or up to yesterday, if today isn't played yet) */
export function currentRun(days: string[], today: string) {
  const set = new Set(days);
  let t = day(today);
  if (!set.has(today)) t -= 86_400_000;
  let n = 0;
  while (set.has(str(t))) { n++; t -= 86_400_000; }
  return n;
}
/** The last `weeks` weeks as columns of seven days (Monday first), each with how many games you played */
export function calendar(perDay: Record<string, number>, today: string, weeks = 12): { date: string; n: number; future: boolean }[][] {
  const t = day(today), dow = (new Date(t).getUTCDay() + 6) % 7; // 0 = Monday
  const start = t - dow * 86_400_000 - (weeks - 1) * 7 * 86_400_000;
  return [...Array(weeks).keys()].map((w) => [...Array(7).keys()].map((d) => {
    const at = start + (w * 7 + d) * 86_400_000, date = str(at);
    return { date, n: perDay[date] ?? 0, future: at > t };
  }));
}
/** The summary for the top of the page */
export function summary(played: Record<string, string[]>, today: string) {
  const perDay: Record<string, number> = {};
  for (const days of Object.values(played)) for (const d of new Set(days)) perDay[d] = (perDay[d] ?? 0) + 1;
  const days = Object.keys(perDay).sort();
  const plays = Object.values(played).reduce((s, d) => s + new Set(d).size, 0);
  return { perDay, days: days.length, plays, longest: longestRun(days), current: currentRun(days, today), first: days[0] ?? null, busiest: Math.max(0, ...Object.values(perDay)) };
}
