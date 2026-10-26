// Five in a row: take turns putting a cup on the tablecloth; five (or more) in a line across, down or diagonally wins.
// The computer weighs every 5-long stretch of cloth each square sits in. Pure, so the page and tests share it.
export const N = 13;
export type Side = 0 | 1; // 0 you (pink), 1 the computer
export type Cell = Side | null;
export type Level = "easy" | "hard";
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;

export const empty = (): Cell[] => Array(N * N).fill(null);

/** The five-in-a-row line through `at`, if placing there made one */
export function winLine(b: Cell[], at: number): number[] | null {
  const side = b[at];
  if (side === null) return null;
  const r0 = Math.floor(at / N), c0 = at % N;
  for (const [dr, dc] of DIRS) {
    const line = [at];
    for (const s of [1, -1]) for (let k = 1; ; k++) {
      const r = r0 + dr * k * s, c = c0 + dc * k * s;
      if (r < 0 || r >= N || c < 0 || c >= N || b[r * N + c] !== side) break;
      line.push(r * N + c);
    }
    if (line.length >= 5) return line.sort((a, b) => a - b);
  }
  return null;
}
export const full = (b: Cell[]) => b.every((x) => x !== null);

// How much a stretch of five is worth once it holds this many of one side's cups (and none of the other's)
const WORTH = [0, 1, 12, 160, 3000, 1_000_000];

/** What putting `side`'s cup at `at` would be worth to that side */
function value(b: Cell[], at: number, side: Side) {
  const r0 = Math.floor(at / N), c0 = at % N;
  let total = 0, fours = 0, threes = 0;
  for (const [dr, dc] of DIRS) {
    let bestHere = 0;
    for (let off = -4; off <= 0; off++) {
      let mine = 1, ok = true;
      for (let k = off; k < off + 5; k++) {
        if (k === 0) continue;
        const r = r0 + dr * k, c = c0 + dc * k;
        if (r < 0 || r >= N || c < 0 || c >= N) { ok = false; break; }
        const x = b[r * N + c];
        if (x === side) mine++; else if (x !== null) { ok = false; break; }
      }
      if (!ok) continue;
      total += WORTH[mine];
      bestHere = Math.max(bestHere, mine);
    }
    if (bestHere === 4) fours++;
    if (bestHere === 3) threes++;
  }
  // Two threats at once can't both be blocked
  if (fours >= 2 || (fours && threes)) total += 40_000;
  else if (threes >= 2) total += 2_500;
  return total;
}

/** Empty squares within two of a cup (or the middle, on an empty cloth) */
export function candidates(b: Cell[]): number[] {
  if (b.every((x) => x === null)) return [Math.floor(N / 2) * N + Math.floor(N / 2)];
  const out: number[] = [];
  for (let i = 0; i < N * N; i++) {
    if (b[i] !== null) continue;
    const r = Math.floor(i / N), c = i % N;
    let near = false;
    for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2 && !near; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc] !== null) near = true;
    }
    if (near) out.push(i);
  }
  return out;
}

/** The computer's move. `rand` picks between near-equal moves so games differ. */
export function bestMove(b: Cell[], side: Side, level: Level, rand: () => number = Math.random): number {
  const foe = (1 - side) as Side;
  const cands = candidates(b);
  const scored = cands.map((i) => {
    const attack = value(b, i, side), defend = value(b, i, foe);
    // Hard defends nearly as keenly as it attacks; easy mostly thinks about itself
    const s = level === "hard" ? attack * 1.1 + defend : attack + defend * 0.35;
    return { i, s: s * (1 + rand() * (level === "hard" ? 0.02 : 0.6)) };
  }).sort((x, y) => y.s - x.s);
  // Always take a win, and hard always blocks one
  const win = cands.find((i) => value(b, i, side) >= 1_000_000);
  if (win !== undefined) return win;
  if (level === "hard") {
    const block = cands.find((i) => value(b, i, foe) >= 1_000_000);
    if (block !== undefined) return block;
  }
  if (level === "easy" && scored.length > 3 && rand() < 0.3) return scored[1 + Math.floor(rand() * 2)].i;
  return scored[0].i;
}

export function play(b: Cell[], at: number, side: Side): Cell[] | null {
  if (at < 0 || at >= N * N || b[at] !== null) return null;
  const n = [...b]; n[at] = side;
  return n;
}
