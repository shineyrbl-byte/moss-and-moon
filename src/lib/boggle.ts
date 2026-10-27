// Bean boggle: a 4×4 tray of letter cubes. Find words by joining letters that touch (across, down or corner to corner),
// using each cube once per word, in three minutes. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";
import { isWord as known } from "./letterBoxed.ts";
import { COMMON4 } from "./data/words4.ts";
import { WORDS5 } from "./data/words5.ts";
import { ANSWERS } from "./wordGame.ts";
import { HIVE_PUZZLES } from "./data/hive.ts";

export const N = 4;
export const SECONDS = 180;
export const MIN_LEN = 4;
// Sixteen cubes with an even spread of letters (Q comes as "Qu")
const CUBES = ["aaeegn", "abbjoo", "achops", "affkps", "aoottw", "cimotu", "deilrx", "delrvy", "distty", "eeghnw", "eeinsu", "ehrtvw", "eiosst", "elrtty", "himnqu", "hlnnrz"];
export const isWord = known;
export const points = (w: string) => (w.length <= 4 ? 1 : w.length === 5 ? 2 : w.length === 6 ? 3 : w.length === 7 ? 5 : 11);
/** Scores go on the board as "1,000,000 minus points", so the usual lowest-first board puts the highest score on top */
export const BASE = 1_000_000;
export const toBoard = (pts: number) => BASE - pts;
export const fromBoard = (v: number) => BASE - v;
export const MIN_BOARD = toBoard(9999), MAX_BOARD = toBoard(1);

// Worked out once: the squares touching each square (corners too)
const NEXT: number[][] = [...Array(N * N).keys()].map((i) => {
  const out: number[] = [], r = Math.floor(i / N), c = i % N;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc); }
  return out;
});
const nextTo = (i: number) => NEXT[i];
export const touching = (a: number, b: number) => nextTo(a).includes(b);
/** The squares that spell a word, if it's on the tray */
export function pathFor(grid: string[], w: string): number[] | null {
  const go = (k: number, at: number, used: number[]): number[] | null => {
    const face = grid[at];
    if (!w.startsWith(face, k)) return null;
    const next = k + face.length, path = [...used, at];
    if (next === w.length) return path;
    for (const j of nextTo(at)) if (!path.includes(j)) { const p = go(next, j, path); if (p) return p; }
    return null;
  };
  for (let i = 0; i < N * N; i++) { const p = go(0, i, []); if (p) return p; }
  return null;
}
const EVERYDAY = [...new Set([...COMMON4, ...ANSWERS, ...HIVE_PUZZLES.flatMap((p) => p.common.split(/\s+/))])].filter((w) => w.length >= MIN_LEN);
let pool: string[] | null = null;
const ALL = () => (pool ??= [...new Set([...EVERYDAY, ...WORDS5.split(" ")])].filter((w) => w.length >= MIN_LEN && /^[a-z]+$/.test(w)));
/** Every everyday word on the tray (what the barista found), and every word it'll take */
const fitsOn = (grid: string[]) => { const letters = new Set(grid.join("")); return (w: string) => [...w].every((c) => letters.has(c)) && !!pathFor(grid, w); };
const everydayOn = (grid: string[]) => EVERYDAY.filter(fitsOn(grid)).sort();
export function wordsOn(grid: string[]) {
  return { everyday: everydayOn(grid), all: ALL().filter(fitsOn(grid)) };
}

/** Today's tray: roll and shuffle the cubes, keeping a tray with plenty to find */
export function trayFor(date: string): { grid: string[]; everyday: string[] } {
  const rand = seededRand(`boggle:${date}`);
  for (;;) {
    const order = [...CUBES.keys()];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const grid = order.map((k) => { const f = CUBES[k][Math.floor(rand() * 6)]; return f === "q" ? "qu" : f; });
    // Only the everyday words decide whether a tray is good enough, so the full word list isn't searched here
    const everyday = everydayOn(grid);
    if (everyday.length >= 25) return { grid, everyday };
  }
}
/** Why a word doesn't count, or null if it does */
export function problem(grid: string[], found: string[], w: string): string | null {
  if (w.length < MIN_LEN) return `Words need at least ${MIN_LEN} letters.`;
  if (found.includes(w)) return "You've already found that one.";
  if (!pathFor(grid, w)) return "Those letters don't join up on the tray.";
  if (!isWord(w)) return "That's not in our word list.";
  return null;
}
export const total = (found: string[]) => found.reduce((s, w) => s + points(w), 0);
