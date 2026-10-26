// Steam pipes: turn the pipe tiles until steam from the espresso machine reaches every cup, with no pipe left open.
// The pipes are a tree grown from the machine in the middle, then every tile is spun. Pure, so the page and tests share it.
import { seededRand, shuffled } from "./gameOrders.ts";

export const N = 7;
export const SOURCE = Math.floor((N * N) / 2);
export const minMs = 5000;
export const HINT_MS = 10000;
// Sides as bits: up 1, right 2, down 4, left 8
export const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
const STEP: [number, number, number, number][] = [[UP, -1, 0, DOWN], [RIGHT, 0, 1, LEFT], [DOWN, 1, 0, UP], [LEFT, 0, -1, RIGHT]];

/** Turn a tile's sides a quarter clockwise, `k` times */
export const turn = (mask: number, k: number) => { let m = mask; for (let i = 0; i < ((k % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15; return m; };
const nb = (i: number, dr: number, dc: number) => { const r = Math.floor(i / N) + dr, c = (i % N) + dc; return r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1; };

export function pipesFor(date: string): { tiles: number[]; spins: number[] } {
  const rand = seededRand(`steampipes:${date}`);
  for (;;) {
    // Grow a tree from the machine (randomised Prim's), keeping tiles to three openings at most
    const tiles = Array(N * N).fill(0), inTree = Array(N * N).fill(false);
    inTree[SOURCE] = true;
    let edges: [number, number, number][] = [];
    const addEdges = (i: number) => { for (const [bit, dr, dc] of STEP) { const j = nb(i, dr, dc); if (j >= 0 && !inTree[j]) edges.push([i, j, bit]); } };
    addEdges(SOURCE);
    let count = 1;
    while (edges.length) {
      const k = Math.floor(rand() * edges.length);
      const [i, j, bit] = edges[k];
      edges.splice(k, 1);
      if (inTree[j]) continue;
      const bits = (m: number) => [UP, RIGHT, DOWN, LEFT].filter((b) => m & b).length;
      if (bits(tiles[i]) >= 3) continue;
      const back = STEP.find((s) => s[0] === bit)![3];
      tiles[i] |= bit; tiles[j] |= back; inTree[j] = true; count++;
      addEdges(j);
      edges = edges.filter(([, jj]) => !inTree[jj]);
    }
    if (count < N * N) continue;
    // Plenty of cups (dead ends), but not a maze of nothing else
    const cups = tiles.filter((m, i) => i !== SOURCE && [UP, RIGHT, DOWN, LEFT].filter((b) => m & b).length === 1).length;
    if (cups < 8 || cups > 16) continue;
    // Spin every tile; make sure most start wrong
    const spins = tiles.map(() => Math.floor(rand() * 4));
    const wrong = tiles.filter((m, i) => turn(m, spins[i]) !== m).length;
    if (wrong < N * N * 0.6) continue;
    return { tiles, spins };
  }
}

/** The tile's sides as it's turned now: the answer turned by the starting spin plus your turns */
export const sidesNow = (tiles: number[], spins: number[], turns: number[], i: number) => turn(tiles[i], spins[i] + turns[i]);
/** Which tiles the steam reaches from the machine, and whether any pipe end is open */
export function flow(tiles: number[], spins: number[], turns: number[]) {
  const m = tiles.map((_, i) => sidesNow(tiles, spins, turns, i));
  const reached = new Set([SOURCE]), todo = [SOURCE];
  let leaks = 0;
  while (todo.length) {
    const i = todo.pop()!;
    for (const [bit, dr, dc, back] of STEP) {
      if (!(m[i] & bit)) continue;
      const j = nb(i, dr, dc);
      if (j < 0 || !(m[j] & back)) { leaks++; continue; }
      if (!reached.has(j)) { reached.add(j); todo.push(j); }
    }
  }
  return { reached, leaks };
}
/** Solved when steam reaches every tile and nothing leaks (any such way counts, even if it isn't the one we made) */
export function isSolved(tiles: number[], spins: number[], turns: number[]) {
  const f = flow(tiles, spins, turns);
  return f.leaks === 0 && f.reached.size === N * N;
}
/** A tile that's turned wrong (straight pipes and crosses look the same two ways round) */
export function wrongTiles(tiles: number[], spins: number[], turns: number[]) {
  return shuffled(tiles.flatMap((m, i) => (sidesNow(tiles, spins, turns, i) !== m ? [i] : [])), seededRand(`hint:${turns.join("")}`));
}
/** Turns needed to put tile i right */
export const fixTurns = (tiles: number[], spins: number[], turns: number[], i: number) => [0, 1, 2, 3].find((k) => turn(tiles[i], spins[i] + turns[i] + k) === tiles[i])!;
