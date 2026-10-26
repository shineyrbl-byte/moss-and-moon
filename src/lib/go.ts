// Café go: 9×9 Go against the computer. Take turns placing stones; a group with no empty points next to it is captured. No
// playing where your own stones would have no breathing room (unless it captures), and no move that repeats the board just
// before (ko). Two passes in a row end the game: stones plus the empty areas you surround, with 6.5 extra for white.
// Pure, so the page and tests share it.
export const N = 9;
export const KOMI = 6.5;
export type Stone = 0 | 1 | 2; // empty, black (you), white (the computer)
export type Level = "easy" | "hard";
export type State = { b: Stone[]; turn: 1 | 2; prev: string | null; passes: number; caps: [number, number]; moves: number; last: number | null; over: boolean };

export const newGame = (): State => ({ b: Array(N * N).fill(0), turn: 1, prev: null, passes: 0, caps: [0, 0], moves: 0, last: null, over: false });
export const nextTo = (i: number) => { const r = Math.floor(i / N), c = i % N; return [r > 0 ? i - N : -1, r < N - 1 ? i + N : -1, c > 0 ? i - 1 : -1, c < N - 1 ? i + 1 : -1].filter((j) => j >= 0); };
export function group(b: Stone[], i: number) {
  const col = b[i], stones = [i], seen = new Set([i]), libs = new Set<number>();
  for (let k = 0; k < stones.length; k++) for (const j of nextTo(stones[k])) {
    if (b[j] === 0) libs.add(j);
    else if (b[j] === col && !seen.has(j)) { seen.add(j); stones.push(j); }
  }
  return { stones, libs };
}
/** Place a stone, or null if it isn't allowed */
export function play(s: State, i: number): State | null {
  if (s.over || s.b[i] !== 0) return null;
  const me = s.turn, foe = (3 - me) as 1 | 2, b = [...s.b];
  b[i] = me;
  let took = 0;
  for (const j of nextTo(i)) if (b[j] === foe) { const g = group(b, j); if (!g.libs.size) { g.stones.forEach((x) => { b[x] = 0; }); took += g.stones.length; } }
  if (!group(b, i).libs.size) return null; // no breathing room
  const key = b.join("");
  if (key === s.prev) return null; // ko
  const caps: [number, number] = [...s.caps]; caps[me - 1] += took;
  return { b, turn: foe, prev: s.b.join(""), passes: 0, caps, moves: s.moves + 1, last: i, over: false };
}
export const pass = (s: State): State => ({ ...s, turn: (3 - s.turn) as 1 | 2, prev: s.b.join(""), passes: s.passes + 1, last: null, over: s.passes + 1 >= 2 });
/** Area scoring: stones on the board plus empty areas touching only one colour */
export function score(b: Stone[]): { black: number; white: number; area: Stone[] } {
  const area: Stone[] = [...b], seen = new Set<number>();
  for (let i = 0; i < N * N; i++) {
    if (b[i] || seen.has(i)) continue;
    const region = [i], borders = new Set<number>(); seen.add(i);
    for (let k = 0; k < region.length; k++) for (const j of nextTo(region[k])) { if (b[j]) borders.add(b[j]); else if (!seen.has(j)) { seen.add(j); region.push(j); } }
    if (borders.size === 1) { const owner = [...borders][0] as Stone; region.forEach((x) => { area[x] = owner; }); }
  }
  return { black: area.filter((x) => x === 1).length, white: area.filter((x) => x === 2).length + KOMI, area };
}
/** A point that's an eye for `col`: all its neighbours are that colour (so filling it would be silly) */
const ownEye = (b: Stone[], i: number, col: Stone) => b[i] === 0 && nextTo(i).every((j) => b[j] === col);

/** The computer's move, or null to pass */
export function bestMove(s: State, level: Level, rand: () => number = Math.random): number | null {
  const me = s.turn, foe = (3 - me) as 1 | 2;
  const base = score(s.b), mineNow = me === 1 ? base.black : base.white;
  const options: { i: number; v: number }[] = [];
  for (let i = 0; i < N * N; i++) {
    if (s.b[i] || ownEye(s.b, i, me)) continue;
    const t = play(s, i);
    if (!t) continue;
    const took = t.caps[me - 1] - s.caps[me - 1];
    const g = group(t.b, i);
    let v = took * 40;
    if (g.libs.size === 1 && !took) v -= 60; // walking into a capture
    // Rescuing a group of ours that was down to one breath
    for (const j of nextTo(i)) if (s.b[j] === me && group(s.b, j).libs.size === 1 && g.libs.size >= 2) v += 35 + group(s.b, j).stones.length * 8;
    // Squeezing theirs
    for (const j of nextTo(i)) if (t.b[j] === foe && group(t.b, j).libs.size === 1) v += 18;
    const sc = score(t.b);
    v += ((me === 1 ? sc.black : sc.white) - mineNow) * (level === "hard" ? 2.2 : 1);
    // Early on, the third and fourth lines are best; the edge is worst
    const r = Math.floor(i / N), c = i % N, edge = Math.min(r, c, N - 1 - r, N - 1 - c);
    if (s.moves < 20) v += [-6, 0, 4, 3, 2][edge] ?? 0;
    v += rand() * (level === "hard" ? 3 : 25);
    options.push({ i, v });
  }
  if (!options.length) return null;
  options.sort((a, b) => b.v - a.v);
  const best = options[0];
  // Nothing worth doing (only filling our own area): pass, especially if the other side just did
  if (best.v < (s.passes ? 4 : 1.5) && s.moves > 30) return null;
  if (level === "easy" && rand() < 0.25) return options[Math.floor(rand() * Math.min(6, options.length))].i;
  return best.i;
}
