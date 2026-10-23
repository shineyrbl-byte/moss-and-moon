// Memory match: flip cards to find pairs of café drinks and bakes. Pure, so the page and server share it.
import { seededRand } from "./gameOrders.ts";

export const MEMORY_MODES = { easy: 6, full: 8 } as const;
export type MemoryMode = keyof typeof MEMORY_MODES;
export const memoryMode = (v: unknown): MemoryMode => (v === "easy" ? "easy" : "full");
/** Quickest a real game could be: about 1.2s a pair */
export const minMs = (mode: MemoryMode) => MEMORY_MODES[mode] * 1200;

/** Today's cards: the same pictures for everyone on a day, then shuffled for this game */
export function pickItems<T extends { id: string }>(items: T[], date: string, mode: MemoryMode): T[] {
  const rand = seededRand(`memory:${date}`);
  const pool = [...items].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, MEMORY_MODES[mode]);
}
export function deal<T>(items: T[], rand = Math.random): { key: number; item: T }[] {
  const cards = [...items, ...items].map((item, i) => ({ key: i, item }));
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}
export const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
