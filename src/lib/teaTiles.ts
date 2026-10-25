// Tea tiles: a mahjong-style matching game with café tiles. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const minMs = 20000;
export const SHUFFLE_MS = 15000;
export const FACES = ["☕", "🍵", "🧋", "🥐", "🍩", "🍪", "🧁", "🍰", "🥧", "🍫", "🍯", "🥛", "🫖", "🍓", "🍋"];
export type Spot = { x: number; y: number; z: number };
export type Tile = Spot & { id: number; face: number };

/** Three layers: 8×5 on the table, 6×3 on top, then two in the middle. 60 tiles. */
export const LAYOUT: Spot[] = [
  ...[...Array(40).keys()].map((i) => ({ x: i % 8, y: Math.floor(i / 8), z: 0 })),
  ...[...Array(18).keys()].map((i) => ({ x: 1 + (i % 6), y: 1 + Math.floor(i / 6), z: 1 })),
  { x: 3, y: 2, z: 2 }, { x: 4, y: 2, z: 2 },
];
export const COLS = 8, ROWS = 5;

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
/** Free = nothing on top, and the left or right side is open */
export function freeSpots(spots: Spot[]) {
  const at = new Set(spots.map((s) => key(s.x, s.y, s.z)));
  return spots.filter((s) => !at.has(key(s.x, s.y, s.z + 1)) && (!at.has(key(s.x - 1, s.y, s.z)) || !at.has(key(s.x + 1, s.y, s.z))));
}
export const isFree = (t: Spot, tiles: Spot[]) => freeSpots(tiles).some((s) => s.x === t.x && s.y === t.y && s.z === t.z);

/**
 * Deals faces so there's always a way to clear the table: take the pile apart two free tiles at a time,
 * giving each pair the next face. Playing that order backwards clears it.
 */
export function deal(spots: Spot[], pairFaces: number[], rand: () => number): Tile[] {
  for (let tries = 0; tries < 500; tries++) {
    const left = [...spots], out: Tile[] = [];
    let ok = true;
    for (const face of pairFaces) {
      const free = freeSpots(left);
      if (free.length < 2) { ok = false; break; }
      const a = free.splice(Math.floor(rand() * free.length), 1)[0], b = free[Math.floor(rand() * free.length)];
      for (const s of [a, b]) { left.splice(left.indexOf(s), 1); out.push({ ...s, id: 0, face }); }
    }
    if (ok) return out.sort((p, q) => p.z - q.z || p.y - q.y || p.x - q.x).map((t, i) => ({ ...t, id: i }));
  }
  throw new Error("Couldn't deal the tiles");
}

export function tilesFor(date: string) {
  const rand = seededRand(`tiles:${date}`);
  const faces = [...Array(LAYOUT.length / 2).keys()].map((i) => i % FACES.length);
  for (let i = faces.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [faces[i], faces[j]] = [faces[j], faces[i]]; }
  return deal(LAYOUT, faces, rand);
}

/** Two free tiles with the same face, or null if you're stuck */
export function hintPair(tiles: Tile[]): [Tile, Tile] | null {
  const free = freeSpots(tiles) as Tile[];
  for (let i = 0; i < free.length; i++) for (let k = i + 1; k < free.length; k++) if (free[i].face === free[k].face) return [free[i], free[k]];
  return null;
}

/** Re-deal what's left so it can still be cleared (ids stay with their spots) */
export function reshuffle(tiles: Tile[], rand: () => number): Tile[] {
  const counts = new Map<number, number>();
  for (const t of tiles) counts.set(t.face, (counts.get(t.face) ?? 0) + 1);
  const pairFaces: number[] = [];
  for (const [f, n] of counts) for (let i = 0; i < n / 2; i++) pairFaces.push(f);
  for (let i = pairFaces.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pairFaces[i], pairFaces[j]] = [pairFaces[j], pairFaces[i]]; }
  const dealt = deal(tiles, pairFaces, rand);
  const byKey = new Map(dealt.map((t) => [key(t.x, t.y, t.z), t.face]));
  return tiles.map((t) => ({ ...t, face: byKey.get(key(t.x, t.y, t.z))! }));
}
