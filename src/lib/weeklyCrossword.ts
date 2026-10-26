// The weekly crossword: a bigger, criss-cross grid that's the same all week (Monday to Sunday). Built from a bank of
// clued words: a long word goes in the middle, then more words cross it wherever they fit cleanly. Pure.
import { seededRand, shuffled } from "./gameOrders.ts";
import { CROSSWORDS } from "./crossword.ts";
import { WEEKLY_WORDS } from "./data/weeklyWords.ts";

export const SIZE = 11;
export const minMs = 60_000;
export const HINT_MS = 15000;
export const TARGET_WORDS = 16;

/** Every word we have a clue for, four letters or more */
export const BANK: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const x of CROSSWORDS) for (const [w, c] of Object.entries(x.clues)) if (w.length >= 4) out[w] = c;
  return { ...out, ...WEEKLY_WORDS };
})();

/** The Monday a date's week starts on */
export function mondayOf(date: string) {
  const d = new Date(`${date}T12:00:00Z`), back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86400_000).toISOString().slice(0, 10);
}

export type Placed = { word: string; r: number; c: number; down: boolean };
export type WEntry = { num: number; down: boolean; cells: number[]; answer: string; clue: string };

function tryPlace(grid: string[], w: string, r: number, c: number, down: boolean): number {
  // Returns how many letters it crosses, or -1 if it doesn't fit cleanly
  const dr = down ? 1 : 0, dc = down ? 0 : 1;
  const endR = r + dr * (w.length - 1), endC = c + dc * (w.length - 1);
  if (r < 0 || c < 0 || endR >= SIZE || endC >= SIZE) return -1;
  const at = (rr: number, cc: number) => (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE ? "" : grid[rr * SIZE + cc]);
  if (at(r - dr, c - dc) || at(endR + dr, endC + dc)) return -1;
  let cross = 0;
  for (let k = 0; k < w.length; k++) {
    const rr = r + dr * k, cc = c + dc * k, here = at(rr, cc);
    if (here) { if (here !== w[k]) return -1; cross++; continue; }
    // A new letter mustn't sit right next to another word's letters (that would spell nonsense)
    if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) return -1;
  }
  return cross === w.length ? -1 : cross;
}

export function weeklyFor(date: string) {
  const week = mondayOf(date), rand = seededRand(`weeklycross:${week}`);
  let best: { grid: string[]; placed: Placed[] } | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const grid = Array(SIZE * SIZE).fill(""), placed: Placed[] = [];
    const words = shuffled(Object.keys(BANK), rand);
    const first = words.find((w) => w.length >= 8 && w.length <= SIZE)!;
    const r0 = Math.floor(SIZE / 2), c0 = Math.floor((SIZE - first.length) / 2);
    [...first].forEach((ch, k) => (grid[r0 * SIZE + c0 + k] = ch));
    placed.push({ word: first, r: r0, c: c0, down: false });
    for (const w of words) {
      if (placed.length >= TARGET_WORDS) break;
      if (w === first || w.length > SIZE || placed.some((p) => p.word === w)) continue;
      // Every spot where it crosses a letter already down; keep the ones that cross most
      let opts: { r: number; c: number; down: boolean; cross: number }[] = [];
      for (let i = 0; i < SIZE * SIZE; i++) {
        if (!grid[i]) continue;
        for (let k = 0; k < w.length; k++) {
          if (w[k] !== grid[i]) continue;
          for (const down of [true, false]) {
            const r = Math.floor(i / SIZE) - (down ? k : 0), c = (i % SIZE) - (down ? 0 : k);
            const cross = tryPlace(grid, w, r, c, down);
            if (cross > 0) opts.push({ r, c, down, cross });
          }
        }
      }
      if (!opts.length) continue;
      const top = Math.max(...opts.map((o) => o.cross));
      opts = opts.filter((o) => o.cross === top);
      const o = opts[Math.floor(rand() * opts.length)];
      [...w].forEach((ch, k) => (grid[(o.r + (o.down ? k : 0)) * SIZE + o.c + (o.down ? 0 : k)] = ch));
      placed.push({ word: w, r: o.r, c: o.c, down: o.down });
    }
    if (!best || placed.length > best.placed.length) best = { grid, placed };
    if (placed.length >= TARGET_WORDS) break;
  }
  const { grid, placed } = best!;
  // Number the squares where words start, reading order, like a printed crossword
  const starts = [...new Set(placed.map((p) => p.r * SIZE + p.c))].sort((a, b) => a - b);
  const numbers = Array(SIZE * SIZE).fill(0);
  starts.forEach((i, k) => (numbers[i] = k + 1));
  const entries: WEntry[] = placed.map((p) => ({
    num: numbers[p.r * SIZE + p.c], down: p.down, answer: p.word, clue: BANK[p.word],
    cells: [...p.word].map((_, k) => (p.r + (p.down ? k : 0)) * SIZE + p.c + (p.down ? 0 : k)),
  })).sort((a, b) => Number(a.down) - Number(b.down) || a.num - b.num);
  return { week, grid, numbers, entries };
}
export const isSolved = (grid: string[], letters: string[]) => grid.every((g, i) => !g || (letters[i] ?? "").toLowerCase() === g);
