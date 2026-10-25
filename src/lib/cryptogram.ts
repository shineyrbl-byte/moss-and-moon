// Café cryptogram: a café saying with every letter swapped for another. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

// Written for the café, so they're ours to use
export const SAYINGS = [
  "Life is too short for cold coffee and long queues.",
  "The best seat in the house is by the window when it rains.",
  "Every great idea started with a second cup.",
  "Never trust a muffin that has been sitting alone too long.",
  "Slow mornings make the sweetest days.",
  "Grind the beans, not yourself.",
  "Pour slowly, sip slowly, live slowly.",
  "Somewhere a croissant is waiting just for you.",
  "Talk less, steep more.",
  "A full mug and an empty inbox make a perfect morning.",
  "Friends are the sugar in the strongest brew.",
  "The moon rises, the milk froths, the day softens.",
  "Monsoon rain sounds better with hot chai in hand.",
  "Cake for breakfast is just a very early dessert.",
  "Strong coffee, soft music, kind people.",
  "Every spilled cup is a chance to order another.",
  "Leave room for dessert and room for surprises.",
  "Moss grows quietly, and so does a good friendship.",
  "A warm cup can fix most things and soften the rest.",
  "The kettle knows you need a break before you do.",
  "Some stories are best told over a pot of tea.",
  "Sunday plans: one book, two coffees, zero alarms.",
  "Bitter beans can still make a sweet morning.",
  "Save the last slice for someone who needs it.",
];
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const minMs = 15000;
export const HINT_MS = 10000;

const dayOf = (date: string) => Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86400_000);

/** A shuffled alphabet where no letter stands for itself */
export function makeKey(rand: () => number): Record<string, string> {
  for (;;) {
    const a = [...ALPHABET];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.every((c, i) => c !== ALPHABET[i])) return Object.fromEntries([...ALPHABET].map((c, i) => [c, a[i]]));
  }
}
export const encode = (text: string, key: Record<string, string>) => [...text.toUpperCase()].map((c) => key[c] ?? c).join("");

/** Sayings go round in a fixed order so none comes back for 24 days */
export function cipherFor(date: string) {
  const order = [...SAYINGS.keys()];
  const r = seededRand("cipher-order");
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return puzzle(SAYINGS[order[dayOf(date) % SAYINGS.length]], date);
}

export function puzzle(saying: string, seed: string) {
  const rand = seededRand(`cipher:${seed}`);
  const key = makeKey(rand);
  const plain = saying.toUpperCase();
  const code = encode(plain, key);
  // One letter is given to start you off: a fairly common one, but not the most common
  const counts = new Map<string, number>();
  for (const c of plain) if (key[c]) counts.set(c, (counts.get(c) ?? 0) + 1);
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  const given = ranked[Math.min(ranked.length - 1, 1 + Math.floor(rand() * 3))];
  return { text: saying, plain, code, key, given: { [key[given]]: given } as Record<string, string> };
}
export type Cipher = ReturnType<typeof puzzle>;

/** The code letters that appear in the puzzle */
export const codeLetters = (p: Cipher) => [...new Set([...p.code].filter((c) => ALPHABET.includes(c)))];

/** Put a guess on a code letter. A plain letter can only stand for one code letter, so it moves. */
export function guess(guesses: Record<string, string>, code: string, plain: string | null, locked: Record<string, string> = {}) {
  if (locked[code] || (plain && Object.values(locked).includes(plain))) return guesses;
  const next = { ...guesses };
  if (plain) for (const k of Object.keys(next)) if (next[k] === plain) delete next[k];
  if (plain) next[code] = plain; else delete next[code];
  return next;
}
export const isFilled = (p: Cipher, g: Record<string, string>) => codeLetters(p).every((c) => g[c]);
export const isSolved = (p: Cipher, g: Record<string, string>) => [...p.plain].every((c) => !p.key[c] || g[p.key[c]] === c);
/** A code letter that's still empty or wrong, to give away as a hint */
export function hintLetter(p: Cipher, g: Record<string, string>, prefer?: string | null) {
  const wrong = codeLetters(p).filter((c) => g[c] !== decode(p, c));
  if (prefer && wrong.includes(prefer)) return prefer;
  return wrong[0] ?? null;
}
export const decode = (p: Cipher, code: string) => Object.keys(p.key).find((k) => p.key[k] === code)!;
