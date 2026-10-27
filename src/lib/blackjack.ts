// Café blackjack for chips (never money). Get closer to 21 than the dealer without going over. Blackjack pays 3 to 2,
// the dealer draws to 16 and stands on all 17s, and you can double down on your first two cards. Six decks. Pure.
import { shuffled } from "./gameOrders.ts";

export type Card = { r: number; s: number }; // r 1..13 (1 = ace), s 0..3
export const START = 1000, BETS = [10, 25, 50, 100];
export type Phase = "bet" | "play" | "done";
export type State = { shoe: Card[]; chips: number; bet: number; you: Card[]; dealer: Card[]; phase: Phase; doubled: boolean; result: string; won: number };

export function newShoe(rand: () => number): Card[] {
  const one: Card[] = []; for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) one.push({ r, s });
  return shuffled([...Array(6).keys()].flatMap(() => one), rand);
}
export const newTable = (rand: () => number): State => ({ shoe: newShoe(rand), chips: START, bet: 0, you: [], dealer: [], phase: "bet", doubled: false, result: "", won: 0 });
/** Best total (aces count 11 when they can) and whether it's soft */
export function total(h: Card[]) {
  let t = 0, aces = 0;
  for (const c of h) { t += Math.min(10, c.r); if (c.r === 1) aces++; }
  const soft = aces > 0 && t + 10 <= 21;
  return { t: soft ? t + 10 : t, soft };
}
export const isBlackjack = (h: Card[]) => h.length === 2 && total(h).t === 21;
const take = (s: State, rand: () => number): [Card, Card[]] => { let shoe = s.shoe; if (shoe.length < 78) shoe = newShoe(rand); return [shoe[0], shoe.slice(1)]; };
export function deal(s0: State, bet: number, rand: () => number): State {
  if (s0.phase === "play" || bet <= 0 || bet > s0.chips) return s0;
  let s: State = { ...s0, bet, chips: s0.chips - bet, you: [], dealer: [], phase: "play", doubled: false, result: "", won: 0 };
  for (const who of ["you", "dealer", "you", "dealer"] as const) { const [c, shoe] = take(s, rand); s = { ...s, shoe, [who]: [...s[who], c] }; }
  if (isBlackjack(s.you) || isBlackjack(s.dealer)) return settle(s);
  return s;
}
export function hit(s0: State, rand: () => number): State {
  if (s0.phase !== "play") return s0;
  const [c, shoe] = take(s0, rand);
  const s = { ...s0, shoe, you: [...s0.you, c] };
  return total(s.you).t > 21 ? settle(s) : s;
}
export function stand(s0: State, rand: () => number): State {
  if (s0.phase !== "play") return s0;
  let s = s0;
  while (total(s.dealer).t < 17) { const [c, shoe] = take(s, rand); s = { ...s, shoe, dealer: [...s.dealer, c] }; }
  return settle(s);
}
export function double(s0: State, rand: () => number): State {
  if (s0.phase !== "play" || s0.you.length !== 2 || s0.chips < s0.bet) return s0;
  const s = hit({ ...s0, chips: s0.chips - s0.bet, bet: s0.bet * 2, doubled: true }, rand);
  return s.phase === "done" ? s : stand(s, rand);
}
function settle(s: State): State {
  const y = total(s.you).t, d = total(s.dealer).t, yb = isBlackjack(s.you), db = isBlackjack(s.dealer);
  let back = 0, result: string;
  if (yb && db) { back = s.bet; result = "Both blackjack: a push."; }
  else if (yb) { back = s.bet + Math.floor(s.bet * 1.5); result = "Blackjack! Paid 3 to 2."; }
  else if (db) result = "The dealer has blackjack.";
  else if (y > 21) result = `Bust with ${y}.`;
  else if (d > 21) { back = s.bet * 2; result = `The dealer busts with ${d}. You win!`; }
  else if (y > d) { back = s.bet * 2; result = `Your ${y} beats the dealer's ${d}. You win!`; }
  else if (y === d) { back = s.bet; result = `${y} each: a push, so your bet comes back.`; }
  else result = `The dealer's ${d} beats your ${y}.`;
  return { ...s, chips: s.chips + back, phase: "done", result, won: back - s.bet };
}
