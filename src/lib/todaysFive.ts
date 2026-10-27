// Today's five: a short daily playlist from the daily games. Two word games, two logic games and a quick one. Pure.
import { seededRand } from "./gameOrders.ts";

export const KINDS = {
  word: ["word", "connections", "hive", "ladder", "wordsearch", "crossword", "cipher", "jumble", "corners", "boggle", "four", "threads", "cryptic", "wheel", "codeword"],
  logic: ["sudoku", "nonogram", "sweeper", "crack", "paths", "lamps", "flood", "tiles", "milk", "lights", "table", "parasols", "tipjar", "towers", "cups", "sums", "bill", "taller", "traytiles", "seats", "garden", "rope", "necklace", "trail", "pipes", "cutters", "stars", "zip", "bikes", "push"],
  quick: ["trivia", "dish", "memory", "slide", "jigsaw", "spot", "price"],
} as const;

const take = (list: readonly string[], n: number, rand: () => number) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};
// These puzzles joined on this day. Earlier days keep the picks they had, so old streaks still add up.
export const NEW_LOGIC_FROM = "2026-10-27";
const NEW_GAMES: readonly string[] = ["milk", "lights", "table", "parasols", "tipjar", "towers", "cups", "corners", "sums", "boggle", "bill", "taller", "traytiles", "seats", "four", "threads", "garden", "rope", "necklace", "trail", "pipes", "cutters", "cryptic", "stars", "wheel", "codeword", "zip", "bikes", "push", "price"];
const on = (list: readonly string[], date: string) => (date < NEW_LOGIC_FROM ? list.filter((id) => !NEW_GAMES.includes(id)) : list);

export function todaysFive(date: string): string[] {
  const rand = seededRand(`five:${date}`);
  const [w, l, q] = [take(on(KINDS.word, date), 2, rand), take(on(KINDS.logic, date), 2, rand), take(KINDS.quick, 1, rand)];
  // Mix them up so it isn't always words first
  return take([w[0], l[0], q[0], w[1], l[1]], 5, rand);
}
/** Days where all five of that day's picks were played */
export const fiveDays = (played: Record<string, string[]>) =>
  [...new Set(Object.values(played).flat())].filter((d) => todaysFive(d).every((id) => played[id]?.includes(d))).sort();
