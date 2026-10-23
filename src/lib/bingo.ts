// Coffee bingo: a 4×4 card of menu items, the same for everyone for a month.
// Order a square's item to stamp it; a full row, column or diagonal earns a treat. Pure, so tests share it.
import { seededRand } from "./gameOrders.ts";

export const BINGO_SIZE = 4;
export const BINGO_REWARD = 150; // ₹ of credit, once a month
const MAX_PER_CAT = 5;

export type BingoSquare = { id: string; name: string; cat: string };

/** Pick this month's card from the menu: shuffled by the month, at most five from any one section */
export function pickCard(pool: BingoSquare[], month: string): BingoSquare[] {
  const rand = seededRand(`bingo-${month}`);
  const list = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const per = new Map<string, number>();
  const out: BingoSquare[] = [];
  for (const m of list) {
    if (out.length === BINGO_SIZE * BINGO_SIZE) break;
    if ((per.get(m.cat) ?? 0) >= MAX_PER_CAT) continue;
    per.set(m.cat, (per.get(m.cat) ?? 0) + 1);
    out.push(m);
  }
  // A small menu: fill up without the per-section limit
  for (const m of list) if (out.length < BINGO_SIZE * BINGO_SIZE && !out.includes(m)) out.push(m);
  return out;
}

/** Every line on the card: 4 rows, 4 columns, 2 diagonals (as square numbers) */
export const BINGO_LINES: number[][] = (() => {
  const n = BINGO_SIZE, r = [...Array(n).keys()];
  return [...r.map((y) => r.map((x) => y * n + x)), ...r.map((x) => r.map((y) => y * n + x)), r.map((i) => i * n + i), r.map((i) => i * n + (n - 1 - i))];
})();

/** The lines you've finished */
export const doneLines = (stamped: boolean[]) => BINGO_LINES.filter((l) => l.every((i) => stamped[i]));
