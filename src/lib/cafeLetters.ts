// Café letters: a crossword tile game on a small 11×11 board, you against the computer. Every word on the board is
// 2 to 5 letters long. Place tiles in one line, joined to what's there (the first word covers the middle star).
// Pink squares double or triple a letter, brown ones the whole word. Pure, so the page and tests share it.
import { shuffled } from "./gameOrders.ts";
import { COMMON2, COMMON3, THREE, TWO } from "./data/words3.ts";
import { COMMON4, MORE4 } from "./data/words4.ts";
import { WORDS5 } from "./data/words5.ts";
import { COMMON5 } from "./data/common5.ts";

export const N = 11;
export const CENTRE = 60;
export const RACK = 7;
export const MAX_LEN = 5;
export const VALUE: Record<string, number> = { a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10 };
// A smaller bag for a smaller board (about three quarters of the usual 98 letters, no blanks)
const COUNTS: Record<string, number> = { a: 7, b: 2, c: 2, d: 3, e: 9, f: 2, g: 2, h: 2, i: 6, j: 1, k: 1, l: 3, m: 2, n: 5, o: 6, p: 2, q: 1, r: 5, s: 3, t: 5, u: 3, v: 1, w: 2, x: 1, y: 2, z: 1 };
export const BAG: string[] = Object.entries(COUNTS).flatMap(([l, n]) => Array(n).fill(l));

/** Premium squares: "dl" "tl" double/triple letter, "dw" "tw" double/triple word (mirrored in all four corners) */
export const PREMIUM: (string | null)[] = (() => {
  const out: (string | null)[] = Array(N * N).fill(null);
  const put = (r: number, c: number, k: string) => { for (const [rr, cc] of [[r, c], [r, N - 1 - c], [N - 1 - r, c], [N - 1 - r, N - 1 - c], [c, r], [c, N - 1 - r], [N - 1 - c, r], [N - 1 - c, N - 1 - r]]) out[rr * N + cc] = k; };
  put(0, 0, "tw"); put(0, 5, "dl"); put(1, 1, "dw"); put(2, 2, "dw"); put(1, 5, "tl"); put(3, 3, "tl"); put(4, 4, "dl"); put(0, 3, "dl"); put(2, 6, "dl");
  out[CENTRE] = "dw";
  return out;
})();

const split = (x: string | string[]) => (Array.isArray(x) ? x : x.split(" "));
export const VALID = new Set<string>([...TWO, ...THREE, ...split(COMMON4), ...split(MORE4), ...split(WORDS5)]);
/** What the computer will play: everyday words only */
export const COMPUTER_WORDS = [...new Set([...COMMON2, ...COMMON3, ...split(COMMON4), ...split(COMMON5)])].filter((w) => VALID.has(w));

export type Game = { board: string[]; racks: [string[], string[]]; bag: string[]; scores: [number, number]; turn: 0 | 1; passes: number; over: boolean; last: { who: 0 | 1; words: string[]; points: number } | null };
export function newGame(rand: () => number): Game {
  const bag = shuffled(BAG, rand);
  return { board: Array(N * N).fill(""), racks: [bag.splice(0, RACK), bag.splice(0, RACK)], bag, scores: [0, 0], turn: 0, passes: 0, over: false, last: null };
}

export type Placement = { at: number; letter: string }[];
/** Check a move and work out its words and score. Returns why not, if it isn't allowed. */
export function evaluate(board: string[], move: Placement): { ok: true; words: string[]; points: number } | { ok: false; why: string } {
  if (!move.length) return { ok: false, why: "Put some tiles down first." };
  if (move.some((m) => board[m.at])) return { ok: false, why: "That square's taken." };
  const rows = new Set(move.map((m) => Math.floor(m.at / N))), cols = new Set(move.map((m) => m.at % N));
  if (rows.size > 1 && cols.size > 1) return { ok: false, why: "Tiles have to go in one straight line." };
  const b = [...board];
  for (const m of move) b[m.at] = m.letter;
  const empty = board.every((x) => !x);
  if (empty && !move.some((m) => m.at === CENTRE)) return { ok: false, why: "The first word has to cover the middle star." };
  const across = rows.size === 1 && (move.length > 1 || hasNeighbour(b, move[0].at, true));
  // The main line must have no gaps between the new tiles
  const cells = move.map((m) => m.at).sort((a, x) => a - x), step = across ? 1 : N;
  for (let i = cells[0]; i <= cells[cells.length - 1]; i += step) if (!b[i]) return { ok: false, why: "Leave no gaps in your word." };
  const words: { cells: number[] }[] = [];
  const lineAt = (i: number, horiz: boolean) => {
    const d = horiz ? 1 : N, sameLine = (j: number) => (horiz ? Math.floor(j / N) === Math.floor(i / N) : true);
    let s = i; while (s - d >= 0 && sameLine(s - d) && b[s - d]) s -= d;
    const out: number[] = []; for (let j = s; j < N * N && sameLine(j) && b[j]; j += d) out.push(j);
    return out;
  };
  const main = lineAt(cells[0], across);
  if (main.length > 1) words.push({ cells: main });
  for (const c of cells) { const cross = lineAt(c, !across); if (cross.length > 1) words.push({ cells: cross }); }
  if (!words.length) return { ok: false, why: "A word needs at least two letters." };
  if (!empty && !words.some((w) => w.cells.some((c) => board[c]))) return { ok: false, why: "Join your word on to the ones already down." };
  const newSet = new Set(cells);
  let points = 0;
  const spelled: string[] = [];
  for (const w of words) {
    const word = w.cells.map((c) => b[c]).join("");
    if (word.length > MAX_LEN) return { ok: false, why: `${word.toUpperCase()} is too long: words here are ${MAX_LEN} letters at most.` };
    if (!VALID.has(word)) return { ok: false, why: `${word.toUpperCase()} isn't in our word list.` };
    let sum = 0, mult = 1;
    for (const c of w.cells) {
      const v = VALUE[b[c]], pr = newSet.has(c) ? PREMIUM[c] : null;
      sum += v * (pr === "dl" ? 2 : pr === "tl" ? 3 : 1);
      if (pr === "dw") mult *= 2; if (pr === "tw") mult *= 3;
    }
    points += sum * mult; spelled.push(word);
  }
  return { ok: true, words: spelled, points };
}
function hasNeighbour(b: string[], i: number, horiz: boolean) {
  return horiz ? (i % N > 0 && !!b[i - 1]) || (i % N < N - 1 && !!b[i + 1]) : (i >= N && !!b[i - N]) || (i < N * (N - 1) && !!b[i + N]);
}

const draw = (g: Game, who: 0 | 1) => { const need = RACK - g.racks[who].length; g.racks[who].push(...g.bag.splice(0, need)); };
function endCheck(g: Game): Game {
  const someoneOut = !g.bag.length && g.racks.some((r) => !r.length);
  if (someoneOut || g.passes >= 4) {
    // Leftover tiles count against you, and go to whoever went out
    const left = g.racks.map((r) => r.reduce((n, l) => n + VALUE[l], 0)) as [number, number];
    const out = g.racks.findIndex((r) => !r.length);
    g.scores = [g.scores[0] - left[0], g.scores[1] - left[1]];
    if (someoneOut && out >= 0) g.scores[out] += left[1 - out];
    g.over = true;
  }
  return g;
}
export function playMove(g0: Game, move: Placement): Game | { why: string } {
  const e = evaluate(g0.board, move);
  if (!e.ok) return { why: e.why };
  const rack = [...g0.racks[g0.turn]];
  for (const m of move) { const k = rack.indexOf(m.letter); if (k < 0) return { why: "You don't have those letters." }; rack.splice(k, 1); }
  const g: Game = { ...g0, board: [...g0.board], racks: [[...g0.racks[0]], [...g0.racks[1]]], bag: [...g0.bag], scores: [...g0.scores] as [number, number] };
  for (const m of move) g.board[m.at] = m.letter;
  g.racks[g.turn] = rack; draw(g, g.turn);
  g.scores[g.turn] += e.points; g.last = { who: g.turn, words: e.words, points: e.points };
  g.passes = 0; g.turn = (1 - g.turn) as 0 | 1;
  return endCheck(g);
}
/** Pass, or swap some tiles back into the bag (needs at least 7 in the bag) */
export function passOrSwap(g0: Game, swap: string[], rand: () => number): Game {
  const g: Game = { ...g0, racks: [[...g0.racks[0]], [...g0.racks[1]]], bag: [...g0.bag], scores: [...g0.scores] as [number, number] };
  if (swap.length && g.bag.length >= RACK) {
    const rack = g.racks[g.turn];
    for (const l of swap) { const k = rack.indexOf(l); if (k >= 0) rack.splice(k, 1); }
    rack.push(...g.bag.splice(0, swap.length));
    g.bag = shuffled([...g.bag, ...swap], rand);
  }
  g.last = { who: g.turn, words: [], points: 0 };
  g.passes += 1; g.turn = (1 - g.turn) as 0 | 1;
  return endCheck(g);
}

/** Every move the computer could make with its everyday words, best first */
export function computerMoves(g: Game, limit = 60): { move: Placement; points: number; words: string[] }[] {
  const rack = g.racks[g.turn], board = g.board, empty = board.every((x) => !x);
  const have: Record<string, number> = {};
  for (const l of rack) have[l] = (have[l] ?? 0) + 1;
  const onBoard = new Set(board.filter(Boolean));
  // Quick filter: words we could spell with the rack plus one letter from the board
  const words = COMPUTER_WORDS.filter((w) => {
    const need: Record<string, number> = {};
    for (const ch of w) need[ch] = (need[ch] ?? 0) + 1;
    let spare = empty ? 0 : 2;
    for (const [ch, n] of Object.entries(need)) { const short = n - (have[ch] ?? 0); if (short > 0) { if (!onBoard.has(ch)) return false; spare -= short; } }
    return spare >= 0;
  });
  const out: { move: Placement; points: number; words: string[] }[] = [];
  const seen = new Set<string>();
  for (const w of words) for (const across of [true, false]) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (across ? c + w.length > N : r + w.length > N) continue;
    const move: Placement = [], left = { ...have };
    let ok = true, usesBoard = false;
    for (let k = 0; k < w.length && ok; k++) {
      const at = across ? r * N + c + k : (r + k) * N + c;
      if (board[at]) { if (board[at] !== w[k]) ok = false; else usesBoard = true; }
      else if ((left[w[k]] ?? 0) > 0) { left[w[k]]--; move.push({ at, letter: w[k] }); }
      else ok = false;
    }
    if (!ok || !move.length || (!empty && !usesBoard && !move.some((m) => touches(board, m.at)))) continue;
    const key = move.map((m) => `${m.at}${m.letter}`).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const e = evaluate(board, move);
    if (e.ok) out.push({ move, points: e.points, words: e.words });
  }
  return out.sort((a, b) => b.points - a.points).slice(0, limit);
}
const touches = (b: string[], i: number) => [i - N, i + N, i % N ? i - 1 : -1, i % N < N - 1 ? i + 1 : -1].some((j) => j >= 0 && j < N * N && !!b[j]);
