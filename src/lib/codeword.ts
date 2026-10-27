// Codeword: a criss-cross grid where every letter has been swapped for a number (the same letter, the same number).
// A few letters are given. Work out which letter each number stands for. Pure, so the page and tests share it.
import { seededRand, shuffled } from "./gameOrders.ts";
import { BANK, crissCross } from "./weeklyCrossword.ts";

export const SIZE = 9;
export const minMs = 20000;
export const HINT_MS = 15000;
export function codewordFor(date: string) {
  const rand = seededRand(`codeword:${date}`);
  const words = Object.keys(BANK).filter((w) => w.length <= SIZE);
  const { grid, placed } = crissCross(words, SIZE, 12, rand);
  const letters = [...new Set(grid.filter(Boolean))];
  // Numbers 1..n handed out in a shuffled order, so they say nothing about the letters
  const order = shuffled(letters, rand);
  const numOf: Record<string, number> = Object.fromEntries(order.map((l, k) => [l, k + 1]));
  const code = grid.map((g) => (g ? numOf[g] : 0));
  // Give away two of the less common letters as a start
  const counts = (l: string) => grid.filter((g) => g === l).length;
  const given = [...letters].sort((a, b) => counts(a) - counts(b) || a.localeCompare(b)).slice(0, 2).map((l) => numOf[l]);
  return { code, n: letters.length, key: Object.fromEntries(order.map((l, k) => [k + 1, l])) as Record<number, string>, given, words: placed.map((p) => p.word) };
}
export type Codeword = ReturnType<typeof codewordFor>;
/** Solved when every number in the grid has its right letter */
export const isSolved = (c: Codeword, guess: Record<number, string>) => Object.entries(c.key).every(([n, l]) => guess[+n] === l);
/** Numbers whose guess clashes: the same letter given to two numbers */
export function clashes(guess: Record<number, string>) {
  const by = new Map<string, number[]>();
  for (const [n, l] of Object.entries(guess)) if (l) by.set(l, [...(by.get(l) ?? []), +n]);
  return new Set([...by.values()].filter((v) => v.length > 1).flat());
}
