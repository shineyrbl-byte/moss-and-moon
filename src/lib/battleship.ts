// Battleship against the computer: each of you hides a fleet on a 10×10 sea and takes turns firing. First to sink the
// whole fleet wins. Easy fires at random; hard hunts in a checkerboard and follows up hits. Pure.
import { shuffled } from "./gameOrders.ts";
import { makeGrid } from "./grid.ts";

export const N = 10, FLEET = [5, 4, 3, 3, 2];
export const SHIP_NAMES = ["Espresso machine", "Coffee cart", "Delivery van", "Tuk-tuk", "Bicycle"];
export type Board = { ships: number[][]; shots: boolean[] };
export type Level = "easy" | "hard";
const G = makeGrid(N), { rowOf, colOf } = G;
const side = G.side;

/** Hide a fleet at random (ships may sit side by side but never overlap) */
export function hide(rand: () => number): number[][] {
  for (;;) {
    const used = new Set<number>(), ships: number[][] = [];
    let ok = true;
    for (const len of FLEET) {
      const spots: number[][] = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (c + len <= N) spots.push([...Array(len).keys()].map((k) => r * N + c + k));
        if (r + len <= N) spots.push([...Array(len).keys()].map((k) => (r + k) * N + c));
      }
      const free = spots.filter((s) => s.every((i) => !used.has(i)));
      if (!free.length) { ok = false; break; }
      const pick = free[Math.floor(rand() * free.length)];
      pick.forEach((i) => used.add(i)); ships.push(pick);
    }
    if (ok) return ships;
  }
}
export const newBoard = (rand: () => number): Board => ({ ships: hide(rand), shots: Array(N * N).fill(false) });
export const shipAt = (b: Board, i: number) => b.ships.findIndex((s) => s.includes(i));
export const sunk = (b: Board, k: number) => b.ships[k].every((i) => b.shots[i]);
export const allSunk = (b: Board) => b.ships.every((_, k) => sunk(b, k));
/** Fire at a square: was it a hit, and did it sink something? */
export function fire(b: Board, i: number): { b: Board; hit: boolean; sank: number | null } | null {
  if (b.shots[i]) return null;
  const shots = [...b.shots]; shots[i] = true;
  const nb = { ...b, shots }, k = shipAt(nb, i);
  return { b: nb, hit: k >= 0, sank: k >= 0 && sunk(nb, k) ? k : null };
}
/** Where the computer fires next at your board */
export function aim(b: Board, level: Level, rand: () => number): number {
  const open = [...Array(N * N).keys()].filter((i) => !b.shots[i]);
  if (level === "easy") return open[Math.floor(rand() * open.length)];
  // Hits on ships not yet sunk: try next to them, in line with other hits if there are any
  const live = [...Array(N * N).keys()].filter((i) => b.shots[i] && shipAt(b, i) >= 0 && !sunk(b, shipAt(b, i)));
  if (live.length) {
    const inLine = live.flatMap((i) => side(i).filter((j) => !b.shots[j] && live.some((h) => h !== i && (rowOf(h) === rowOf(i) && rowOf(j) === rowOf(i) || colOf(h) === colOf(i) && colOf(j) === colOf(i)))));
    const near = inLine.length ? inLine : live.flatMap((i) => side(i).filter((j) => !b.shots[j]));
    if (near.length) return near[Math.floor(rand() * near.length)];
  }
  // Otherwise a checkerboard: every ship covers at least one dark square
  const dark = shuffled(open.filter((i) => (rowOf(i) + colOf(i)) % 2 === 0), rand);
  return dark[0] ?? open[Math.floor(rand() * open.length)];
}
