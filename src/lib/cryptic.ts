// Cryptic clue of the day: one clue, a definition plus wordplay. The bank goes round in a fixed shuffled order, so a clue
// doesn't come back for two months. Pure, so the page and tests share it.
import { seededRand, shuffled } from "./gameOrders.ts";
import { CRYPTICS, type Cryptic } from "./data/cryptic.ts";

export const minMs = 3000;
export const HINT_MS = 20000;
const dayOf = (date: string) => Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86400_000);
const ORDER = shuffled([...CRYPTICS.keys()], seededRand("cryptic-order"));
export function crypticFor(date: string): Cryptic & { n: number } {
  const c = CRYPTICS[ORDER[((dayOf(date) % ORDER.length) + ORDER.length) % ORDER.length]];
  return { ...c, n: c.a.length };
}
/** The clue as printed, with its letter count */
export const printed = (c: Cryptic) => `${c.clue} (${c.a.length})`;
export const KIND_NAME: Record<Cryptic["kind"], string> = { anagram: "an anagram", hidden: "a hidden word", double: "a double definition", charade: "two parts joined up", deletion: "a word with a bit taken off", homophone: "a sound-alike" };
export const isRight = (guess: string, c: Cryptic) => guess.toLowerCase().replace(/[^a-z]/g, "") === c.a;
