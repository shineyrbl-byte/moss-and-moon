// Café star checkers (Chinese checkers) for two: race your ten marbles across the star into the point opposite. Move one hole
// to a neighbour, or hop over a marble (anyone's) into the hole beyond, and keep hopping as long as you can.
// Holes use cube coordinates (x + y + z = 0). Pure, so the page and tests share it.
export type Level = "easy" | "hard";
export type Hole = { x: number; y: number; z: number };
export const HOLES: Hole[] = (() => {
  const out: Hole[] = [];
  for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) {
    const z = -x - y;
    const a = x <= 4 && y <= 4 && z <= 4, b = x >= -4 && y >= -4 && z >= -4;
    if (a || b) out.push({ x, y, z });
  }
  return out;
})();
const key = (h: Hole) => `${h.x},${h.y},${h.z}`;
const INDEX = new Map(HOLES.map((h, i) => [key(h), i]));
const DIRS: Hole[] = [{ x: 1, y: -1, z: 0 }, { x: 1, y: 0, z: -1 }, { x: 0, y: 1, z: -1 }, { x: -1, y: 1, z: 0 }, { x: -1, y: 0, z: 1 }, { x: 0, y: -1, z: 1 }];
const at = (h: Hole, d: Hole, k = 1) => INDEX.get(key({ x: h.x + d.x * k, y: h.y + d.y * k, z: h.z + d.z * k }));
/** You start in the bottom point (z > 4) and head for the top (z < -4); the computer the other way */
export const HOME = [HOLES.flatMap((h, i) => (h.z > 4 ? [i] : [])), HOLES.flatMap((h, i) => (h.z < -4 ? [i] : []))];
export const TARGET = [HOME[1], HOME[0]];
export type State = { at: (0 | 1 | null)[]; turn: 0 | 1; moves: number; last: number[] | null; winner: 0 | 1 | null };

export function newGame(): State {
  const a: (0 | 1 | null)[] = Array(HOLES.length).fill(null);
  HOME[0].forEach((i) => { a[i] = 0; }); HOME[1].forEach((i) => { a[i] = 1; });
  return { at: a, turn: 0, moves: 0, last: null, winner: null };
}
/** Every hole a marble can reach this turn, with the path to get there */
export function reach(s: State, from: number): Map<number, number[]> {
  const out = new Map<number, number[]>();
  const h = HOLES[from];
  for (const d of DIRS) { const j = at(h, d); if (j !== undefined && s.at[j] === null) out.set(j, [from, j]); }
  // Hops, as far as they go
  const stack: number[][] = [[from]];
  const seen = new Set([from]);
  while (stack.length) {
    const path = stack.pop()!, cur = HOLES[path[path.length - 1]];
    for (const d of DIRS) {
      const over = at(cur, d), land = at(cur, d, 2);
      if (over === undefined || land === undefined || s.at[over] === null || (s.at[land] !== null && land !== from) || seen.has(land)) continue;
      seen.add(land);
      const p = [...path, land];
      if (!out.has(land)) out.set(land, p);
      stack.push(p);
    }
  }
  out.delete(from);
  return out;
}
export function move(s: State, from: number, to: number): State | null {
  if (s.winner !== null || s.at[from] !== s.turn) return null;
  const path = reach(s, from).get(to);
  if (!path) return null;
  const a = [...s.at]; a[to] = a[from]; a[from] = null;
  const won = TARGET[s.turn].every((i) => a[i] === s.turn);
  return { at: a, turn: (1 - s.turn) as 0 | 1, moves: s.moves + 1, last: path, winner: won ? s.turn : null };
}


/** The far tip of each side's target point */
const TIP: Hole[] = [{ x: 4, y: 4, z: -8 }, { x: -4, y: -4, z: 8 }];
const toTip = (p: 0 | 1, i: number) => { const h = HOLES[i], t = TIP[p]; return Math.max(Math.abs(h.x - t.x), Math.abs(h.y - t.y), Math.abs(h.z - t.z)); };

export function bestMove(s: State, level: Level, rand: () => number = Math.random): [number, number] | null {
  const p = s.turn, options: { f: number; t: number; v: number }[] = [];
  for (let i = 0; i < HOLES.length; i++) {
    if (s.at[i] !== p) continue;
    for (const [t] of reach(s, i)) {
      // How much closer this gets us to the tip, plus a nudge for moving the marble that's furthest behind
      let v = toTip(p, i) - toTip(p, t) + toTip(p, i) * 0.12;
      if (v < 0) v -= 3; // going backwards is a last resort
      options.push({ f: i, t, v: v + rand() * (level === "hard" ? 0.1 : 3) });
    }
  }
  if (!options.length) return null;
  options.sort((a, b) => b.v - a.v);
  return [options[0].f, options[0].t];
}
/** Where a hole is on screen (x, y), for a board drawn point-up */
export const pixel = (h: Hole): [number, number] => [Math.sqrt(3) * (h.x + h.z / 2), 1.5 * h.z];
