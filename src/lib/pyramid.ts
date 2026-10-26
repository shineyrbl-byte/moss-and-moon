// Café pyramid: clear the pyramid of 28 cards by taking away pairs that add up to 13 (jack 11, queen 12; a king goes on its
// own). A card can only be taken once nothing covers it. The pile turns over one card at a time, and can be gone through
// three times. Pure, so the page and tests share it.
export type Card = { suit: number; rank: number };
export type State = { pyr: (Card | null)[]; stock: Card[]; waste: Card[]; passes: number; moves: number };
export const PASSES = 3;
export type Spot = { kind: "pyr"; i: number } | { kind: "waste" };

/** Row and place of pyramid card i (row r has r+1 cards) */
export const rowOf = (i: number) => Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
export const firstOf = (r: number) => (r * (r + 1)) / 2;
/** The two cards resting on card i (from the row below), if any */
export function coveredBy(i: number): [number, number] | null {
  const r = rowOf(i);
  if (r === 6) return null;
  const k = i - firstOf(r), below = firstOf(r + 1) + k;
  return [below, below + 1];
}
export const free = (s: State, i: number) => !!s.pyr[i] && (coveredBy(i)?.every((j) => !s.pyr[j]) ?? true);

export function deal(rand: () => number): State {
  const deck: Card[] = [];
  for (let su = 0; su < 4; su++) for (let r = 1; r <= 13; r++) deck.push({ suit: su, rank: r });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return { pyr: deck.slice(0, 28), stock: deck.slice(28), waste: [], passes: 1, moves: 0 };
}
const cardAt = (s: State, x: Spot) => (x.kind === "pyr" ? (free(s, x.i) ? s.pyr[x.i] : null) : s.waste[s.waste.length - 1] ?? null);
/** Take away one card (a king) or two that make 13 */
export function take(s: State, a: Spot, b?: Spot): State | null {
  const ca = cardAt(s, a), cb = b ? cardAt(s, b) : null;
  if (!ca || (b && !cb)) return null;
  if (b && a.kind === b.kind && (a.kind === "waste" || (a as { i: number }).i === (b as { i: number }).i)) return null;
  if (b ? ca.rank + cb!.rank !== 13 : ca.rank !== 13) return null;
  const pyr = [...s.pyr], waste = [...s.waste];
  for (const x of b ? [a, b] : [a]) { if (x.kind === "pyr") pyr[x.i] = null; else waste.pop(); }
  return { ...s, pyr, waste, moves: s.moves + 1 };
}
/** Turn over the next card from the pile, or start the pile again (three times in all) */
export function draw(s: State): State | null {
  if (s.stock.length) return { ...s, stock: s.stock.slice(1), waste: [...s.waste, s.stock[0]], moves: s.moves + 1 };
  if (s.passes >= PASSES || !s.waste.length) return null;
  return { ...s, stock: [...s.waste], waste: [], passes: s.passes + 1, moves: s.moves + 1 };
}
export const isWon = (s: State) => s.pyr.every((c) => !c);
/** Any pair (or king) you could take right now? */
export function anyMove(s: State): boolean {
  const spots: Spot[] = [...s.pyr.map((_, i) => ({ kind: "pyr", i }) as Spot).filter((x) => cardAt(s, x)), ...(s.waste.length ? [{ kind: "waste" } as Spot] : [])];
  for (const a of spots) { if (take(s, a)) return true; for (const b of spots) if (take(s, a, b)) return true; }
  return false;
}
export const isStuck = (s: State) => !isWon(s) && !anyMove(s) && !draw(s);
