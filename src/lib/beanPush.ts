// Bean push: push the sacks of beans onto the marked spots in the storeroom (a small daily Sokoban). You can push a
// sack but never pull it, and only one at a time. Fewest moves wins the day. Each level is made by starting solved and
// pulling the sacks away, so it can always be solved. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const W = 7, H = 7;
export const minMs = 3000;
export type Level = { walls: boolean[]; goals: number[]; boxes: number[]; player: number; par: number };
export type State = { boxes: number[]; player: number; moves: number; pushes: number; path?: Dir[] };
export type Dir = 0 | 1 | 2 | 3; // up right down left
const D = [-W, 1, W, -1];
const step = (i: number, d: Dir) => { const j = i + D[d]; if (j < 0 || j >= W * H) return -1; if ((d === 1 || d === 3) && Math.floor(j / W) !== Math.floor(i / W)) return -1; return j; };

export function levelFor(date: string): Level {
  const rand = seededRand(`beanpush:${date}`);
  for (;;) {
    // A storeroom: walls round the edge and a few inside
    const walls = [...Array(W * H).keys()].map((i) => i < W || i >= W * (H - 1) || i % W === 0 || i % W === W - 1);
    for (let k = 0; k < 4; k++) { const i = W + 1 + Math.floor(rand() * (W * (H - 2) - 2)); if (!walls[i]) walls[i] = true; }
    const floor = walls.flatMap((w, i) => (w ? [] : [i]));
    // Every floor square must connect to every other
    const seen = new Set([floor[0]]), todo = [floor[0]];
    while (todo.length) { const i = todo.pop()!; for (const d of [0, 1, 2, 3] as Dir[]) { const j = step(i, d); if (j >= 0 && !walls[j] && !seen.has(j)) { seen.add(j); todo.push(j); } } }
    if (seen.size !== floor.length) continue;
    const pick = () => floor[Math.floor(rand() * floor.length)];
    const goals: number[] = []; while (goals.length < 3) { const g = pick(); if (!goals.includes(g)) goals.push(g); }
    let boxes = [...goals], player = pick();
    if (boxes.includes(player)) continue;
    // Walk about backwards: each step the keeper moves, and may pull a sack behind them
    let pulls = 0;
    for (let k = 0; k < 400; k++) {
      const d = Math.floor(rand() * 4) as Dir, to = step(player, d);
      if (to < 0 || walls[to] || boxes.includes(to)) continue;
      const behind = step(player, ((d + 2) % 4) as Dir), bi = boxes.indexOf(behind);
      if (bi >= 0 && rand() < 0.6) { boxes = boxes.map((b, n) => (n === bi ? player : b)); pulls++; }
      player = to;
    }
    const offGoal = boxes.filter((b) => !goals.includes(b)).length;
    if (offGoal < 3 || pulls < 8) continue;
    // Sacks shouldn't start in a corner (they'd be stuck: we only pulled them along, but make doubly sure)
    const corner = (b: number) => [[0, 1], [1, 2], [2, 3], [3, 0]].some(([a, c]) => { const x = step(b, a as Dir), y = step(b, c as Dir); return (x < 0 || walls[x]) && (y < 0 || walls[y]); });
    if (boxes.some((b) => corner(b) && !goals.includes(b))) continue;
    return { walls, goals, boxes, player, par: pulls };
  }
}
export const start = (l: Level): State => ({ boxes: [...l.boxes], player: l.player, moves: 0, pushes: 0, path: [] });
/** Step one square; pushes a sack if there's room beyond it. Returns null if you can't go that way. */
export function move(l: Level, s: State, d: Dir): State | null {
  const to = step(s.player, d);
  if (to < 0 || l.walls[to]) return null;
  const bi = s.boxes.indexOf(to);
  const path = [...(s.path ?? []), d];
  if (bi < 0) return { ...s, player: to, moves: s.moves + 1, path };
  const beyond = step(to, d);
  if (beyond < 0 || l.walls[beyond] || s.boxes.includes(beyond)) return null;
  return { boxes: s.boxes.map((b, n) => (n === bi ? beyond : b)), player: to, moves: s.moves + 1, pushes: s.pushes + 1, path };
}
export const isSolved = (l: Level, s: State) => s.boxes.every((b) => l.goals.includes(b));
/** The board keeps fewest moves first, then time */
export const pack = (moves: number, ms: number) => moves * 1_000_000 + Math.min(999_999, Math.max(0, Math.round(ms)));
export const MIN_SCORE = pack(3, minMs), MAX_SCORE = pack(999, 999_999);
