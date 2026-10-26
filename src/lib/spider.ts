// Café spider: Spider solitaire with two decks. Build down in any suit, but only a run in one suit moves together. A full
// king-to-ace run in one suit is cleared away. Clear all eight to win. Pure, so the page and tests share it.
export type Card = { suit: number; rank: number; up: boolean };
export type State = { cols: Card[][]; stock: Card[]; done: number; moves: number };
export type Suits = 1 | 2;

export function deal(rand: () => number, suits: Suits = 1): State {
  const deck: Card[] = [];
  for (let d = 0; d < 8; d++) for (let r = 1; r <= 13; r++) deck.push({ suit: suits === 1 ? 0 : d % 2 ? 1 : 0, rank: r, up: false });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const cols: Card[][] = Array.from({ length: 10 }, () => []);
  for (let k = 0; k < 54; k++) cols[k % 10].push(deck[k]);
  cols.forEach((c) => { c[c.length - 1].up = true; });
  return { cols, stock: deck.slice(54), done: 0, moves: 0 };
}
/** Is the column from `at` down one run in one suit, each card one lower? */
export function isRun(col: Card[], at: number) {
  if (at < 0 || at >= col.length || !col[at].up) return false;
  for (let k = at + 1; k < col.length; k++) if (col[k].suit !== col[at].suit || col[k].rank !== col[k - 1].rank - 1) return false;
  return true;
}
const flipTop = (c: Card[]) => { if (c.length && !c[c.length - 1].up) c[c.length - 1] = { ...c[c.length - 1], up: true }; };
/** Take away any finished king-to-ace runs */
function clearRuns(s: State): State {
  const cols = s.cols.map((c) => [...c]);
  let done = s.done;
  for (const c of cols) {
    if (c.length < 13) continue;
    const at = c.length - 13;
    if (c[at].rank === 13 && isRun(c, at)) { c.splice(at); done++; flipTop(c); }
  }
  return { ...s, cols, done };
}
export function move(s: State, from: number, at: number, to: number): State | null {
  if (from === to || !isRun(s.cols[from], at)) return null;
  const run = s.cols[from].slice(at), dest = s.cols[to], top = dest[dest.length - 1];
  if (top && top.rank !== run[0].rank + 1) return null;
  const cols = s.cols.map((c) => [...c]);
  cols[from].splice(at); cols[to].push(...run); flipTop(cols[from]);
  return clearRuns({ ...s, cols, moves: s.moves + 1 });
}
/** Deal a card onto every column (not allowed with an empty column) */
export function dealRow(s: State): State | null {
  if (!s.stock.length || s.cols.some((c) => !c.length)) return null;
  const cols = s.cols.map((c, i) => [...c, { ...s.stock[i], up: true }]);
  return clearRuns({ ...s, cols, stock: s.stock.slice(10), moves: s.moves + 1 });
}
export const isWon = (s: State) => s.done === 8;
/** The best column for a run you tap: one where it lands on the same suit, then any that takes it, then an empty one */
export function bestTarget(s: State, from: number, at: number): number | null {
  const run = s.cols[from].slice(at);
  if (!isRun(s.cols[from], at)) return null;
  const fits = s.cols.map((c, i) => ({ i, top: c[c.length - 1] })).filter(({ i, top }) => i !== from && (!top || top.rank === run[0].rank + 1));
  const same = fits.find(({ top }) => top && top.suit === run[0].suit);
  return (same ?? fits.find(({ top }) => top) ?? fits[0])?.i ?? null;
}
