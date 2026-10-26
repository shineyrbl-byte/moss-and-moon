// Café rummy: draw a card, lay down sets (three or four of a number) and runs (three or more in a row in one suit, ace low),
// add cards onto melds already down, then throw one away. First to get rid of every card wins. Pure, so the page and tests share it.
export type Card = { suit: number; rank: number };
export type Level = "easy" | "hard";
export type State = { hands: Card[][]; stock: Card[]; discard: Card[]; melds: Card[][]; turn: 0 | 1; drawn: boolean; winner: 0 | 1 | null };
export const HAND = 7;
export const same = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank;
const without = (h: Card[], cs: Card[]) => h.filter((x) => !cs.some((c) => same(c, x)));

export function deal(rand: () => number): State {
  const deck: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ suit: s, rank: r });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return { hands: [deck.slice(0, HAND), deck.slice(HAND, 2 * HAND)], stock: deck.slice(2 * HAND + 1), discard: [deck[2 * HAND]], melds: [], turn: 0, drawn: false, winner: null };
}
export const isSet = (cs: Card[]) => cs.length >= 3 && cs.length <= 4 && cs.every((c) => c.rank === cs[0].rank) && new Set(cs.map((c) => c.suit)).size === cs.length;
export function isRun(cs: Card[]) {
  if (cs.length < 3 || !cs.every((c) => c.suit === cs[0].suit)) return false;
  const r = cs.map((c) => c.rank).sort((a, b) => a - b);
  return r.every((v, i) => !i || v === r[i - 1] + 1);
}
export const isMeld = (cs: Card[]) => isSet(cs) || isRun(cs);
const sortMeld = (cs: Card[]) => [...cs].sort((a, b) => a.rank - b.rank || a.suit - b.suit);

export function drawFrom(s: State, from: "stock" | "discard", rand: () => number = Math.random): State | null {
  if (s.drawn || s.winner !== null) return null;
  let stock = s.stock, discard = s.discard;
  if (from === "discard") {
    if (!discard.length) return null;
    const c = discard[discard.length - 1];
    return { ...s, hands: s.hands.map((h, p) => (p === s.turn ? [...h, c] : h)), discard: discard.slice(0, -1), drawn: true };
  }
  if (!stock.length) {
    // Turn the discards (bar the top one) over to make a new pile
    if (discard.length < 2) return null;
    stock = discard.slice(0, -1);
    for (let i = stock.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [stock[i], stock[j]] = [stock[j], stock[i]]; }
    discard = [discard[discard.length - 1]];
  }
  return { ...s, hands: s.hands.map((h, p) => (p === s.turn ? [...h, stock[0]] : h)), stock: stock.slice(1), discard, drawn: true };
}
const checkOut = (s: State): State => (s.hands[s.turn].length ? s : { ...s, winner: s.turn });
export function layDown(s: State, cs: Card[]): State | null {
  if (!s.drawn || s.winner !== null || !isMeld(cs) || !cs.every((c) => s.hands[s.turn].some((x) => same(x, c)))) return null;
  return checkOut({ ...s, hands: s.hands.map((h, p) => (p === s.turn ? without(h, cs) : h)), melds: [...s.melds, sortMeld(cs)] });
}
export function layOff(s: State, c: Card, meld: number): State | null {
  if (!s.drawn || s.winner !== null || !s.melds[meld] || !s.hands[s.turn].some((x) => same(x, c)) || !isMeld([...s.melds[meld], c])) return null;
  return checkOut({ ...s, hands: s.hands.map((h, p) => (p === s.turn ? without(h, [c]) : h)), melds: s.melds.map((m, k) => (k === meld ? sortMeld([...m, c]) : m)) });
}
export function throwAway(s: State, c: Card): State | null {
  if (!s.drawn || s.winner !== null || !s.hands[s.turn].some((x) => same(x, c))) return null;
  const t = { ...s, hands: s.hands.map((h, p) => (p === s.turn ? without(h, [c]) : h)), discard: [...s.discard, c], drawn: false, turn: (1 - s.turn) as 0 | 1 };
  return s.hands[s.turn].length === 1 ? { ...t, winner: s.turn } : t;
}

/** Melds hidden in a hand: the longest runs first, then sets */
export function findMelds(hand: Card[]): Card[][] {
  const out: Card[][] = [];
  let left = [...hand];
  for (let su = 0; su < 4; su++) {
    const rs = left.filter((c) => c.suit === su).sort((a, b) => a.rank - b.rank);
    let run: Card[] = [];
    const flush = () => { if (run.length >= 3) { out.push(run); left = without(left, run); } run = []; };
    for (const c of rs) { if (run.length && c.rank !== run[run.length - 1].rank + 1) flush(); run.push(c); }
    flush();
  }
  for (let r = 1; r <= 13; r++) { const g = left.filter((c) => c.rank === r); if (g.length >= 3) { out.push(g.slice(0, 4)); left = without(left, g.slice(0, 4)); } }
  return out;
}
/** How useful a card is to keep: part of a pair, or next to a card of its suit */
const worth = (hand: Card[], c: Card) => hand.filter((x) => !same(x, c) && (x.rank === c.rank || (x.suit === c.suit && Math.abs(x.rank - c.rank) <= 2))).length;

/** The computer's whole turn */
export function computerTurn(s: State, level: Level, rand: () => number = Math.random): State {
  let t = s;
  const top = t.discard[t.discard.length - 1];
  const helps = top && (level === "hard" ? worth(t.hands[t.turn], top) >= 1 && findMelds([...t.hands[t.turn], top]).length > findMelds(t.hands[t.turn]).length || t.melds.some((m) => isMeld([...m, top])) : rand() < 0.3);
  t = drawFrom(t, helps ? "discard" : "stock", rand) ?? drawFrom(t, "stock", rand) ?? t;
  if (!t.drawn) return { ...t, turn: (1 - t.turn) as 0 | 1 };
  for (const m of findMelds(t.hands[t.turn])) { const n = layDown(t, m); if (n) t = n; if (t.winner !== null) return t; }
  for (let again = true; again && t.winner === null;) {
    again = false;
    for (const c of t.hands[t.turn]) for (let k = 0; k < t.melds.length; k++) { const n = layOff(t, c, k); if (n) { t = n; again = true; break; } }
  }
  if (t.winner !== null) return t;
  const hand = t.hands[t.turn];
  const pick = level === "easy" ? hand[Math.floor(rand() * hand.length)] : [...hand].sort((a, b) => worth(hand, a) - worth(hand, b) || b.rank - a.rank)[0];
  return throwAway(t, pick)!;
}
