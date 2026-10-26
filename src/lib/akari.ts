// Window seats: put lamps in the café so every open square is lit. A lamp lights its row and column until a wall stops it.
// No lamp may shine on another, and a numbered wall has exactly that many lamps right next to it. Each day's café has
// exactly one answer. Pure, so the page and tests share it.
import { seededRand, shuffled } from "./gameOrders.ts";

export const N = 7;
export const minMs = 6000;
export const HINT_MS = 10000;
/** A wall: -1 is a plain wall, 0 to 4 a numbered one. null is an open square. */
export type Cell = number | null;
export type Mark = 0 | 1 | 2; // open squares: 0 empty, 1 crossed off, 2 lamp

const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;
export const nextTo = (i: number) => DIRS.map(([dr, dc]) => [Math.floor(i / N) + dr, (i % N) + dc]).filter(([r, c]) => r >= 0 && r < N && c >= 0 && c < N).map(([r, c]) => r * N + c);
/** The open squares a lamp at i lights up (including its own) */
export function lit(walls: Cell[], i: number): number[] {
  const out = [i];
  for (const [dr, dc] of DIRS) for (let r = Math.floor(i / N) + dr, c = (i % N) + dc; r >= 0 && r < N && c >= 0 && c < N && walls[r * N + c] === null; r += dr, c += dc) out.push(r * N + c);
  return out;
}

/** Up to `limit` answers, as sets of lamp squares */
export function answers(walls: Cell[], limit = 2): number[][] {
  const open = walls.flatMap((w, i) => (w === null ? [i] : []));
  const sees = walls.map((w, i) => (w === null ? lit(walls, i) : []));
  const lamp = Array(N * N).fill(false), banned = Array(N * N).fill(0), litBy = Array(N * N).fill(0);
  const nums = walls.flatMap((w, i) => (w !== null && w >= 0 ? [i] : []));
  const out: number[][] = [];
  const canLamp = (i: number) => !lamp[i] && !banned[i] && litBy[i] === 0 && nextTo(i).every((j) => walls[j] === null || walls[j]! < 0 || nextTo(j).filter((k) => lamp[k]).length < walls[j]!);
  const numbersOk = (final: boolean) => nums.every((w) => {
    const ns = nextTo(w), have = ns.filter((k) => lamp[k]).length;
    if (final) return have === walls[w];
    const could = ns.filter((k) => !lamp[k] && canLamp(k)).length;
    return have <= walls[w]! && have + could >= walls[w]!;
  });
  const place = (i: number, on: boolean) => { lamp[i] = on; for (const j of sees[i]) litBy[j] += on ? 1 : -1; };
  const go = () => {
    if (out.length >= limit) return;
    if (!numbersOk(false)) return;
    // The dark square with fewest ways to light it
    let best = -1, bestOpts: number[] = [];
    for (const i of open) {
      if (litBy[i]) continue;
      const opts = sees[i].filter(canLamp);
      if (!opts.length) return;
      if (best < 0 || opts.length < bestOpts.length) { best = i; bestOpts = opts; }
    }
    if (best < 0) { if (numbersOk(true)) out.push(open.filter((i) => lamp[i])); return; }
    // Try each way, and rule it out for the later branches so no answer is counted twice
    const tried: number[] = [];
    for (const o of bestOpts) {
      if (!canLamp(o)) continue;
      place(o, true);
      go();
      place(o, false);
      banned[o]++; tried.push(o);
      if (out.length >= limit) break;
    }
    tried.forEach((o) => banned[o]--);
  };
  go();
  return out;
}

export function seatsFor(date: string): { walls: Cell[]; lamps: number[] } {
  const rand = seededRand(`windowseats:${date}`);
  for (;;) {
    // Walls, looking the same turned upside down
    const walls: Cell[] = Array(N * N).fill(null);
    for (let k = 0; k < 8; k++) { const i = Math.floor(rand() * N * N); walls[i] = -1; walls[N * N - 1 - i] = -1; }
    const open = walls.flatMap((w, i) => (w === null ? [i] : []));
    // Light it up: keep putting a lamp on a random dark square that no lamp sees
    const lamps: number[] = [], litSet = new Set<number>();
    for (const i of shuffled(open, rand)) {
      if (litSet.has(i)) continue;
      lamps.push(i); lit(walls, i).forEach((j) => litSet.add(j));
    }
    // Number every wall, then take numbers away while there's still one answer
    const full = walls.map((w, i) => (w === null ? null : nextTo(i).filter((j) => lamps.includes(j)).length));
    if (answers(full).length !== 1) continue;
    const puzzle = [...full];
    for (const i of shuffled(full.flatMap((w, k) => (w !== null ? [k] : [])), rand)) {
      const keep = puzzle[i];
      puzzle[i] = -1;
      if (answers(puzzle).length !== 1) puzzle[i] = keep;
    }
    return { walls: puzzle, lamps: lamps.sort((a, b) => a - b) };
  }
}
/** Lamps that shine on another lamp, and numbered walls with too many lamps */
export function problems(walls: Cell[], marks: Mark[]): { lamps: Set<number>; walls: Set<number> } {
  const lampsAt = marks.flatMap((m, i) => (m === 2 ? [i] : []));
  const bad = new Set<number>(), badWalls = new Set<number>();
  for (const a of lampsAt) if (lit(walls, a).some((j) => j !== a && marks[j] === 2)) bad.add(a);
  walls.forEach((w, i) => { if (w !== null && w >= 0 && nextTo(i).filter((j) => marks[j] === 2).length > w) badWalls.add(i); });
  return { lamps: bad, walls: badWalls };
}
export function litSquares(walls: Cell[], marks: Mark[]) {
  const s = new Set<number>();
  marks.forEach((m, i) => { if (m === 2) lit(walls, i).forEach((j) => s.add(j)); });
  return s;
}
export function isSolved(walls: Cell[], marks: Mark[]) {
  const p = problems(walls, marks), l = litSquares(walls, marks);
  return !p.lamps.size && walls.every((w, i) => (w === null ? l.has(i) : w < 0 || nextTo(i).filter((j) => marks[j] === 2).length === w));
}
export const nextMark = (m: Mark): Mark => (m === 0 ? 2 : m === 2 ? 1 : 0); // tap: lamp, then a cross, then empty
