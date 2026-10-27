// Café poker: Texas hold'em for chips (no money, ever), you against three café regulars. Two cards each, five shared
// cards, four rounds of betting. Handles all-ins and side pots. Pure, so the page and tests share it.
import { shuffled } from "./gameOrders.ts";

export type Card = { r: number; s: number }; // rank 2..14 (14 = ace), suit 0..3
export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";
export type Level = "easy" | "hard";
export const SMALL = 10, BIG = 20, START = 1000;
export const NAMES = ["You", "Leela", "Omar", "Rosa"];
export type Seat = { chips: number; cards: Card[]; bet: number; total: number; folded: boolean; allIn: boolean; out: boolean; acted: boolean; last: string };
export type Hand = {
  seats: Seat[]; deck: Card[]; board: Card[]; dealer: number; turn: number; street: Street;
  toMatch: number; minRaise: number; handNo: number; result: { winners: number[]; text: string; won: Record<number, number> } | null;
};

export const RANKS = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const SUIT = ["♠", "♥", "♦", "♣"];
const DECK: Card[] = [];
for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) DECK.push({ r, s });
export const cardName = (c: Card) => `${RANKS[c.r]}${SUIT[c.s]}`;

// ----- Hand ranking -----
export const CATEGORY = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];
/** Score five cards: a bigger number is a better hand */
function score5(cs: Card[]): number {
  const rs = cs.map((c) => c.r).sort((a, b) => b - a);
  const flush = cs.every((c) => c.s === cs[0].s);
  const uniq = [...new Set(rs)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (rs[0] - rs[4] === 4) straightHigh = rs[0];
    else if (rs[0] === 14 && rs[1] === 5) straightHigh = 5; // A-2-3-4-5
  }
  const counts = uniq.map((r) => [rs.filter((x) => x === r).length, r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const shape = counts.map((c) => c[0]).join("");
  let cat: number, kick: number[];
  if (straightHigh && flush) { cat = 8; kick = [straightHigh]; }
  else if (shape === "41") { cat = 7; kick = counts.map((c) => c[1]); }
  else if (shape === "32") { cat = 6; kick = counts.map((c) => c[1]); }
  else if (flush) { cat = 5; kick = rs; }
  else if (straightHigh) { cat = 4; kick = [straightHigh]; }
  else if (shape === "311") { cat = 3; kick = counts.map((c) => c[1]); }
  else if (shape === "221") { cat = 2; kick = counts.map((c) => c[1]); }
  else if (shape === "2111") { cat = 1; kick = counts.map((c) => c[1]); }
  else { cat = 0; kick = rs; }
  return kick.concat([0, 0, 0, 0, 0]).slice(0, 5).reduce((n, k) => n * 15 + k, cat);
}
/** The best five of up to seven cards */
export function bestOf(cards: Card[]): number {
  if (cards.length <= 5) return score5(cards);
  let best = 0;
  const pick = (from: number, chosen: Card[]) => {
    if (chosen.length === 5) { best = Math.max(best, score5(chosen)); return; }
    for (let i = from; i <= cards.length - (5 - chosen.length); i++) pick(i + 1, [...chosen, cards[i]]);
  };
  pick(0, []);
  return best;
}
export const categoryOf = (score: number) => CATEGORY[Math.floor(score / 15 ** 5)];

// ----- Playing a hand -----
const live = (h: Hand) => h.seats.map((s, i) => i).filter((i) => !h.seats[i].out && !h.seats[i].folded);
const nextSeat = (h: Hand, from: number, ok: (i: number) => boolean) => { for (let k = 1; k <= h.seats.length; k++) { const i = (from + k) % h.seats.length; if (ok(i)) return i; } return -1; };
const canAct = (h: Hand, i: number) => !h.seats[i].out && !h.seats[i].folded && !h.seats[i].allIn;

export function newTable(): Seat[] {
  return NAMES.map(() => ({ chips: START, cards: [], bet: 0, total: 0, folded: false, allIn: false, out: false, acted: false, last: "" }));
}
function putIn(s: Seat, amount: number) {
  const a = Math.min(amount, s.chips);
  s.chips -= a; s.bet += a; s.total += a;
  if (s.chips === 0) s.allIn = true;
}
/** Shuffle, post the blinds and deal two cards each. The button moves one seat left every hand. */
export function startHand(seats: Seat[], dealer: number, handNo: number, rand: () => number): Hand {
  const deck = shuffled(DECK, rand);
  const ss: Seat[] = seats.map((s) => ({ ...s, cards: [], bet: 0, total: 0, folded: false, allIn: false, out: s.chips <= 0, acted: false, last: "" }));
  const h: Hand = { seats: ss, deck, board: [], dealer, turn: 0, street: "preflop", toMatch: BIG, minRaise: BIG, handNo, result: null };
  for (const s of ss) if (!s.out) s.cards = [h.deck.pop()!, h.deck.pop()!];
  const inPlay = ss.map((_, i) => i).filter((i) => !ss[i].out);
  // Heads-up, the button posts the small blind
  const sb = inPlay.length === 2 ? dealer : nextSeat(h, dealer, (i) => !ss[i].out);
  const bb = nextSeat(h, sb, (i) => !ss[i].out);
  putIn(ss[sb], SMALL); ss[sb].last = "small blind";
  putIn(ss[bb], BIG); ss[bb].last = "big blind";
  h.turn = nextSeat(h, bb, (i) => canAct(h, i));
  if (h.turn < 0) return runOut(h);
  return h;
}
export const toCall = (h: Hand, i = h.turn) => Math.max(0, Math.min(h.toMatch - h.seats[i].bet, h.seats[i].chips));
export const pot = (h: Hand) => h.seats.reduce((n, s) => n + s.total, 0);

export type Action = { kind: "fold" } | { kind: "check" } | { kind: "call" } | { kind: "raise"; to: number };
/** Smallest and biggest "raise to" for the player whose turn it is */
export function raiseRange(h: Hand) {
  const s = h.seats[h.turn], most = s.bet + s.chips;
  return { min: Math.min(most, h.toMatch + h.minRaise), max: most };
}
export function act(h0: Hand, a: Action): Hand {
  const h: Hand = { ...h0, seats: h0.seats.map((s) => ({ ...s })), board: [...h0.board], deck: [...h0.deck] };
  const s = h.seats[h.turn];
  if (a.kind === "fold") { s.folded = true; s.last = "folds"; }
  else if (a.kind === "check" || (a.kind === "call" && toCall(h) === 0)) { s.last = "checks"; }
  else if (a.kind === "call") { const c = toCall(h); putIn(s, c); s.last = s.allIn ? `all in (${s.bet})` : `calls ${c}`; }
  else {
    const { min, max } = raiseRange(h), to = Math.max(min, Math.min(max, Math.round(a.to)));
    const raiseBy = to - h.toMatch;
    putIn(s, to - s.bet);
    if (s.bet > h.toMatch) {
      if (raiseBy >= h.minRaise) h.minRaise = raiseBy;
      h.toMatch = s.bet;
      for (const o of h.seats) if (o !== s) o.acted = false; // everyone gets to answer the raise
    }
    s.last = s.allIn ? `all in (${s.bet})` : h0.toMatch === 0 ? `bets ${s.bet}` : `raises to ${s.bet}`;
  }
  s.acted = true;
  return advance(h);
}

function advance(h: Hand): Hand {
  const stillIn = live(h);
  if (stillIn.length === 1) return award(h, [[stillIn[0]]]);
  const waiting = h.seats.map((_, i) => i).filter((i) => canAct(h, i) && (!h.seats[i].acted || h.seats[i].bet < h.toMatch));
  if (waiting.length) { h.turn = nextSeat(h, h.turn, (i) => waiting.includes(i)); return h; }
  // Betting round over: deal the next street (or run it out if at most one player can still bet)
  return nextStreet(h);
}
function nextStreet(h: Hand): Hand {
  for (const s of h.seats) { s.bet = 0; s.acted = false; }
  h.toMatch = 0; h.minRaise = BIG;
  if (h.street === "river") return showdown(h);
  const n = h.street === "preflop" ? 3 : 1;
  h.deck.pop(); // burn
  for (let k = 0; k < n; k++) h.board.push(h.deck.pop()!);
  h.street = h.street === "preflop" ? "flop" : h.street === "flop" ? "turn" : "river";
  for (const s of h.seats) if (!s.folded && !s.out && !s.allIn) s.last = "";
  const bettors = h.seats.map((_, i) => i).filter((i) => canAct(h, i));
  if (bettors.length <= 1) return runOut(h);
  h.turn = nextSeat(h, h.dealer, (i) => canAct(h, i));
  return h;
}
function runOut(h: Hand): Hand {
  // Deal whatever's left of the board (burning a card before each street, as at a real table)
  while (h.board.length < 5) { h.deck.pop(); const n = h.board.length === 0 ? 3 : 1; for (let k = 0; k < n; k++) h.board.push(h.deck.pop()!); }
  h.street = "river";
  return showdown(h);
}
function showdown(h: Hand): Hand {
  h.street = "showdown";
  const scores = h.seats.map((s) => (s.folded || s.out ? -1 : bestOf([...s.cards, ...h.board])));
  // Side pots: each level of what people put in is its own pot, for the players who reached it
  const levels = [...new Set(h.seats.filter((s) => s.total > 0).map((s) => s.total))].sort((a, b) => a - b);
  const winnersEach: number[][] = [], amounts: number[] = [];
  let prev = 0;
  for (const lv of levels) {
    const amount = h.seats.reduce((n, s) => n + Math.max(0, Math.min(s.total, lv) - prev), 0);
    const eligible = h.seats.map((_, i) => i).filter((i) => scores[i] >= 0 && h.seats[i].total >= lv);
    if (eligible.length) { const top = Math.max(...eligible.map((i) => scores[i])); winnersEach.push(eligible.filter((i) => scores[i] === top)); amounts.push(amount); }
    else if (winnersEach.length) amounts[amounts.length - 1] += amount; // nobody left to win it: goes to the last pot
    prev = lv;
  }
  return award(h, winnersEach, amounts, scores);
}
function award(h: Hand, winnersEach: number[][], amounts?: number[], scores?: number[]): Hand {
  const total = pot(h), won: Record<number, number> = {};
  const amts = amounts ?? [total];
  winnersEach.forEach((ws, k) => {
    const share = Math.floor(amts[k] / ws.length);
    let rem = amts[k] - share * ws.length;
    // Odd chips go to the first winner after the button
    const order = [...ws].sort((a, b) => ((a - h.dealer + 4) % 4) - ((b - h.dealer + 4) % 4));
    for (const w of order) { const extra = rem > 0 ? 1 : 0; rem -= extra; won[w] = (won[w] ?? 0) + share + extra; }
  });
  for (const [w, n] of Object.entries(won)) h.seats[+w].chips += n;
  const winners = Object.keys(won).map(Number);
  const how = scores && winners.length ? ` with ${categoryOf(scores[winners[0]]).toLowerCase()}` : "";
  const text = winners.length === 1 ? `${NAMES[winners[0]]} win${winners[0] === 0 ? "" : "s"} ${won[winners[0]]}${how}` : `${winners.map((w) => NAMES[w]).join(" and ")} split the pot${how}`;
  for (const s of h.seats) s.bet = 0;
  h.street = "showdown"; h.result = { winners, text, won };
  return h;
}

// ----- The computer -----
/** Rough chance of winning against `opponents` random hands, by playing the rest out `sims` times */
export function equity(cards: Card[], board: Card[], opponents: number, rand: () => number, sims = 160): number {
  const known = new Set([...cards, ...board].map((c) => c.r * 4 + c.s));
  const rest = DECK.filter((c) => !known.has(c.r * 4 + c.s));
  let wins = 0;
  for (let k = 0; k < sims; k++) {
    const d = shuffled(rest, rand);
    let at = 0;
    const b = [...board]; while (b.length < 5) b.push(d[at++]);
    const mine = bestOf([...cards, ...b]);
    let best = 0, ties = 0;
    for (let o = 0; o < opponents; o++) { const sc = bestOf([d[at++], d[at++], ...b]); if (sc > best) { best = sc; ties = 0; } if (sc === best) ties++; }
    if (mine > best) wins++; else if (mine === best) wins += 1 / (ties + 1);
  }
  return wins / sims;
}
export function computerAction(h: Hand, level: Level, rand: () => number): Action {
  const me = h.seats[h.turn], owe = toCall(h), p = pot(h);
  const opponents = live(h).length - 1;
  const eq = equity(me.cards, h.board, Math.max(1, opponents), rand, level === "hard" ? 200 : 60);
  const odds = owe / (p + owe || 1);
  const { min, max } = raiseRange(h);
  const wobble = (rand() - 0.5) * (level === "hard" ? 0.08 : 0.25);
  const e = eq + wobble;
  const strong = level === "hard" ? 0.62 : 0.72;
  // A rare bluff keeps it honest
  if (owe === 0 && rand() < (level === "hard" ? 0.08 : 0.03) && max > min) return { kind: "raise", to: Math.min(max, Math.max(min, h.toMatch + Math.round(p * 0.5))) };
  if (e > strong && max > h.toMatch) {
    const size = e > 0.8 ? p : Math.round(p * 0.6);
    return { kind: "raise", to: Math.min(max, Math.max(min, h.toMatch + size)) };
  }
  if (owe === 0) return { kind: "check" };
  if (e > odds + (level === "hard" ? 0.04 : 0)) return { kind: "call" };
  return { kind: "fold" };
}
