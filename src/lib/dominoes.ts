// Café dominoes: the draw game with a double-six set, you against the computer. Match a number at either end of the line;
// if you can't, draw from the boneyard. Go out first, or have the fewest pips when nobody can move, to win the round and
// score the other hand's pips. First to 50 takes the match. Pure, so the page and tests share it.
import { shuffled } from "./gameOrders.ts";

export type Tile = [number, number];
export type Level = "easy" | "hard";
export const TARGET = 50;
export type Round = {
  hands: [Tile[], Tile[]]; boneyard: Tile[];
  line: Tile[]; // each tile in the line is turned so its right side meets the next tile's left
  turn: 0 | 1; passes: number; winner: 0 | 1 | null; blocked: boolean; last: { who: 0 | 1; tile: Tile; end: "left" | "right" } | null; drew: number;
};

export const SET: Tile[] = [];
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) SET.push([a, b]);
export const pips = (t: Tile) => t[0] + t[1];
export const handPips = (h: Tile[]) => h.reduce((n, t) => n + pips(t), 0);
export const same = (a: Tile, b: Tile) => (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
export const ends = (r: Round): [number, number] | null => (r.line.length ? [r.line[0][0], r.line[r.line.length - 1][1]] : null);

/** Deal 7 each. Whoever holds the highest double leads (or the heaviest tile, if nobody has a double). */
export function deal(rand: () => number, firstPick?: 0 | 1): Round {
  const bag = shuffled(SET, rand);
  const hands: [Tile[], Tile[]] = [bag.slice(0, 7), bag.slice(7, 14)];
  const score = (t: Tile) => (t[0] === t[1] ? 100 + t[0] : pips(t));
  const best = (h: Tile[]) => Math.max(...h.map(score));
  const turn: 0 | 1 = firstPick ?? (best(hands[0]) >= best(hands[1]) ? 0 : 1);
  return { hands, boneyard: bag.slice(14), line: [], turn, passes: 0, winner: null, blocked: false, last: null, drew: 0 };
}

/** Where a tile can go: "left", "right", both, or neither */
export function fits(r: Round, t: Tile): ("left" | "right")[] {
  const e = ends(r);
  if (!e) return ["right"];
  const out: ("left" | "right")[] = [];
  if (t[0] === e[0] || t[1] === e[0]) out.push("left");
  if (t[0] === e[1] || t[1] === e[1]) out.push("right");
  return out;
}
export const canPlay = (r: Round, who: 0 | 1) => r.hands[who].some((t) => fits(r, t).length > 0);

function finish(r: Round): Round {
  const [a, b] = r.hands;
  if (!a.length) return { ...r, winner: 0 };
  if (!b.length) return { ...r, winner: 1 };
  // Blocked: both passed with an empty boneyard. Fewest pips wins; a tie goes to whoever didn't make the last move.
  if (r.passes >= 2) { const pa = handPips(a), pb = handPips(b); return { ...r, blocked: true, winner: pa < pb ? 0 : pb < pa ? 1 : r.last ? ((1 - r.last.who) as 0 | 1) : 0 }; }
  return r;
}

/** Play a tile from the mover's hand at one end */
export function play(r: Round, t: Tile, end: "left" | "right"): Round | null {
  if (r.winner !== null || !r.hands[r.turn].some((x) => same(x, t)) || !fits(r, t).includes(end)) return null;
  const e = ends(r);
  let placed: Tile = [t[0], t[1]];
  if (e) placed = end === "left" ? (t[1] === e[0] ? [t[0], t[1]] : [t[1], t[0]]) : t[0] === e[1] ? [t[0], t[1]] : [t[1], t[0]];
  const hands: [Tile[], Tile[]] = [[...r.hands[0]], [...r.hands[1]]];
  hands[r.turn] = hands[r.turn].filter((x) => !same(x, t));
  const line = end === "left" ? [placed, ...r.line] : [...r.line, placed];
  return finish({ ...r, hands, line, turn: (1 - r.turn) as 0 | 1, passes: 0, last: { who: r.turn, tile: placed, end }, drew: 0 });
}
/** No move: draw one from the boneyard, or pass if it's empty */
export function drawOrPass(r: Round): Round {
  if (r.winner !== null) return r;
  if (r.boneyard.length) {
    const hands: [Tile[], Tile[]] = [[...r.hands[0]], [...r.hands[1]]];
    hands[r.turn] = [...hands[r.turn], r.boneyard[0]];
    return { ...r, hands, boneyard: r.boneyard.slice(1), drew: r.drew + 1 };
  }
  return finish({ ...r, turn: (1 - r.turn) as 0 | 1, passes: r.passes + 1, drew: 0 });
}
/** Points for the round's winner: the pips left in the other hand */
export const roundPoints = (r: Round) => (r.winner === null ? 0 : handPips(r.hands[1 - r.winner]));

/** The computer's choice of tile and end. Easy plays anything that fits; hard dumps heavy tiles, keeps a spread of numbers,
 * and tries to leave ends you can't match (it remembers what you drew on). */
export function bestMove(r: Round, level: Level, rand: () => number, youCantMatch: number[] = []): { tile: Tile; end: "left" | "right" } | null {
  const me = r.turn, hand = r.hands[me];
  const moves = hand.flatMap((t) => fits(r, t).map((end) => ({ tile: t, end })));
  if (!moves.length) return null;
  if (level === "easy") return moves[Math.floor(rand() * moves.length)];
  const score = (m: { tile: Tile; end: "left" | "right" }) => {
    const next = play(r, m.tile, m.end)!;
    if (next.winner === me) return 1e6;
    const e = ends(next)!, rest = next.hands[me];
    let s = pips(m.tile) * 2 + (m.tile[0] === m.tile[1] ? 6 : 0);
    // Ends I can follow up on, and ends you've shown you don't have
    s += rest.filter((t) => t.some((x) => x === e[0] || x === e[1])).length * 3;
    s += e.filter((x) => youCantMatch.includes(x)).length * 8;
    // Keep different numbers in hand
    s += new Set(rest.flat()).size;
    return s + rand() * 0.5;
  };
  return moves.reduce((a, b) => (score(b) > score(a) ? b : a));
}
