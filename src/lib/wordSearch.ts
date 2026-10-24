// Daily word search: 8 café words hidden in a 10×10 grid. Pure, so the page, server and tests share it.
import { seededRand } from "./gameOrders.ts";

export const SIZE = 10;
export const HIDDEN = 8;
/** Quickest a real find-them-all could be */
export const minMs = HIDDEN * 1500;
export const WS_WORDS = [
  "LATTE", "MOCHA", "ESPRESSO", "CORTADO", "CHAI", "MATCHA", "CROISSANT", "MUFFIN", "COOKIE", "BROWNIE",
  "SCONE", "BAGEL", "CREMA", "FOAM", "BEANS", "ROAST", "GRINDER", "KETTLE", "SAUCER", "MUG",
  "SPOON", "SUGAR", "HONEY", "CINNAMON", "CARDAMOM", "OATMILK", "ICED", "COLDBREW", "AFFOGATO", "WAFFLE",
  "PANCAKE", "TOAST", "JAM", "BUTTER", "CARAMEL", "VANILLA", "COCOA", "TEAPOT", "STEAM", "BARISTA",
  "MOON", "MOSS", "FERN", "PLANT", "BOOK", "CANDLE", "WINDOW", "SOFA", "PUPPY", "MONSOON",
  "BEACH", "SUNSET", "PALM", "MANGO", "COCONUT", "KOKUM", "BEBINCA", "JAGGERY", "LASSI", "FILTER",
];
// Right, down, down-right, up-right: always read forwards, so it stays friendly
const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [-1, 1]];
export type Placed = { word: string; cells: number[] };

/** Today's puzzle: the same grid for everyone on a day */
export function wordSearchFor(date: string): { grid: string[]; words: Placed[] } {
  for (let attempt = 0; ; attempt++) {
    const rand = seededRand(`wordsearch:${date}:${attempt}`);
    const pool = [...WS_WORDS];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const grid: (string | null)[] = Array(SIZE * SIZE).fill(null);
    const words: Placed[] = [];
    for (const word of pool) {
      if (words.length === HIDDEN) break;
      // No word hidden inside another (MOSS and MOSSY style mix-ups)
      if (words.some((w) => w.word.includes(word) || word.includes(w.word))) continue;
      for (let t = 0; t < 60; t++) {
        // Take turns with the directions, so there's a mix of across, down and diagonal
        const [dr, dc] = DIRS[(words.length + Math.floor(t / 15)) % DIRS.length];
        const r0 = Math.floor(rand() * SIZE), c0 = Math.floor(rand() * SIZE);
        const cells = [...word].map((_, i) => [r0 + dr * i, c0 + dc * i]);
        if (cells.some(([r, c]) => r < 0 || r >= SIZE || c < 0 || c >= SIZE)) continue;
        const idx = cells.map(([r, c]) => r * SIZE + c);
        if (idx.some((p, i) => grid[p] !== null && grid[p] !== word[i])) continue;
        idx.forEach((p, i) => (grid[p] = word[i]));
        words.push({ word, cells: idx });
        break;
      }
    }
    if (words.length < HIDDEN) continue;
    const ABC = "ABCDEFGHIJKLMNOPRSTUVWY"; // fewer odd letters, so the grid looks like a café wrote it
    const filled = grid.map((l) => l ?? ABC[Math.floor(rand() * ABC.length)]);
    // Each word must appear exactly once, or a guest could find the "wrong" copy
    if (words.every((w) => countIn(filled, w.word) === 1)) return { grid: filled, words: words.sort((a, b) => a.word.localeCompare(b.word)) };
  }
}

/** Cells from one cell to another in a straight line (row, column or diagonal), or null */
export function lineBetween(a: number, b: number): number[] | null {
  const ra = Math.floor(a / SIZE), ca = a % SIZE, rb = Math.floor(b / SIZE), cb = b % SIZE;
  const dr = Math.sign(rb - ra), dc = Math.sign(cb - ca);
  const len = Math.max(Math.abs(rb - ra), Math.abs(cb - ca));
  if (!(ra === rb || ca === cb || Math.abs(rb - ra) === Math.abs(cb - ca))) return null;
  return [...Array(len + 1).keys()].map((i) => (ra + dr * i) * SIZE + ca + dc * i);
}
/** The hidden word a line spells, read either way */
export function wordAt(words: Placed[], cells: number[]) {
  const key = cells.join(","), back = [...cells].reverse().join(",");
  return words.find((w) => w.cells.join(",") === key || w.cells.join(",") === back)?.word ?? null;
}

function countIn(grid: string[], word: string) {
  let n = 0;
  const all: [number, number][] = [...DIRS, ...DIRS.map(([r, c]) => [-r, -c] as [number, number])];
  for (let p = 0; p < grid.length; p++) for (const [dr, dc] of all) {
    let ok = true;
    for (let i = 0; i < word.length && ok; i++) {
      const r = Math.floor(p / SIZE) + dr * i, c = (p % SIZE) + dc * i;
      ok = r >= 0 && r < SIZE && c >= 0 && c < SIZE && grid[r * SIZE + c] === word[i];
    }
    if (ok) n++;
  }
  return word === [...word].reverse().join("") ? n / 2 : n;
}
