// Menu threads: a 6×8 grid of letters, filled completely by one theme's words. Each word snakes through letters that
// touch (across, down or corner to corner). Find them all. Pure, so the page and tests share it.
import { seededRand, shuffled } from "./gameOrders.ts";
import { THEMES } from "./data/threads.ts";
import { isWord } from "./letterBoxed.ts";

export const ROWS = 8, COLS = 6;
export const minMs = 20000;
export const HINT_EVERY = 3; // other real words you find before you earn a hint
export type Thread = { word: string; cells: number[] };

export const touching = (a: number, b: number) => a !== b && Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) <= 1 && Math.abs((a % COLS) - (b % COLS)) <= 1;
const around = (i: number) => [...Array(ROWS * COLS).keys()].filter((j) => touching(i, j));
export const otherWord = (w: string) => w.length >= 4 && isWord(w);

/** Today's grid: the theme's title, the letters, and where each word lies */
export function threadsFor(date: string): { title: string; grid: string[]; threads: Thread[] } {
  const rand = seededRand(`threads:${date}`);
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const theme = THEMES[((day % THEMES.length) + THEMES.length) % THEMES.length];
  for (;;) {
    // Words whose letters add up to the whole grid
    const pool = shuffled(theme.words, rand);
    const pick: string[] = [];
    const fit = (k: number, left: number): boolean => {
      if (left === 0) return pick.length >= 6;
      for (let i = k; i < pool.length; i++) {
        if (pool[i].length > left) continue;
        pick.push(pool[i]);
        if (fit(i + 1, left - pool[i].length)) return true;
        pick.pop();
      }
      return false;
    };
    if (!fit(0, ROWS * COLS)) throw new Error(`Theme "${theme.title}" can't fill the grid`);
    // One path through every square, always heading for the square with fewest ways on (with a little randomness)
    const path: number[] = [], used = new Set<number>();
    const walk = (at: number): boolean => {
      path.push(at); used.add(at);
      if (path.length === ROWS * COLS) return true;
      const next = around(at).filter((j) => !used.has(j)).map((j) => ({ j, n: around(j).filter((k) => !used.has(k)).length + rand() * 0.9 })).sort((a, b) => a.n - b.n);
      for (const { j } of next.slice(0, 3)) if (walk(j)) return true;
      path.pop(); used.delete(at);
      return false;
    };
    if (!walk(Math.floor(rand() * ROWS * COLS))) continue;
    // Cut the path into the words, in a shuffled order
    const order = shuffled(pick, rand);
    const grid: string[] = Array(ROWS * COLS).fill("");
    const threads: Thread[] = [];
    let k = 0;
    for (const w of order) { const cells = path.slice(k, k + w.length); cells.forEach((c, i) => { grid[c] = w[i]; }); threads.push({ word: w, cells }); k += w.length; }
    return { title: theme.title, grid, threads };
  }
}
/** What a dragged path spells */
export const spell = (grid: string[], cells: number[]) => cells.map((c) => grid[c]).join("");
/** Is this drag exactly one of the hidden words, in its own squares (either direction)? */
export function matchThread(threads: Thread[], cells: number[]): Thread | null {
  const key = cells.join(","), back = [...cells].reverse().join(",");
  return threads.find((t) => t.cells.join(",") === key || t.cells.join(",") === back) ?? null;
}
