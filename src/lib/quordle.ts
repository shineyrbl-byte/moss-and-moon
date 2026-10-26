// Four at once: guess four five-letter words at the same time, in nine tries. Every guess is played on all four boards.
// Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";
import { COMMON5 } from "./data/common5.ts";
import { WORDS5 } from "./data/words5.ts";
import { ANSWERS, score, type Mark } from "./wordGame.ts";

export const TRIES = 9;
export const minMs = 15000;
export { score, type Mark };
let all: Set<string> | null = null;
export const isGuess = (w: string) => (all ??= new Set([...WORDS5.split(" "), ...ANSWERS, ...COMMON5])).has(w);

/** Today's four words: everyday ones, all different */
export function fourFor(date: string): string[] {
  const rand = seededRand(`fourat:${date}`);
  const pool = [...COMMON5];
  const out: string[] = [];
  while (out.length < 4) { const w = pool.splice(Math.floor(rand() * pool.length), 1)[0]; if (!out.includes(w)) out.push(w); }
  return out;
}
/** The guess that solved each word (1-based), or null if not yet */
export const solvedAt = (words: string[], guesses: string[]) => words.map((w) => { const k = guesses.indexOf(w); return k < 0 ? null : k + 1; });
export const allSolved = (words: string[], guesses: string[]) => solvedAt(words, guesses).every((x) => x !== null);
export const isOver = (words: string[], guesses: string[]) => allSolved(words, guesses) || guesses.length >= TRIES;
/** Fewest guesses then quickest, packed for the board (like Flood) */
export const pack = (n: number, ms: number) => n * 1_000_000 + Math.min(999_999, Math.max(0, Math.round(ms)));
export const MIN_SCORE = pack(4, minMs), MAX_SCORE = pack(TRIES, 999_999);
/** Keyboard colours for one board: the best mark each letter has had */
export function keyMarks(word: string, guesses: string[]): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  const rank = { b: 0, y: 1, g: 2 };
  for (const g of guesses) {
    if (g === word) break;
    score(g, word).forEach((m, i) => { const ch = g[i]; if (!out[ch] || rank[m] > rank[out[ch]]) out[ch] = m; });
  }
  return out;
}
