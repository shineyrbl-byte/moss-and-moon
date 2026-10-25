// Bean hive: make words from seven letters, always using the middle one. Pure, so the page, server and tests share it.
import { seededRand } from "./gameOrders.ts";
import { HIVE_PUZZLES, type HivePuzzle } from "./data/hive.ts";

export const RANKS: [string, number][] = [
  ["Decaf", 0], ["A sip", 0.04], ["Single shot", 0.12], ["Cortado", 0.25], ["Flat white", 0.4], ["Double shot", 0.6], ["Moon brew", 1],
];
const words = (s: string) => s.split(/\s+/).filter(Boolean);

/** Puzzles go round in a fixed shuffled order, so the same one doesn't come back for sixteen days */
export function hiveFor(date: string) {
  const day = Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86400_000);
  const order = [...HIVE_PUZZLES.keys()];
  const rand = seededRand("hive-order");
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return puzzle(HIVE_PUZZLES[order[day % HIVE_PUZZLES.length]], `${date}`);
}

export function puzzle(p: HivePuzzle, seed = "") {
  const outer = [...new Set(p.base)].filter((c) => c !== p.centre);
  // Shuffle the outer ring per day so it doesn't spell the answer
  const rand = seededRand(`hive-ring:${seed}`);
  for (let i = outer.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [outer[i], outer[j]] = [outer[j], outer[i]]; }
  const common = words(p.common), bonus = words(p.bonus);
  return { centre: p.centre, outer, common, bonus, max: common.reduce((s, w) => s + points(w, p.base), 0) };
}
export type Hive = ReturnType<typeof puzzle>;

export const isPangram = (w: string, letters: string) => [...new Set(letters)].every((c) => w.includes(c));
/** 4 letters: 1 point. Longer: a point a letter. Using all seven: 7 more. */
export function points(w: string, letters: string) {
  return (w.length === 4 ? 1 : w.length) + (isPangram(w, letters) ? 7 : 0);
}
export const lettersOf = (h: Pick<Hive, "centre" | "outer">) => h.centre + h.outer.join("");

/** Why a word isn't allowed, or null if it's fine */
export function hiveProblem(h: Hive, w: string, found: string[]) {
  if (w.length < 4) return "Four letters or more.";
  const letters = lettersOf(h);
  if (![...w].every((c) => letters.includes(c))) return "Only the letters in the hive.";
  if (!w.includes(h.centre)) return `Every word needs the middle letter, ${h.centre.toUpperCase()}.`;
  if (found.includes(w)) return "Already found.";
  if (!h.common.includes(w) && !h.bonus.includes(w)) return "Not in our word list.";
  return null;
}
export function rankOf(score: number, max: number) {
  let r = RANKS[0][0];
  for (const [name, at] of RANKS) if (score >= Math.ceil(at * max)) r = name;
  return r;
}
/** Where each rank starts, in points */
export const rankSteps = (max: number) => RANKS.map(([name, at]) => ({ name, at: Math.ceil(at * max) }));
