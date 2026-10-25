// Crack the order: guess the barista's secret order of four drinks (Mastermind). Pure, so the page, server and tests share it.
export const DRINKS = ["☕", "🍵", "🧋", "🥤", "🧃", "🥛"];
export const DRINK_NAMES = ["coffee", "tea", "bubble tea", "smoothie", "juice", "milk"];
export const CODE_LEN = 4, CRACK_TRIES = 8;

/** right = right drink in the right spot; near = right drink, wrong spot */
export function feedback(code: number[], guess: number[]) {
  let right = 0;
  const left: number[] = [], rest: number[] = [];
  code.forEach((c, i) => (c === guess[i] ? right++ : (left.push(c), rest.push(guess[i]))));
  let near = 0;
  for (const g of rest) { const k = left.indexOf(g); if (k >= 0) { near++; left.splice(k, 1); } }
  return { right, near };
}
export const validGuess = (g: unknown): g is number[] => Array.isArray(g) && g.length === CODE_LEN && g.every((x) => Number.isInteger(x) && x >= 0 && x < DRINKS.length);
/** Share text: one row per guess, no drinks shown */
export const crackGrid = (marks: { right: number; near: number }[]) =>
  marks.map((m) => "✅".repeat(m.right) + "🔄".repeat(m.near) + "▫️".repeat(CODE_LEN - m.right - m.near)).join("\n");
