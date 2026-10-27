// Word chain: two minutes to chain as many words as you can. Each word starts with the last letter of the one before,
// starting from today's word. Three to five letters, no repeats. Pure, so the page, the server check and tests share it.
import { seededRand, shuffled } from "./gameOrders.ts";
import { VALID, COMPUTER_WORDS } from "./cafeLetters.ts";

export const GAME_MS = 120_000, MAX_WORDS = 200;
export const minMs = 3000;
const STARTS = COMPUTER_WORDS.filter((w) => w.length >= 4 && w.length <= 5 && !/[qxzj]$/.test(w)).sort();
const dayOf = (date: string) => Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86400_000);
const ORDER = shuffled([...STARTS.keys()], seededRand("chain-order"));
export const startFor = (date: string) => STARTS[ORDER[((dayOf(date) % ORDER.length) + ORDER.length) % ORDER.length]];

export function judge(chain: string[], guess: string): { ok: true } | { why: string } {
  const g = guess.toLowerCase().trim(), last = chain[chain.length - 1];
  if (!/^[a-z]{3,5}$/.test(g)) return { why: "Three to five letters." };
  if (g[0] !== last[last.length - 1]) return { why: `It has to start with ${last[last.length - 1].toUpperCase()}.` };
  if (chain.includes(g)) return { why: "You've used that one." };
  if (!VALID.has(g)) return { why: "That's not in our word list." };
  return { ok: true };
}
/** More words is better; more letters breaks a tie */
export const pack = (words: number, letters: number) => (MAX_WORDS - words) * 1_000_000 + Math.max(0, 999_999 - letters);
export const MIN_SCORE = pack(MAX_WORDS, 999_999), MAX_SCORE = pack(1, 0);
/** Check a whole chain (for the server): every link valid, and the score matches */
export function validChain(date: string, words: unknown, score: number) {
  if (!Array.isArray(words) || words.length > MAX_WORDS) return false;
  const chain = [startFor(date)];
  for (const w of words) { const r = judge(chain, String(w)); if (!("ok" in r)) return false; chain.push(String(w).toLowerCase()); }
  return pack(words.length, words.join("").length) === score;
}
