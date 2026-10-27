// Zip path: draw one line that visits every square exactly once, moving up, down, left or right, and passes the
// numbered squares in order (1 first, the last number at the end). Each day's grid has one answer. Pure.
import { seededRand, shuffled } from "./gameOrders.ts";

export const N = 6;
export const minMs = 5000;
export const HINT_MS = 10000;
const rowOf = (i: number) => Math.floor(i / N), colOf = (i: number) => i % N;
export const next = (i: number) => [i - N, i + N, colOf(i) > 0 ? i - 1 : -1, colOf(i) < N - 1 ? i + 1 : -1].filter((j) => j >= 0 && j < N * N);
export const touches = (a: number, b: number) => Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;

function randomPath(rand: () => number): number[] | null {
  const used = Array(N * N).fill(false), path = [Math.floor(rand() * N * N)];
  used[path[0]] = true;
  while (path.length < N * N) {
    const opts = next(path[path.length - 1]).filter((j) => !used[j]);
    if (!opts.length) return null;
    const deg = (j: number) => next(j).filter((k) => !used[k]).length;
    const low = Math.min(...opts.map(deg)), best = opts.filter((j) => deg(j) === low);
    const j = best[Math.floor(rand() * best.length)];
    used[j] = true; path.push(j);
  }
  return path;
}

/** How many ways through (up to `limit`). `marks[i]` is a checkpoint number or 0. Gives up (99) past `budget` steps. */
export function countPaths(marks: number[], limit = 2, budget = Infinity): number {
  const at = new Map<number, number>(); marks.forEach((m, i) => { if (m) at.set(m, i); });
  const last = Math.max(...marks), start = at.get(1);
  if (start === undefined) return 0;
  const used = Array(N * N).fill(false);
  let found = 0, steps = 0;
  // The squares not yet visited must all still be reachable from the head of the line
  const connected = (head: number, left: number) => {
    const seen = new Set([head]), todo = [head];
    while (todo.length) for (const j of next(todo.pop()!)) if (!used[j] && !seen.has(j)) { seen.add(j); todo.push(j); }
    return seen.size - 1 === left;
  };
  const go = (pos: number, len: number, want: number) => {
    if (found >= limit) return;
    if (++steps > budget) { found = 99; return; }
    if (len === N * N) { if (want > last) found++; return; }
    if (!connected(pos, N * N - len)) return;
    for (const j of next(pos)) {
      if (used[j]) continue;
      const m = marks[j];
      if (m && m !== want) continue;
      // The final checkpoint has to be the very last square
      if (m === last && len + 1 !== N * N) continue;
      used[j] = true; go(j, len + 1, m ? want + 1 : want); used[j] = false;
      if (found >= limit) return;
    }
  };
  used[start] = true;
  go(start, 1, 2);
  return found;
}

export function zipFor(date: string): { marks: number[]; path: number[] } {
  const rand = seededRand(`zippath:${date}`);
  for (;;) {
    const path = randomPath(rand);
    if (!path) continue;
    // Start with a checkpoint every few squares, then take the middle ones away while there's still one way through
    const keep = new Set([0, N * N - 1, ...[...Array(N * N).keys()].filter((k) => k % 3 === 0)]);
    const number = () => { const marks = Array(N * N).fill(0); let n = 0; [...keep].sort((a, b) => a - b).forEach((k) => (marks[path[k]] = ++n)); return marks; };
    if (countPaths(number(), 2, 200_000) !== 1) continue;
    for (const k of shuffled([...keep].filter((k) => k !== 0 && k !== N * N - 1), rand)) {
      keep.delete(k);
      if (countPaths(number(), 2, 60_000) !== 1) keep.add(k);
    }
    const marks = number();
    if (Math.max(...marks) >= 5) return { marks, path };
  }
}

/** Check a line drawn so far: it must start at 1, step to touching squares, never repeat, and meet numbers in order */
export function validLine(marks: number[], line: number[]) {
  if (!line.length) return true;
  if (marks[line[0]] !== 1) return false;
  let want = 2;
  for (let k = 1; k < line.length; k++) {
    if (!touches(line[k - 1], line[k]) || line.indexOf(line[k]) !== k) return false;
    const m = marks[line[k]];
    if (m) { if (m !== want) return false; want++; }
  }
  return true;
}
export const isSolved = (marks: number[], line: number[]) => line.length === N * N && validLine(marks, line) && marks[line[line.length - 1]] === Math.max(...marks);
