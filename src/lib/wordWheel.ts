// Word wheel: make words of four letters or more from the nine on the wheel, always using the middle letter, each
// letter once. Everyday words count towards your rank; rarer ones are bonus words. Find the nine-letter word for a
// flourish. Pure, so the page and tests share it.
import { seededRand, shuffled } from "./gameOrders.ts";
import { WHEELS } from "./data/wordWheel.ts";

export const minMs = 5000;
export const MAX_MAIN = 40;
const dayOf = (date: string) => Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86400_000);
const ORDER = shuffled([...WHEELS.keys()], seededRand("wheel-order"));
export function wheelFor(date: string) {
  const w = WHEELS[ORDER[((dayOf(date) % ORDER.length) + ORDER.length) % ORDER.length]];
  // The outer eight letters, in a shuffled ring (the centre letter comes out once)
  const rest = [...w.word]; rest.splice(rest.indexOf(w.centre), 1);
  return { ...w, ring: shuffled(rest, seededRand(`wheel:${date}`)) };
}
export type Wheel = ReturnType<typeof wheelFor>;
export function judge(w: Wheel, found: string[], guess: string): { ok: "main" | "bonus" } | { why: string } {
  const g = guess.toLowerCase().trim();
  if (g.length < 4) return { why: "Four letters at least." };
  if (!g.includes(w.centre)) return { why: `Every word needs the middle letter, ${w.centre.toUpperCase()}.` };
  const pool = [...w.word];
  for (const ch of g) { const k = pool.indexOf(ch); if (k < 0) return { why: "Use each letter on the wheel once." }; pool.splice(k, 1); }
  if (found.includes(g)) return { why: "You've already found that one." };
  if (w.main.includes(g)) return { ok: "main" };
  if (w.bonus.includes(g)) return { ok: "bonus" };
  return { why: "That's not in our word list." };
}
export const RANKS = [["Warming up", 0], ["Good", 0.3], ["Great", 0.6], ["Wordsmith", 0.85], ["Genius", 1]] as const;
export const rankOf = (mainFound: number, total: number) => [...RANKS].reverse().find(([, f]) => mainFound >= Math.ceil(f * total))![0];
/** For the board: more everyday words is better, then quicker */
export const pack = (mainFound: number, ms: number) => (MAX_MAIN - mainFound) * 1_000_000 + Math.min(999_999, Math.max(0, Math.round(ms)));
export const MIN_SCORE = pack(MAX_MAIN, minMs), MAX_SCORE = pack(0, 999_999);
