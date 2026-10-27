// Price order: put five things from the menu in order, cheapest first. After each go you see which places are right.
// Five goes. The five are picked from the live menu by the date, so everyone gets the same ones. Pure.
import { seededRand, shuffled } from "./gameOrders.ts";

export const PICK = 5, TRIES = 5;
export const minMs = 4000;
export type PItem = { id: string; name: string; price: number; img: string };

/** Today's five: different prices, so there's only one right order. Null if the menu can't make five. */
export function priceFor(date: string, menu: PItem[]): PItem[] | null {
  const rand = seededRand(`priceorder:${date}`);
  const out: PItem[] = [];
  for (const it of shuffled([...menu].sort((a, b) => a.id.localeCompare(b.id)), rand)) {
    if (out.some((o) => o.price === it.price)) continue;
    out.push(it);
    if (out.length === PICK) break;
  }
  return out.length === PICK ? out : null;
}
/** Which places in your order are right */
export function marks(items: PItem[], order: string[]) {
  const right = [...items].sort((a, b) => a.price - b.price).map((x) => x.id);
  return order.map((id, k) => id === right[k]);
}
export const isRight = (items: PItem[], order: string[]) => marks(items, order).every(Boolean);
/** The board: fewest goes first, then time */
export const pack = (tries: number, ms: number) => tries * 1_000_000 + Math.min(999_999, Math.max(0, Math.round(ms)));
export const MIN_SCORE = pack(1, minMs), MAX_SCORE = pack(TRIES, 999_999);
