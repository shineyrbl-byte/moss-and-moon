// Bean jumble: five scrambled café words a day, each a letter longer. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

// Hand-picked so none of them is an everyday anagram of another word (no lemon/melon), so there's one answer
export const WORDS: Record<number, string[]> = {
  5: ["latte", "mocha", "cocoa", "honey", "berry", "wafer", "fudge", "cumin", "guava", "pecan", "syrup", "kulfi", "jelly", "candy", "dough", "cream", "sugar", "apple", "crust", "flour"],
  6: ["coffee", "muffin", "pastry", "cookie", "cherry", "butter", "waffle", "ginger", "nutmeg", "almond", "cashew", "toffee", "pepper", "banana", "cheese", "walnut", "teapot", "brunch", "yogurt", "pickle"],
  7: ["barista", "vanilla", "saffron", "pudding", "biscuit", "caramel", "cupcake", "pancake", "granola", "cheddar", "brownie", "crumble", "oatmeal", "pretzel", "sherbet", "coconut", "mustard", "lasagna", "jasmine", "truffle"],
  8: ["cinnamon", "espresso", "cardamom", "doughnut", "meringue", "porridge", "marzipan", "lemonade", "flapjack", "teaspoon", "sandwich", "focaccia", "smoothie", "biscotti", "kombucha", "macaroon", "turmeric", "tiramisu", "dumpling", "pancetta"],
  9: ["chocolate", "macchiato", "milkshake", "pistachio", "blueberry", "raspberry", "croissant", "americano", "sourdough", "breakfast", "marmalade", "shortcake", "pineapple", "cafetiere", "cranberry", "cornflake", "honeycomb", "sugarcane", "flatbread", "panettone"],
};
export const LENGTHS = [5, 6, 7, 8, 9];
export const SKIP_MS = 20000;
export const minMs = 8000;

const shuffle = <T,>(a: T[], rand: () => number) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const dayOf = (date: string) => Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86400_000);

/** Mix the letters so it never reads the same and never starts the way the word does */
export function scramble(word: string, rand: () => number) {
  for (let t = 0; t < 50; t++) {
    const s = shuffle([...word], rand).join("");
    if (s !== word && s.slice(0, 2) !== word.slice(0, 2)) return s;
  }
  return [...word].reverse().join("");
}
/** Each length's list goes round in its own fixed order, so no word comes back for 20 days */
export function jumbleFor(date: string) {
  const day = dayOf(date);
  return LENGTHS.map((n) => {
    const order = shuffle(WORDS[n], seededRand(`jumble-order:${n}`));
    const word = order[day % order.length];
    return { word, letters: scramble(word, seededRand(`jumble:${date}:${n}`)) };
  });
}
export const isAnswer = (guess: string, word: string) => guess.trim().toLowerCase() === word;
