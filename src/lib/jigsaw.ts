// Café jigsaw: put a menu photo back together. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const JIGSAW_MODES = { small: { cols: 3, rows: 4 }, medium: { cols: 4, rows: 6 }, large: { cols: 6, rows: 8 } } as const;
export type JigsawMode = keyof typeof JIGSAW_MODES;
export const jigsawMode = (v: unknown): JigsawMode => (v === "medium" || v === "large" ? v : "small");
export const minMs = (m: JigsawMode) => ({ small: 5000, medium: 12000, large: 25000 })[m];
export const pieceCount = (m: JigsawMode) => JIGSAW_MODES[m].cols * JIGSAW_MODES[m].rows;

/** Today's photo: one of the menu's Unsplash photos (uploaded photos are left out), the same for everyone */
export function photoFor<T extends { id: string; img: string }>(date: string, items: T[]): T | null {
  const pool = items.filter((m) => m.img && !m.img.startsWith("/") && !m.img.startsWith("http")).sort((a, b) => a.id.localeCompare(b.id));
  return pool.length ? pool[Math.floor(seededRand(`jigsaw:${date}`)() * pool.length)] : null;
}
/** The tray order: shuffled, and never already in order */
export function trayOrder(n: number, rand: () => number) {
  const a = [...Array(n).keys()];
  do { for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } } while (n > 1 && a.every((v, i) => v === i));
  return a;
}
/** Where a piece's slice of the photo sits, as CSS background-position percentages */
export function piecePos(piece: number, mode: JigsawMode) {
  const { cols, rows } = JIGSAW_MODES[mode];
  const c = piece % cols, r = Math.floor(piece / cols);
  return { x: cols > 1 ? (c / (cols - 1)) * 100 : 0, y: rows > 1 ? (r / (rows - 1)) * 100 : 0 };
}
