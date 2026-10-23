// The daily café word: guess a five-letter word in six tries. Pure, so the server and tests share it.
// The server picks the word and checks guesses; the page never sees the answer until you're done.
import { seededRand } from "./gameOrders.ts";

export const TRIES = 6;
export const ANSWERS = [
  "latte", "crema", "mocha", "beans", "roast", "brews", "foamy", "grind", "sugar", "cream",
  "scone", "toast", "honey", "mango", "beach", "palms", "kokum", "spice", "clove", "lemon",
  "minty", "steam", "press", "drips", "blend", "sweet", "syrup", "bagel", "donut", "cacao",
  "cocoa", "moons", "stars", "mossy", "plant", "leafy", "sandy", "waves", "shell", "tides",
  "sunny", "chill", "bread", "crumb", "flaky", "tulip", "heart", "cuppa", "icing", "pecan",
  "guava", "prawn", "curry", "milky", "froth", "berry", "peach", "apple", "melon", "basil",
  "thyme", "cumin", "dough", "crust", "salty", "spoon", "light", "night", "dream", "cloud",
  "rainy", "ocean", "coral", "shore", "ferry", "relax", "books", "chips", "nutty", "maple",
];

/** Today's word: the list shuffled once by a fixed seed, then one a day in turn */
export function wordFor(date: string) {
  const rand = seededRand("moss-moon-word");
  const order = [...ANSWERS];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400_000);
  return order[((day % order.length) + order.length) % order.length];
}

export type Mark = "g" | "y" | "b"; // right place, in the word, not in it
/** Colour a guess the usual way: greens first, then yellows only for letters not used up */
export function score(guess: string, answer: string): Mark[] {
  const out: Mark[] = Array(5).fill("b");
  const left = new Map<string, number>();
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) out[i] = "g";
    else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < 5; i++) {
    if (out[i] === "g") continue;
    const n = left.get(guess[i]) ?? 0;
    if (n > 0) { out[i] = "y"; left.set(guess[i], n - 1); }
  }
  return out;
}

/** The share text: squares only, no letters */
export const shareGrid = (marks: Mark[][]) => marks.map((r) => r.map((m) => (m === "g" ? "🟩" : m === "y" ? "🟨" : "⬜")).join("")).join("\n");
