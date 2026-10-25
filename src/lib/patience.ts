// Café patience: Klondike solitaire with café suits. Pure, so the page and tests share it.
export const SUITS = ["☕", "🍓", "🍫", "🌸"];
/** Suits 0 and 2 are brown, 1 and 3 are pink. Stacks go down in alternating colours. */
export const pinkSuit = (s: number) => s % 2 === 1;
export const RANK = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export type Card = { suit: number; rank: number; up: boolean };
export type Game = { stock: Card[]; waste: Card[]; found: Card[][]; piles: Card[][]; draw: 1 | 3; moves: number };
export type From = { kind: "waste" } | { kind: "found"; i: number } | { kind: "pile"; i: number; at: number };

export function newGame(rand: () => number, draw: 1 | 3 = 1): Game {
  const deck: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ suit: s, rank: r, up: false });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const piles: Card[][] = [];
  for (let i = 0; i < 7; i++) piles.push(deck.splice(0, i + 1).map((c, k) => ({ ...c, up: k === i })));
  return { stock: deck, waste: [], found: [[], [], [], []], piles, draw, moves: 0 };
}

/** Turn over the next card(s), or put the pile back once it runs out */
export function drawCards(g: Game): Game {
  if (!g.stock.length) {
    if (!g.waste.length) return g;
    return { ...g, stock: [...g.waste].reverse().map((c) => ({ ...c, up: false })), waste: [], moves: g.moves + 1 };
  }
  const n = Math.min(g.draw, g.stock.length);
  const taken = g.stock.slice(-n).reverse().map((c) => ({ ...c, up: true }));
  return { ...g, stock: g.stock.slice(0, -n), waste: [...g.waste, ...taken], moves: g.moves + 1 };
}

export const canFound = (c: Card, f: Card[]) => (f.length ? f[f.length - 1].suit === c.suit && f[f.length - 1].rank === c.rank - 1 : c.rank === 1);
export const canStack = (c: Card, pile: Card[]) => {
  const top = pile[pile.length - 1];
  return top ? top.up && top.rank === c.rank + 1 && pinkSuit(top.suit) !== pinkSuit(c.suit) : c.rank === 13;
};

/** The cards that would move from a spot (a run from the middle of a pile moves together) */
export function cardsAt(g: Game, from: From): Card[] {
  if (from.kind === "waste") return g.waste.length ? [g.waste[g.waste.length - 1]] : [];
  if (from.kind === "found") { const f = g.found[from.i]; return f.length ? [f[f.length - 1]] : []; }
  const pile = g.piles[from.i];
  if (!pile[from.at]?.up) return [];
  return pile.slice(from.at);
}

function take(g: Game, from: From): Game {
  if (from.kind === "waste") return { ...g, waste: g.waste.slice(0, -1) };
  if (from.kind === "found") return { ...g, found: g.found.map((f, i) => (i === from.i ? f.slice(0, -1) : f)) };
  const piles = g.piles.map((p, i) => {
    if (i !== from.i) return p;
    const left = p.slice(0, from.at);
    // Flip the new top card
    return left.length && !left[left.length - 1].up ? [...left.slice(0, -1), { ...left[left.length - 1], up: true }] : left;
  });
  return { ...g, piles };
}

export type To = { kind: "found"; i: number } | { kind: "pile"; i: number };
export function move(g: Game, from: From, to: To): Game | null {
  const cards = cardsAt(g, from);
  if (!cards.length) return null;
  if (to.kind === "found") {
    if (cards.length !== 1 || to.i !== cards[0].suit || !canFound(cards[0], g.found[to.i])) return null;
    const after = take(g, from);
    return { ...after, found: after.found.map((f, i) => (i === to.i ? [...f, cards[0]] : f)), moves: g.moves + 1 };
  }
  if (from.kind === "pile" && from.i === to.i) return null;
  if (!canStack(cards[0], g.piles[to.i])) return null;
  const after = take(g, from);
  return { ...after, piles: after.piles.map((p, i) => (i === to.i ? [...p, ...cards] : p)), moves: g.moves + 1 };
}

/** Tap a card: home to its foundation if it can go, otherwise onto the first pile that takes it */
export function autoMove(g: Game, from: From): Game | null {
  const cards = cardsAt(g, from);
  if (!cards.length) return null;
  if (cards.length === 1 && from.kind !== "found") {
    const done = move(g, from, { kind: "found", i: cards[0].suit });
    if (done) return done;
  }
  // A king already at the bottom of a pile has nowhere better to go
  if (cards[0].rank === 13 && from.kind === "pile" && from.at === 0) return null;
  const order = [...g.piles.keys()].sort((a, b) => Number(!g.piles[a].length) - Number(!g.piles[b].length));
  for (const i of order) { const r = move(g, from, { kind: "pile", i }); if (r) return r; }
  return null;
}

export const isWon = (g: Game) => g.found.every((f) => f.length === 13);
/** Everything's face up and dealt out, so the rest can fly home on its own */
export const canFinish = (g: Game) => !g.stock.length && !g.waste.length && g.piles.every((p) => p.every((c) => c.up)) && !isWon(g);
/** One card home, lowest first; call until it returns null */
export function finishStep(g: Game): Game | null {
  let best: { i: number; rank: number } | null = null;
  g.piles.forEach((p, i) => { const c = p[p.length - 1]; if (c && canFound(c, g.found[c.suit]) && (!best || c.rank < best.rank)) best = { i, rank: c.rank }; });
  if (!best) return null;
  const { i } = best;
  return move(g, { kind: "pile", i, at: g.piles[i].length - 1 }, { kind: "found", i: g.piles[i][g.piles[i].length - 1].suit });
}
