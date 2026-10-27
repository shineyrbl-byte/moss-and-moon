// Word ladder: change one letter at a time to turn one word into another. Pure, so the page and tests share it.
import { rotationPick } from "./gameOrders.ts";
import { COMMON4, MORE4 } from "./data/words4.ts";

export const minMs = 5000;
export const LADDERS: [string, string][] = [
  ["cold", "warm"], ["bean", "malt"], ["cake", "sand"], ["bowl", "soup"], ["milk", "moon"], ["moss", "rest"], ["lime", "rice"], ["cafe", "rice"],
  ["dosa", "rice"], ["soup", "stir"], ["pour", "stir"], ["heat", "moon"], ["leaf", "moon"], ["cold", "mint"], ["cool", "moon"], ["bake", "tart"],
  ["fish", "rice"], ["corn", "foam"], ["brew", "chip"], ["bean", "cool"], ["cafe", "fish"], ["cake", "milk"], ["cool", "soup"], ["moss", "sofa"],
  ["rain", "soup"], ["tart", "warm"], ["mint", "sage"], ["bean", "milk"], ["cold", "rice"], ["heat", "soup"],
];
const COMMON = new Set(COMMON4), ALL = new Set([...COMMON4, ...MORE4]);
export const isWord = (w: string) => ALL.has(w);
/** Exactly one letter different */
export const oneApart = (a: string, b: string) => a.length === b.length && [...a].filter((c, i) => c !== b[i]).length === 1;

/** Fewest steps between two words using everyday words only (null if there's no way) */
export function shortest(a: string, b: string): string[] | null {
  const prev = new Map<string, string | null>([[a, null]]), queue = [a];
  for (let i = 0; i < queue.length; i++) {
    const w = queue[i];
    if (w === b) { const path = [w]; let p = prev.get(w); while (p) { path.unshift(p); p = prev.get(p); } return path; }
    for (let k = 0; k < 4; k++) for (let c = 97; c <= 122; c++) {
      const x = w.slice(0, k) + String.fromCharCode(c) + w.slice(k + 1);
      if (x !== w && COMMON.has(x) && !prev.has(x)) { prev.set(x, w); queue.push(x); }
    }
  }
  return null;
}
/** Today's ladder and its par (the fewest steps we know) */
export function ladderFor(date: string) {
  const [from, to] = rotationPick(LADDERS, "ladder", date);
  return { from, to, par: shortest(from, to)!.length - 1 };
}
/** Why a next word isn't allowed, or null if it's fine */
export function stepProblem(prev: string, next: string, used: string[]) {
  if (!/^[a-z]{4}$/.test(next)) return "Four letters, please.";
  if (!oneApart(prev, next)) return "Change exactly one letter.";
  if (used.includes(next)) return "You've used that word already.";
  if (!isWord(next)) return "That's not in our word list.";
  return null;
}
