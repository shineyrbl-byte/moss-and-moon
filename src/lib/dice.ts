// Café dice: roll five dice up to three times a turn and fill one row of the score card each turn. Pure, so the page and tests share it.
export const CATS = [
  { id: "ones", name: "Ones", how: "Add up the 1s", upper: true },
  { id: "twos", name: "Twos", how: "Add up the 2s", upper: true },
  { id: "threes", name: "Threes", how: "Add up the 3s", upper: true },
  { id: "fours", name: "Fours", how: "Add up the 4s", upper: true },
  { id: "fives", name: "Fives", how: "Add up the 5s", upper: true },
  { id: "sixes", name: "Sixes", how: "Add up the 6s", upper: true },
  { id: "three", name: "Three of a kind", how: "Three the same: add up all five", upper: false },
  { id: "four", name: "Four of a kind", how: "Four the same: add up all five", upper: false },
  { id: "full", name: "Full house", how: "Three of one and two of another: 25", upper: false },
  { id: "small", name: "Short run", how: "Four in a row: 30", upper: false },
  { id: "large", name: "Long run", how: "Five in a row: 40", upper: false },
  { id: "five", name: "Five of a kind", how: "All five the same: 50", upper: false },
  { id: "chance", name: "Chance", how: "Anything: add up all five", upper: false },
] as const;
export type Cat = (typeof CATS)[number]["id"];
export const ROLLS = 3;
export const BONUS_AT = 63, BONUS = 35, EXTRA_FIVE = 100;
// Best possible: every row maxed (375 + bonus 35) plus twelve extra five-of-a-kinds
export const DICE_MAX = 1575;

const counts = (d: number[]) => [1, 2, 3, 4, 5, 6].map((f) => d.filter((x) => x === f).length);
const sum = (d: number[]) => d.reduce((a, b) => a + b, 0);
const run = (d: number[], n: number) => {
  const has = new Set(d);
  return [1, 2, 3].some((s) => [...Array(n).keys()].every((k) => has.has(s + k)));
};
export const isFive = (d: number[]) => d.length === 5 && d.every((x) => x === d[0]);

export function scoreFor(cat: Cat, d: number[]): number {
  const n = counts(d);
  switch (cat) {
    case "ones": return n[0];
    case "twos": return n[1] * 2;
    case "threes": return n[2] * 3;
    case "fours": return n[3] * 4;
    case "fives": return n[4] * 5;
    case "sixes": return n[5] * 6;
    case "three": return n.some((x) => x >= 3) ? sum(d) : 0;
    case "four": return n.some((x) => x >= 4) ? sum(d) : 0;
    case "full": return n.includes(3) && n.includes(2) ? 25 : 0;
    case "small": return run(d, 4) ? 30 : 0;
    case "large": return run(d, 5) ? 40 : 0;
    case "five": return isFive(d) ? 50 : 0;
    case "chance": return sum(d);
  }
}

export type Card = Partial<Record<Cat, number>>;
export const upperTotal = (card: Card) => CATS.filter((c) => c.upper).reduce((s, c) => s + (card[c.id] ?? 0), 0);
export const bonusFor = (card: Card) => (upperTotal(card) >= BONUS_AT ? BONUS : 0);
/** Score this row. Another five of a kind after scoring 50 in that row earns an extra 100. */
export function fillRow(card: Card, extras: number, cat: Cat, d: number[]): { card: Card; extras: number } | null {
  if (card[cat] !== undefined || d.length !== 5) return null;
  const more = isFive(d) && card.five === 50 ? 1 : 0;
  return { card: { ...card, [cat]: scoreFor(cat, d) }, extras: extras + more };
}
export const total = (card: Card, extras: number) => CATS.reduce((s, c) => s + (card[c.id] ?? 0), 0) + bonusFor(card) + extras * EXTRA_FIVE;
export const finished = (card: Card) => CATS.every((c) => card[c.id] !== undefined);

/** Roll the dice that aren't held */
export const roll = (d: number[], held: boolean[], rand = Math.random) => d.map((x, i) => (held[i] && x ? x : 1 + Math.floor(rand() * 6)));
