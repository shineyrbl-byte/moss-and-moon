// Café FreeCell: all 52 cards dealt face up into eight columns. Four free cells hold one card each. Build each suit up
// from the ace on the four spaces at the top; in the columns, stack down in alternating colours. Pure, so the page and
// tests share it.
import { seededRand } from "./gameOrders.ts";
import { pinkSuit } from "./patience.ts";

export { RANK, SUITS, pinkSuit } from "./patience.ts";
export const minMs = 30000;
export type Card = { suit: number; rank: number };
export type State = { cells: (Card | null)[]; found: number[]; cols: Card[][]; moves: number };
export type Spot = { kind: "col"; i: number; at?: number } | { kind: "cell"; i: number } | { kind: "found" };

/** Deal from a shuffled deck: four columns of seven, four of six */
export function deal(rand: () => number): State {
  const deck: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ suit: s, rank: r });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const cols: Card[][] = Array.from({ length: 8 }, () => []);
  deck.forEach((c, k) => cols[k % 8].push(c));
  return { cells: [null, null, null, null], found: [0, 0, 0, 0], cols, moves: 0 };
}
export const dealFor = (date: string) => deal(seededRand(`freecell:${date}`));

const fits = (c: Card, on: Card | undefined) => !on || (on.rank === c.rank + 1 && pinkSuit(on.suit) !== pinkSuit(c.suit));
/** Is the column from `at` down one tidy run (each card one lower, colours swapping)? */
export function isRun(col: Card[], at: number) {
  for (let k = at + 1; k < col.length; k++) if (!fits(col[k], col[k - 1]) || col[k - 1] === undefined) return false;
  return at >= 0 && at < col.length;
}
/** How many cards can move at once: one per free cell plus one, doubled for each empty column you're not moving into */
export const maxMove = (s: State, toEmpty: boolean) => (s.cells.filter((c) => !c).length + 1) * 2 ** Math.max(0, s.cols.filter((c) => !c.length).length - (toEmpty ? 1 : 0));

/** The cards a spot would move */
export function cardsFrom(s: State, from: Spot): Card[] {
  if (from.kind === "cell") return s.cells[from.i] ? [s.cells[from.i]!] : [];
  if (from.kind === "col") { const col = s.cols[from.i], at = from.at ?? col.length - 1; return isRun(col, at) ? col.slice(at) : []; }
  return [];
}
/** Make a move, or null if it isn't allowed */
export function move(s: State, from: Spot, to: Spot): State | null {
  const cards = cardsFrom(s, from);
  if (!cards.length || from.kind === "found") return null;
  if (from.kind === to.kind && from.i === (to as { i: number }).i) return null;
  const n: State = { cells: [...s.cells], found: [...s.found], cols: s.cols.map((c) => [...c]), moves: s.moves + 1 };
  if (to.kind === "found") {
    if (cards.length !== 1 || s.found[cards[0].suit] !== cards[0].rank - 1) return null;
    n.found[cards[0].suit]++;
  } else if (to.kind === "cell") {
    if (cards.length !== 1 || s.cells[to.i]) return null;
    n.cells[to.i] = cards[0];
  } else {
    const dest = s.cols[to.i];
    if (!fits(cards[0], dest[dest.length - 1]) || cards.length > maxMove(s, !dest.length)) return null;
    n.cols[to.i].push(...cards);
  }
  if (from.kind === "cell") n.cells[from.i] = null;
  else n.cols[from.i].splice(n.cols[from.i].length - cards.length);
  return n;
}

/** A card can go home safely once both suits of the other colour are no more than one behind it */
function safe(s: State, c: Card) {
  if (s.found[c.suit] !== c.rank - 1) return false;
  if (c.rank <= 2) return true;
  return [0, 1, 2, 3].filter((x) => pinkSuit(x) !== pinkSuit(c.suit)).every((x) => s.found[x] >= c.rank - 1);
}
/** Send home every card it's safe to (these don't count as moves) */
export function autoHome(s: State): State {
  let cur = s;
  for (let again = true; again;) {
    again = false;
    for (let i = 0; i < 4; i++) { const c = cur.cells[i]; if (c && safe(cur, c)) { cur = { ...move(cur, { kind: "cell", i }, { kind: "found" })!, moves: cur.moves }; again = true; } }
    for (let i = 0; i < 8; i++) { const col = cur.cols[i], c = col[col.length - 1]; if (c && safe(cur, c)) { cur = { ...move(cur, { kind: "col", i }, { kind: "found" })!, moves: cur.moves }; again = true; } }
  }
  return cur;
}
export const isWon = (s: State) => s.found.every((f) => f === 13);

/** The best place for a card you tap twice: home, then onto a column, then an empty column, then a free cell */
export function bestSpot(s: State, from: Spot): Spot | null {
  const tries: Spot[] = [{ kind: "found" }];
  s.cols.forEach((c, i) => { if (c.length) tries.push({ kind: "col", i }); });
  s.cols.forEach((c, i) => { if (!c.length) tries.push({ kind: "col", i }); });
  s.cells.forEach((c, i) => { if (!c) tries.push({ kind: "cell", i }); });
  return tries.find((t) => !(t.kind === from.kind && "i" in t && "i" in from && t.i === from.i) && move(s, from, t)) ?? null;
}

const key = (s: State) => s.found.join(",") + "|" + s.cells.map((c) => (c ? c.suit * 13 + c.rank : 0)).sort((a, b) => a - b).join(",") + "|" +
  s.cols.map((c) => c.map((x) => x.suit * 13 + x.rank).join(".")).sort().join("/");
/** How far from won a position looks: cards not home, plus cards sitting on top of the next ones each suit needs */
function distance(s: State) {
  let h = 52 - s.found.reduce((a, b) => a + b, 0);
  h += s.cells.filter(Boolean).length * 0.5;
  for (let suit = 0; suit < 4; suit++) {
    const want = s.found[suit] + 1;
    if (want > 13) continue;
    for (const col of s.cols) { const k = col.findIndex((c) => c.suit === suit && c.rank === want); if (k >= 0) h += col.length - 1 - k; }
  }
  return h;
}
/** A best-first search for a way to win, used by the tests to check deals. Gives up after `limit` positions. */
export function solve(start: State, limit = 40000): boolean {
  const seen = new Set<string>();
  // A small binary heap, lowest distance first
  const heap: { s: State; d: number }[] = [];
  const push = (s: State) => {
    heap.push({ s, d: distance(s) });
    for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p].d <= heap[i].d) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].d < heap[m].d) m = l; if (r < heap.length && heap[r].d < heap[m].d) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
    }
    return top.s;
  };
  push(autoHome(start));
  while (heap.length && seen.size < limit) {
    const s = pop();
    if (isWon(s)) return true;
    const k = key(s);
    if (seen.has(k)) continue;
    seen.add(k);
    const free = s.cells.findIndex((c) => !c), empty = s.cols.findIndex((c) => !c.length);
    for (let i = 0; i < 4; i++) {
      if (!s.cells[i]) continue;
      for (let j = 0; j < 8; j++) { if (!s.cols[j].length && j !== empty) continue; const t = move(s, { kind: "cell", i }, { kind: "col", i: j }); if (t) push(autoHome(t)); }
      const h = move(s, { kind: "cell", i }, { kind: "found" }); if (h) push(autoHome(h));
    }
    for (let i = 0; i < 8; i++) {
      const col = s.cols[i];
      if (!col.length) continue;
      const h = move(s, { kind: "col", i }, { kind: "found" }); if (h) push(autoHome(h));
      // Move the longest tidy run that fits, onto another column
      let at = col.length - 1;
      while (at > 0 && isRun(col, at - 1)) at--;
      for (let a = at; a < col.length; a++) for (let j = 0; j < 8; j++) {
        if (j === i || (!s.cols[j].length && (j !== empty || a === 0))) continue;
        const t = move(s, { kind: "col", i, at: a }, { kind: "col", i: j }); if (t) push(autoHome(t));
      }
      if (free >= 0) { const t = move(s, { kind: "col", i }, { kind: "cell", i: free }); if (t) push(autoHome(t)); }
    }
  }
  return false;
}
