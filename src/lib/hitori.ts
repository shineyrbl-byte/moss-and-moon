// Spare cups: put away (shade) cups so no number is left twice in any row or column. Two put-away cups can't sit side by side
// (corners are fine), and the cups left out must all join up across or down. Any answer that follows the rules counts,
// and every day's grid has only one answer that puts away repeats alone. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 7;
export const minMs = 8000;
export const HINT_MS = 10000;
export type Mark = 0 | 1 | 2; // 0 untouched, 1 put away (shaded), 2 kept (circled)

export const nextTo = (i: number) => {
  const r = Math.floor(i / N), c = i % N;
  return [r > 0 ? i - N : -1, r < N - 1 ? i + N : -1, c > 0 ? i - 1 : -1, c < N - 1 ? i + 1 : -1].filter((j) => j >= 0);
};
/** Do the cups that aren't shaded all join up? */
export function joined(shaded: Set<number>) {
  const start = [...Array(N * N).keys()].find((i) => !shaded.has(i));
  if (start === undefined) return false;
  const seen = new Set([start]), stack = [start];
  while (stack.length) for (const j of nextTo(stack.pop()!)) if (!shaded.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
  return seen.size === N * N - shaded.size;
}
/** Squares whose number shows up again in their row or column */
export function repeats(nums: number[]) {
  return [...Array(N * N).keys()].filter((i) => {
    const r = Math.floor(i / N), c = i % N;
    for (let k = 0; k < N; k++) if ((k !== c && nums[r * N + k] === nums[i]) || (k !== r && nums[k * N + c] === nums[i])) return true;
    return false;
  });
}

/** Up to `limit` answers that only shade repeats */
export function answers(nums: number[], limit = 2): number[][] {
  const cand = repeats(nums), out: number[][] = [];
  const shaded = new Set<number>(), kept = new Set<number>([...Array(N * N).keys()].filter((i) => !cand.includes(i)));
  const clashKept = (i: number) => {
    const r = Math.floor(i / N), c = i % N;
    for (let k = 0; k < N; k++) {
      const a = r * N + k, b = k * N + c;
      if ((a !== i && kept.has(a) && nums[a] === nums[i]) || (b !== i && kept.has(b) && nums[b] === nums[i])) return true;
    }
    return false;
  };
  const go = (k: number) => {
    if (out.length >= limit) return;
    if (k === cand.length) { if (joined(shaded)) out.push([...shaded].sort((a, b) => a - b)); return; }
    const i = cand[k];
    // Keep it
    if (!clashKept(i)) { kept.add(i); go(k + 1); kept.delete(i); }
    // Or put it away, if nothing next to it is already away
    if (!nextTo(i).some((j) => shaded.has(j))) {
      shaded.add(i);
      if (joined(shaded)) go(k + 1);
      shaded.delete(i);
    }
  };
  go(0);
  return out;
}

/** Today's grid: a Latin square, a scatter of cups to put away, and each of those given a number that repeats */
export function cupsFor(date: string): { nums: number[]; away: number[] } {
  const rand = seededRand(`cups:${date}`);
  const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  for (;;) {
    const rows = shuffle([...Array(N).keys()]), cols = shuffle([...Array(N).keys()]), sym = shuffle([1, 2, 3, 4, 5, 6, 7]);
    // A shuffled cyclic square (stepping by 3 along each row, which still hits every number since 7 is prime)
    const nums = [...Array(N * N).keys()].map((i) => sym[(rows[Math.floor(i / N)] + cols[i % N] * 3) % N]);
    const away = new Set<number>();
    for (const i of shuffle([...Array(N * N).keys()])) {
      if (away.size >= 12) break;
      if (nextTo(i).some((j) => away.has(j))) continue;
      away.add(i);
      if (!joined(away)) away.delete(i);
    }
    // Each put-away cup copies a number from its row or column, so it has to go
    for (const i of away) {
      const r = Math.floor(i / N), c = i % N;
      const from = [...Array(N).keys()].flatMap((k) => [r * N + k, k * N + c]).filter((j) => j !== i && !away.has(j));
      nums[i] = nums[from[Math.floor(rand() * from.length)]];
    }
    const a = answers(nums);
    if (a.length === 1) return { nums, away: a[0] };
  }
}

/** What's wrong right now: put-away cups side by side, and two cups you've kept showing the same number in a line */
export function problems(nums: number[], marks: Mark[]) {
  const bad = new Set<number>();
  for (let i = 0; i < N * N; i++) {
    if (marks[i] === 1 && nextTo(i).some((j) => marks[j] === 1)) bad.add(i);
    if (marks[i] !== 2) continue;
    const r = Math.floor(i / N), c = i % N;
    for (let k = 0; k < N; k++) {
      const a = r * N + k, b = k * N + c;
      if ((a !== i && marks[a] === 2 && nums[a] === nums[i]) || (b !== i && marks[b] === 2 && nums[b] === nums[i])) bad.add(i);
    }
  }
  return bad;
}
export function isSolved(nums: number[], marks: Mark[]) {
  const shaded = new Set(marks.flatMap((m, i) => (m === 1 ? [i] : [])));
  for (const i of shaded) if (nextTo(i).some((j) => shaded.has(j))) return false;
  for (let i = 0; i < N * N; i++) {
    if (shaded.has(i)) continue;
    const r = Math.floor(i / N), c = i % N;
    for (let k = 0; k < N; k++) {
      const a = r * N + k, b = k * N + c;
      if ((a !== i && !shaded.has(a) && nums[a] === nums[i]) || (b !== i && !shaded.has(b) && nums[b] === nums[i])) return false;
    }
  }
  return joined(shaded);
}
/** Tapping goes untouched, put away, kept, untouched */
export const nextMark = (m: Mark): Mark => ((m + 1) % 3) as Mark;
