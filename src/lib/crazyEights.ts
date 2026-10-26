// Café crazy eights: match the top card's suit or number. An 8 goes on anything and you pick the next suit. Can't go? Draw
// one, and play it if you can. First to empty their hand wins. Pure, so the page and tests share it.
export type Card = { suit: number; rank: number };
export type Level = "easy" | "hard";
export type State = { hands: Card[][]; stock: Card[]; pile: Card[]; suit: number; turn: 0 | 1; drew: boolean; winner: 0 | 1 | null };
export const HAND = 7;

export function deal(rand: () => number): State {
  const deck: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ suit: s, rank: r });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const hands = [deck.slice(0, HAND), deck.slice(HAND, 2 * HAND)];
  let rest = deck.slice(2 * HAND);
  // The first card face up isn't an 8
  const k = rest.findIndex((c) => c.rank !== 8);
  const first = rest[k]; rest = [...rest.slice(0, k), ...rest.slice(k + 1)];
  return { hands, stock: rest, pile: [first], suit: first.suit, turn: 0, drew: false, winner: null };
}
export const top = (s: State) => s.pile[s.pile.length - 1];
export const playable = (s: State, c: Card) => c.rank === 8 || c.suit === s.suit || c.rank === top(s).rank;
export const same = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank;

/** Play a card (with the suit to call if it's an 8) */
export function play(s: State, c: Card, call?: number): State | null {
  const me = s.turn;
  if (s.winner !== null || !s.hands[me].some((x) => same(x, c)) || !playable(s, c)) return null;
  const hands = s.hands.map((h, p) => (p === me ? h.filter((x) => !same(x, c)) : h));
  const t: State = { ...s, hands, pile: [...s.pile, c], suit: c.rank === 8 ? (call ?? c.suit) : c.suit, turn: (1 - me) as 0 | 1, drew: false };
  if (!hands[me].length) t.winner = me;
  return t;
}
/** Draw a card (once a turn). If the pile has run out, the played cards (bar the top one) are shuffled back in. */
export function drawCard(s: State, rand: () => number): State | null {
  if (s.winner !== null || s.drew) return null;
  let stock = s.stock, pile = s.pile;
  if (!stock.length) {
    if (pile.length < 2) return pass(s);
    stock = pile.slice(0, -1);
    for (let i = stock.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [stock[i], stock[j]] = [stock[j], stock[i]]; }
    pile = [pile[pile.length - 1]];
  }
  const hands = s.hands.map((h, p) => (p === s.turn ? [...h, stock[0]] : h));
  return { ...s, hands, stock: stock.slice(1), pile, drew: true };
}
/** Having drawn, pass the turn */
export const pass = (s: State): State => ({ ...s, turn: (1 - s.turn) as 0 | 1, drew: false });

/** The computer's turn, one step at a time: a card to play (and suit), "draw" or "pass" */
export function choose(s: State, level: Level, rand: () => number = Math.random): { card: Card; call?: number } | "draw" | "pass" {
  const hand = s.hands[s.turn], ok = hand.filter((c) => playable(s, c));
  if (!ok.length) return s.drew ? "pass" : "draw";
  const bestSuit = () => { const n = [0, 0, 0, 0]; hand.forEach((c) => { if (c.rank !== 8) n[c.suit]++; }); return n.indexOf(Math.max(...n)); };
  if (level === "easy") { const c = ok[Math.floor(rand() * ok.length)]; return { card: c, call: c.rank === 8 ? Math.floor(rand() * 4) : undefined }; }
  // Hard: keep 8s for when you need them, and play from the suit you hold most of
  const plain = ok.filter((c) => c.rank !== 8);
  if (plain.length) {
    const counts = [0, 0, 0, 0]; hand.forEach((c) => counts[c.suit]++);
    plain.sort((a, b) => counts[b.suit] - counts[a.suit] || b.rank - a.rank);
    return { card: plain[0] };
  }
  return { card: ok[0], call: bestSuit() };
}
