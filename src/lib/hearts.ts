import { shuffled } from "./gameOrders.ts";
// Café hearts: the card game Hearts for four (you and three computer players). Each hand, pass three cards, then play
// thirteen tricks. Every heart you take costs a point and the queen of spades costs 13, unless you take all 26 ("shoot
// the moon"), when everyone else gets 26 instead. First to 100 ends the game; lowest score wins. Pure, so the page and
// tests share it.
export const SUITS = ["♣", "♦", "♠", "♥"] as const; // clubs, diamonds, spades, hearts
export const RANKS = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const CLUBS = 0, DIAMONDS = 1, SPADES = 2, HEARTS = 3;
export const END_AT = 100;
export type Card = { suit: number; rank: number }; // rank 2..14
export type Level = "easy" | "hard";
export type Hand = {
  hands: Card[][]; // 0 is you, then round the table to your left
  trick: { p: number; c: Card }[]; leader: number; turn: number;
  taken: Card[][]; broken: boolean; tricks: number;
};
export const PLAYERS = ["You", "Leela", "Omar", "Rosa"];
export const NAMES_PASS = ["left", "right", "across", "none"] as const;

export const same = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank;
export const points = (c: Card) => (c.suit === HEARTS ? 1 : c.suit === SPADES && c.rank === 12 ? 13 : 0);
export const isQueen = (c: Card) => c.suit === SPADES && c.rank === 12;
export const sortHand = (h: Card[]) => [...h].sort((a, b) => (a.suit - b.suit) * 20 + (a.rank - b.rank));
export const label = (c: Card) => `${RANKS[c.rank]}${SUITS[c.suit]}`;

export function dealHands(rand: () => number): Card[][] {
  const deck: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ suit: s, rank: r });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return [0, 1, 2, 3].map((p) => sortHand(deck.slice(p * 13, p * 13 + 13)));
}
/** Who you pass to on hand number n (0-based): left, right, across, then a hand with no passing */
export const passTo = (n: number, p: number) => [(p + 1) % 4, (p + 3) % 4, (p + 2) % 4, p][n % 4];

/** Swap the passed cards (picks[p] is the three cards player p passes) */
export function doPass(hands: Card[][], picks: Card[][], n: number): Card[][] {
  if (n % 4 === 3) return hands;
  const out = hands.map((h, p) => h.filter((c) => !picks[p].some((x) => same(x, c))));
  picks.forEach((cs, p) => out[passTo(n, p)].push(...cs));
  return out.map(sortHand);
}
export function startHand(hands: Card[][]): Hand {
  const leader = hands.findIndex((h) => h.some((c) => c.suit === CLUBS && c.rank === 2));
  return { hands, trick: [], leader, turn: leader, taken: [[], [], [], []], broken: false, tricks: 0 };
}

/** The cards player p is allowed to play right now */
export function legal(h: Hand, p: number): Card[] {
  const mine = h.hands[p];
  if (!h.trick.length) {
    if (h.tricks === 0) return mine.filter((c) => c.suit === CLUBS && c.rank === 2);
    const ok = mine.filter((c) => c.suit !== HEARTS || h.broken);
    return ok.length ? ok : mine;
  }
  const lead = h.trick[0].c.suit, follow = mine.filter((c) => c.suit === lead);
  if (follow.length) return follow;
  // Nothing to follow with: anything, except points on the very first trick if you can help it
  if (h.tricks === 0) { const clean = mine.filter((c) => !points(c)); if (clean.length) return clean; }
  return mine;
}
const winnerOf = (trick: { p: number; c: Card }[]) => {
  const lead = trick[0].c.suit;
  return trick.filter((t) => t.c.suit === lead).sort((a, b) => b.c.rank - a.c.rank)[0].p;
};
/** Play a card. When the trick is full, whoever won it takes it and leads next. */
export function playCard(h: Hand, p: number, c: Card): Hand {
  if (p !== h.turn || !legal(h, p).some((x) => same(x, c))) throw new Error("Not a legal card");
  const hands = h.hands.map((x, i) => (i === p ? x.filter((y) => !same(y, c)) : x));
  const trick = [...h.trick, { p, c }];
  const broken = h.broken || c.suit === HEARTS || isQueen(c);
  if (trick.length < 4) return { ...h, hands, trick, turn: (p + 1) % 4, broken };
  const w = winnerOf(trick);
  const taken = h.taken.map((x, i) => (i === w ? [...x, ...trick.map((t) => t.c)] : x));
  return { hands, trick: [], leader: w, turn: w, taken, broken, tricks: h.tricks + 1 };
}
export const lastWinner = (trick: { p: number; c: Card }[]) => winnerOf(trick);
export const handOver = (h: Hand) => h.tricks === 13;
/** Points from a finished hand, with shooting the moon */
export function handScores(h: Hand): number[] {
  const pts = h.taken.map((cs) => cs.reduce((s, c) => s + points(c), 0));
  const moon = pts.findIndex((x) => x === 26);
  return moon >= 0 ? pts.map((_, i) => (i === moon ? 0 : 26)) : pts;
}
export const gameOver = (totals: number[]) => totals.some((t) => t >= END_AT);
/** Everyone tied for the lowest total */
export const leaders = (totals: number[]) => totals.flatMap((t, i) => (t === Math.min(...totals) ? [i] : []));

/** Three cards for the computer to pass: the dangerous high spades and hearts, then its highest cards */
export function choosePass(hand: Card[], level: Level, rand: () => number = Math.random): Card[] {
  if (level === "easy") return shuffled(hand, rand).slice(0, 3);
  const danger = (c: Card) => (isQueen(c) ? 100 : c.suit === SPADES && c.rank > 12 ? 90 + c.rank : c.suit === HEARTS ? 40 + c.rank : c.rank);
  // Keep low spades if it holds the queen's guards
  return [...hand].sort((a, b) => danger(b) - danger(a)).slice(0, 3);
}

/** The computer's card */
export function chooseCard(h: Hand, p: number, level: Level, rand: () => number = Math.random): Card {
  const opts = legal(h, p);
  if (opts.length === 1) return opts[0];
  if (level === "easy") {
    // Mostly plays low, with a few slips
    if (rand() < 0.3) return opts[Math.floor(rand() * opts.length)];
    return [...opts].sort((a, b) => a.rank - b.rank)[0];
  }
  const playedQueen = h.taken.some((cs) => cs.some(isQueen)) || h.trick.some((t) => isQueen(t.c));
  if (!h.trick.length) {
    // Lead low, and from a suit that's safe: not spades if the queen is still out and we'd draw it onto ourselves with a high spade
    const ranked = [...opts].sort((a, b) => a.rank - b.rank || (a.suit === HEARTS ? 1 : 0) - (b.suit === HEARTS ? 1 : 0));
    const safeLead = ranked.filter((c) => !(c.suit === SPADES && c.rank >= 12 && !playedQueen));
    return (safeLead.length ? safeLead : ranked)[0];
  }
  const lead = h.trick[0].c.suit;
  const following = opts[0].suit === lead;
  const trickPts = h.trick.reduce((s, t) => s + points(t.c), 0);
  if (following) {
    const top = Math.max(...h.trick.filter((t) => t.c.suit === lead).map((t) => t.c.rank));
    const under = opts.filter((c) => c.rank < top).sort((a, b) => b.rank - a.rank);
    // Duck under the winning card with the highest card that still loses
    if (under.length) {
      // Throw the queen under a higher spade
      const q = under.find(isQueen);
      return q ?? under[0];
    }
    // Have to win it: if it's the last card and there are no points, win high; otherwise win as cheaply as possible
    const last = h.trick.length === 3;
    const sorted = [...opts].sort((a, b) => a.rank - b.rank);
    const nonQueen = sorted.filter((c) => !isQueen(c));
    if (last && !trickPts) return nonQueen[nonQueen.length - 1] ?? sorted[sorted.length - 1];
    return nonQueen[0] ?? sorted[0];
  }
  // Can't follow: get rid of the queen, then high hearts, then the highest card
  const q = opts.find(isQueen);
  if (q) return q;
  const hs = opts.filter((c) => c.suit === HEARTS).sort((a, b) => b.rank - a.rank);
  if (hs.length) return hs[0];
  const highSpade = opts.filter((c) => c.suit === SPADES && c.rank > 12 && !playedQueen);
  if (highSpade.length) return highSpade[0];
  return [...opts].sort((a, b) => b.rank - a.rank)[0];
}
