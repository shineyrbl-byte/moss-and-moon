// Café ludo: you and three computer players race four counters each round the board and home. Roll a 6 to bring a counter
// out (and roll again). Land on someone else's counter to send it back, except on the safe squares. Exact roll to get home.
// Pure, so the page and tests share it.
export type Level = "easy" | "hard";
/** A counter's progress: -1 in its yard, 0..50 round the track (from its own start), 51..56 up its home lane, 57 home */
export type State = { pos: number[][]; turn: number; roll: number | null; sixes: number; winner: number | null; last: { p: number; t: number } | null };
export const PLAYERS = 4, HOME = 57;
export const STARTS = [0, 13, 26, 39];
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Where track square k (0..51) is on the 15×15 board */
export const TRACK: [number, number][] = (() => {
  const out: [number, number][] = [];
  const run = (r: number, c: number, dr: number, dc: number, n: number) => { for (let i = 0; i < n; i++) out.push([r + dr * i, c + dc * i]); };
  run(6, 1, 0, 1, 5); run(5, 6, -1, 0, 6); out.push([0, 7]); run(0, 8, 1, 0, 6); run(6, 9, 0, 1, 6); out.push([7, 14]);
  run(8, 14, 0, -1, 6); run(9, 8, 1, 0, 6); out.push([14, 7]); run(14, 6, -1, 0, 6); run(8, 5, 0, -1, 6); out.push([7, 0], [6, 0]);
  return out;
})();
/** Each player's home lane, nearest the track first */
export const LANES: [number, number][][] = [
  [1, 2, 3, 4, 5, 6].map((c) => [7, c] as [number, number]),
  [1, 2, 3, 4, 5, 6].map((r) => [r, 7] as [number, number]),
  [13, 12, 11, 10, 9, 8].map((c) => [7, c] as [number, number]),
  [13, 12, 11, 10, 9, 8].map((r) => [r, 7] as [number, number]),
];
export const trackOf = (p: number, step: number) => (STARTS[p] + step) % 52;
/** Board square for a counter, or null in the yard / home */
export function cellOf(p: number, step: number): [number, number] | null {
  if (step < 0 || step >= HOME) return null;
  return step <= 50 ? TRACK[trackOf(p, step)] : LANES[p][step - 51];
}

export const newGame = (): State => ({ pos: [...Array(PLAYERS)].map(() => [-1, -1, -1, -1]), turn: 0, roll: null, sixes: 0, winner: null, last: null });
export const rollDie = (s: State, rand: () => number = Math.random): State => ({ ...s, roll: 1 + Math.floor(rand() * 6) });
/** Counters the current player can move with this roll */
export function movable(s: State): number[] {
  if (s.roll === null) return [];
  return s.pos[s.turn].flatMap((step, t) => ((step === -1 ? s.roll === 6 : step + s.roll! <= HOME) && step < HOME ? [t] : []));
}
/** Move a counter (or pass if none can move) */
export function move(s: State, t: number | null): State {
  const p = s.turn, r = s.roll!;
  const pos = s.pos.map((x) => [...x]);
  let captured = false;
  if (t !== null) {
    pos[p][t] = pos[p][t] === -1 ? 0 : pos[p][t] + r;
    const step = pos[p][t];
    if (step <= 50 && !SAFE.has(trackOf(p, step))) {
      const sq = trackOf(p, step);
      for (let q = 0; q < PLAYERS; q++) if (q !== p) pos[q] = pos[q].map((x) => (x >= 0 && x <= 50 && trackOf(q, x) === sq ? ((captured = true), -1) : x));
    }
  }
  const winner = pos[p].every((x) => x === HOME) ? p : null;
  // A six, a capture or getting a counter home earns another roll (three sixes in a row and it passes on)
  const home = t !== null && pos[p][t] === HOME;
  const again = winner === null && (r === 6 || captured || home) && s.sixes < 2;
  return { pos, turn: again ? p : (p + 1) % PLAYERS, roll: null, sixes: again && r === 6 ? s.sixes + 1 : 0, winner, last: t === null ? null : { p, t } };
}
/** The computer's choice of counter */
export function choose(s: State, level: Level, rand: () => number = Math.random): number | null {
  const ms = movable(s);
  if (!ms.length) return null;
  if (level === "easy") return ms[Math.floor(rand() * ms.length)];
  const p = s.turn, r = s.roll!;
  const score = (t: number) => {
    const from = s.pos[p][t], to = from === -1 ? 0 : from + r;
    let v = to - from;
    if (to === HOME) v += 60;
    if (from === -1) v += 25;
    if (to <= 50) {
      const sq = trackOf(p, to);
      if (!SAFE.has(sq) && s.pos.some((qs, q) => q !== p && qs.some((x) => x >= 0 && x <= 50 && trackOf(q, x) === sq))) v += 80;
      if (SAFE.has(sq)) v += 12;
      // Danger: an opponent up to six squares behind where it lands
      const danger = s.pos.some((qs, q) => q !== p && qs.some((x) => x >= 0 && x <= 50 && ((sq - trackOf(q, x) + 52) % 52) >= 1 && ((sq - trackOf(q, x) + 52) % 52) <= 6));
      if (danger && !SAFE.has(sq)) v -= 30;
    } else v += 15; // safe in the home lane
    return v;
  };
  return [...ms].sort((a, b) => score(b) - score(a))[0];
}
