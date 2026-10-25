// Sink the saucers: battleship against the café computer, with tableware for ships. Pure, so the page and tests share it.
export const SIZE = 8;
export const FLEET = [
  { name: "Tea tray", len: 4, emoji: "🫖" },
  { name: "Cake stand", len: 3, emoji: "🎂" },
  { name: "Milk jug", len: 3, emoji: "🥛" },
  { name: "Saucer", len: 2, emoji: "🛸" },
  { name: "Cup", len: 2, emoji: "☕" },
];
export type Ship = { cells: number[] };
export type Shot = "miss" | "hit" | "sunk";

const near = (a: number, b: number) => Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) <= 1 && Math.abs((a % SIZE) - (b % SIZE)) <= 1;
/** Every way a ship of this length fits on the grid */
export function placements(len: number): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (c + len <= SIZE) out.push([...Array(len).keys()].map((k) => r * SIZE + c + k));
    if (r + len <= SIZE && len > 1) out.push([...Array(len).keys()].map((k) => (r + k) * SIZE + c));
  }
  return out;
}
/** Ships go anywhere, but never touch, not even at the corners */
export function placeFleet(rand: () => number = Math.random): Ship[] {
  for (;;) {
    const ships: Ship[] = [];
    for (const s of FLEET) {
      const ok = placements(s.len).filter((p) => p.every((c) => ships.every((o) => o.cells.every((x) => !near(x, c)))));
      if (!ok.length) break;
      ships.push({ cells: ok[Math.floor(rand() * ok.length)] });
    }
    if (ships.length === FLEET.length) return ships;
  }
}
export const shipAt = (ships: Ship[], cell: number) => ships.findIndex((s) => s.cells.includes(cell));
export function shoot(ships: Ship[], shots: number[], cell: number): Shot {
  const k = shipAt(ships, cell);
  if (k < 0) return "miss";
  return ships[k].cells.every((c) => c === cell || shots.includes(c)) ? "sunk" : "hit";
}
export const isSunk = (s: Ship, shots: number[]) => s.cells.every((c) => shots.includes(c));
export const allSunk = (ships: Ship[], shots: number[]) => ships.every((s) => isSunk(s, shots));

/**
 * The computer's next shot. Easy picks at random. Hard counts every way the ships it hasn't sunk
 * could still fit, leans hard towards spots next to a hit, and fires at the likeliest square.
 */
export function aiShot(ships: Ship[], shots: number[], level: "easy" | "hard", rand: () => number = Math.random): number {
  const open = [...Array(SIZE * SIZE).keys()].filter((c) => !shots.includes(c));
  if (level === "easy") return open[Math.floor(rand() * open.length)];
  const sunk = ships.filter((s) => isSunk(s, shots));
  const sunkCells = sunk.flatMap((s) => s.cells);
  const misses = shots.filter((c) => shipAt(ships, c) < 0);
  const hits = shots.filter((c) => shipAt(ships, c) >= 0 && !sunkCells.includes(c));
  const left = FLEET.filter((_, i) => !isSunk(ships[i], shots));
  const heat = Array(SIZE * SIZE).fill(0);
  for (const s of left) for (const p of placements(s.len)) {
    if (p.some((c) => misses.includes(c) || sunkCells.some((x) => near(x, c)))) continue;
    const covered = p.filter((c) => hits.includes(c)).length;
    for (const c of p) if (!shots.includes(c)) heat[c] += covered ? 50 * covered : 1;
  }
  let best = open[0], bv = -1;
  for (const c of open) { const v = heat[c] + rand() * 0.5; if (v > bv) { bv = v; best = c; } }
  return best;
}
