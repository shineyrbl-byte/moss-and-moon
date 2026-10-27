// Two quick solitaires with one rule: play a card one higher or lower than the top of the pile (any suit).
// Golf: seven columns of five, take from the bottoms; kings stop (nothing goes on a king), and no wrapping round.
// TriPeaks: three peaks of cards; a card is free once nothing covers it, and aces and kings wrap round. Pure.
import { shuffled } from "./gameOrders.ts";

export type Card = { r: number; s: number }; // r 1..13, s 0..3
export const deck = (): Card[] => { const d: Card[] = []; for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s }); return d; };
export const fits = (a: Card, b: Card, wrap: boolean) => { const d = Math.abs(a.r - b.r); return d === 1 || (wrap && d === 12); };

// ----- Golf -----
export type Golf = { cols: Card[][]; stock: Card[]; pile: Card[]; moves: number };
export function newGolf(rand: () => number): Golf {
  const d = shuffled(deck(), rand);
  return { cols: [...Array(7).keys()].map((k) => d.slice(k * 5, k * 5 + 5)), stock: d.slice(36), pile: [d[35]], moves: 0 };
}
export function golfPlay(g: Golf, col: number): Golf | null {
  const c = g.cols[col][g.cols[col].length - 1], top = g.pile[g.pile.length - 1];
  if (!c || top.r === 13 || !fits(c, top, false)) return null;
  return { ...g, cols: g.cols.map((x, k) => (k === col ? x.slice(0, -1) : x)), pile: [...g.pile, c], moves: g.moves + 1 };
}
export const golfDraw = (g: Golf): Golf | null => (g.stock.length ? { ...g, stock: g.stock.slice(1), pile: [...g.pile, g.stock[0]], moves: g.moves + 1 } : null);
export const golfLeft = (g: Golf) => g.cols.reduce((n, c) => n + c.length, 0);
export const golfStuck = (g: Golf) => !g.stock.length && g.cols.every((_, k) => !golfPlay(g, k));

// ----- TriPeaks -----
// 28 cards: rows of 3, 6, 9 and 10. Each card in rows 0–2 is covered by two in the row below.
export const ROWS = [3, 6, 9, 10];
const rowStart = [0, 3, 9, 18];
/** The two cards (by index) covering card i, if any */
export function coveredBy(i: number): number[] {
  if (i >= 18) return [];
  if (i < 3) return [3 + i * 2, 4 + i * 2];
  if (i < 9) { const k = i - 3, peak = Math.floor(k / 2); return [9 + k + peak, 10 + k + peak]; }
  const k = i - 9; return [18 + k, 19 + k];
}
export type Peaks = { cards: (Card | null)[]; stock: Card[]; pile: Card[]; streak: number; score: number };
export function newPeaks(rand: () => number): Peaks {
  const d = shuffled(deck(), rand);
  return { cards: d.slice(0, 28), stock: d.slice(29), pile: [d[28]], streak: 0, score: 0 };
}
export const isFree = (p: Peaks, i: number) => !!p.cards[i] && coveredBy(i).every((j) => !p.cards[j]);
export function peaksPlay(p: Peaks, i: number): Peaks | null {
  const c = p.cards[i];
  if (!c || !isFree(p, i) || !fits(c, p.pile[p.pile.length - 1], true)) return null;
  const cards = p.cards.map((x, k) => (k === i ? null : x)), streak = p.streak + 1;
  // A run of plays without drawing scores more and more; clearing a peak's top card is a bonus
  const peakBonus = i < 3 ? 150 : 0;
  return { ...p, cards, pile: [...p.pile, c], streak, score: p.score + streak * 10 + peakBonus + (cards.every((x) => !x) ? 500 : 0) };
}
export const peaksDraw = (p: Peaks): Peaks | null => (p.stock.length ? { ...p, stock: p.stock.slice(1), pile: [...p.pile, p.stock[0]], streak: 0 } : null);
export const peaksLeft = (p: Peaks) => p.cards.filter(Boolean).length;
export const peaksStuck = (p: Peaks) => !p.stock.length && p.cards.every((_, i) => !peaksPlay(p, i));
export { rowStart };
