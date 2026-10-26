// Barista rush rules. Pure, so the page and tests share them.
type Drink = { id: string; cat: string; name: string; noMilk?: boolean; groups?: unknown[]; kids?: boolean; soldOut?: boolean; hidden?: boolean };
export type Build = { size: "small" | "regular" | "large"; temp: "hot" | "iced"; milk: "whole" | "oat" | "almond" | "soy" | "none"; shot: boolean };
export type GameOrder = { itemId: string; want: Build; guest: string };

export const GAME_SIZES = ["small", "regular", "large"] as const;
export const GAME_MILKS = ["whole", "oat", "almond", "soy"] as const;
const GUESTS = ["Ananya", "Kabir", "Meera", "Rohan", "Isha", "Arjun", "Diya", "Tara", "Neel", "Zoya", "Kiran", "Maya", "Dev", "Omar", "Leela", "Yash"];

/** Which choices matter for a drink (cold drinks are always iced, some have no milk, shots are for coffee) */
export const gameChoices = (d: Drink) => ({ temp: d.cat !== "cold", milk: !d.noMilk, shot: d.cat === "coffee" });

export const playableDrinks = <T extends Drink>(menu: T[]) => menu.filter((m) => ["coffee", "tea", "cold"].includes(m.cat) && !m.groups?.length && !m.kids && !m.soldOut && !m.hidden);

export function newOrder(drinks: Drink[], rand: () => number = Math.random): GameOrder {
  const d = drinks[Math.floor(rand() * drinks.length)];
  const c = gameChoices(d);
  const pick = <V,>(a: readonly V[]) => a[Math.floor(rand() * a.length)];
  return {
    itemId: d.id,
    guest: pick(GUESTS),
    want: {
      size: pick(GAME_SIZES),
      temp: d.cat === "cold" ? "iced" : c.temp && rand() < 0.4 ? "iced" : "hot",
      milk: c.milk ? pick(GAME_MILKS) : "none",
      shot: c.shot && rand() < 0.3,
    },
  };
}

/** What's wrong with the drink you made (empty = perfect) */
export function mistakes(want: Build, got: Build): (keyof Build)[] {
  return (Object.keys(want) as (keyof Build)[]).filter((k) => want[k] !== got[k]);
}

/** Points for a perfect drink: 100, up to 50 more for speed (under 8 s), times the streak (up to ×2) */
export function points(seconds: number, streak: number) {
  const speed = Math.max(0, Math.round(50 * (1 - seconds / 8)));
  return Math.round((100 + speed) * Math.min(2, 1 + streak * 0.1));
}
export const MISTAKE_PENALTY = 30;

/** A repeatable random sequence from a word (the daily challenge uses the date, so everyone gets the same orders) */
export function seededRand(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Days in a row you've played, counting back from today (dates as YYYY-MM-DD) */
export function playStreak(days: string[], today: string): number {
  return streakWithFreeze(days, today).streak;
}
/** Days in a row ending today. A streak freeze ❄️ forgives one missed day, at most once a week: the missed day
 * doesn't count, but it doesn't break the run either. */
export function streakWithFreeze(days: string[], today: string): { streak: number; frozen: string[] } {
  const set = new Set(days), frozen: string[] = [];
  const at = (k: number) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - k); return d.toISOString().slice(0, 10); };
  let n = 0, lastFreeze = -Infinity;
  for (let k = 0; ; k++) {
    if (set.has(at(k))) { n++; continue; }
    // Only a single missed day in the middle of a run, and not within a week of the last one forgiven
    if (n > 0 && set.has(at(k + 1)) && k - lastFreeze >= 7) { frozen.push(at(k)); lastFreeze = k; continue; }
    break;
  }
  return { streak: n, frozen };
}
