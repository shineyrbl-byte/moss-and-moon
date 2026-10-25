// Bean sweeper: Minesweeper with spilled beans. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const SWEEP_MODES = { easy: { w: 8, h: 8, beans: 10 }, hard: { w: 10, h: 12, beans: 22 } } as const;
export type SweepMode = keyof typeof SWEEP_MODES;
export const sweepMode = (v: unknown): SweepMode => (v === "hard" ? "hard" : "easy");
export const minMs = (mode: SweepMode) => (mode === "easy" ? 4000 : 10000);

export function neighbours(p: number, w: number, h: number) {
  const r = Math.floor(p / w), c = p % w, out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const y = r + dr, x = c + dc;
    if (y >= 0 && y < h && x >= 0 && x < w) out.push(y * w + x);
  }
  return out;
}
/** Today's beans, placed after your first tap so it (and the squares around it) are always safe */
export function layBeans(date: string, mode: SweepMode, first: number) {
  const { w, h, beans } = SWEEP_MODES[mode];
  const rand = seededRand(`sweeper:${date}:${mode}:${first}`);
  const safe = new Set([first, ...neighbours(first, w, h)]);
  const spots = [...Array(w * h).keys()].filter((p) => !safe.has(p));
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  return new Set(spots.slice(0, beans));
}
/** How many beans touch each square */
export const countsOf = (beans: Set<number>, w: number, h: number) => [...Array(w * h).keys()].map((p) => neighbours(p, w, h).filter((q) => beans.has(q)).length);
/** Open a square; empty ones open their neighbours too. Returns the newly opened squares. */
export function reveal(p: number, beans: Set<number>, counts: number[], open: Set<number>, w: number, h: number) {
  const out = new Set<number>(), todo = [p];
  while (todo.length) {
    const q = todo.pop()!;
    if (open.has(q) || out.has(q)) continue;
    out.add(q);
    if (!beans.has(q) && counts[q] === 0) todo.push(...neighbours(q, w, h));
  }
  return out;
}
export const isCleared = (open: Set<number>, beans: Set<number>, w: number, h: number) => open.size === w * h - beans.size && [...beans].every((b) => !open.has(b));
