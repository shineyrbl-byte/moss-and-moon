// Coffee trail (Hidato): fill the tray with 1 to 36 so each number touches the next one, side by side or corner to corner.
// Some numbers are given; each day's tray has exactly one answer. Pure, so the page and tests share it.
import { seededRand, shuffled } from "./gameOrders.ts";
import { makeGrid } from "./grid.ts";

export const N = 6;
export const LAST = N * N;
export const minMs = 10000;
export const HINT_MS = 10000;

const G = makeGrid(N), { rowOf, colOf } = G;
export const around = G.around;
export const touches = (a: number, b: number) => a !== b && Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1;
const far = (a: number, b: number) => Math.max(Math.abs(rowOf(a) - rowOf(b)), Math.abs(colOf(a) - colOf(b)));

/** A random path through every square, each step to a touching square (Warnsdorff's rule with random ties) */
function randomTrail(rand: () => number): number[] | null {
  const used = Array(N * N).fill(false), path = [Math.floor(rand() * N * N)];
  used[path[0]] = true;
  while (path.length < N * N) {
    const opts = around(path[path.length - 1]).filter((j) => !used[j]);
    if (!opts.length) return null;
    const deg = (j: number) => around(j).filter((k) => !used[k]).length;
    opts.sort((a, b) => deg(a) - deg(b) || rand() - 0.5);
    const best = opts.filter((j) => deg(j) === deg(opts[0]));
    const next = best[Math.floor(rand() * best.length)];
    used[next] = true; path.push(next);
  }
  return path;
}

/** Count answers (up to `limit`) for a tray where given[i] is a number or 0. Gives up after `budget` steps and says 99. */
export function countAnswers(given: number[], limit = 2, budget = Infinity): number {
  const at = Array(LAST + 1).fill(-1);
  given.forEach((v, i) => { if (v) at[v] = i; });
  // The next given number at or after each number, for "can I still get there in time?"
  const nextGiven = Array(LAST + 2).fill(0);
  for (let v = LAST; v >= 1; v--) nextGiven[v] = at[v] >= 0 ? v : nextGiven[v + 1];
  const used = given.map((v) => v !== 0);
  let found = 0, steps = 0;
  const go = (v: number, pos: number) => {
    if (found >= limit) return;
    if (++steps > budget) { found = 99; return; }
    if (v === LAST) { found++; return; }
    const want = v + 1;
    if (at[want] >= 0) { if (touches(pos, at[want])) go(want, at[want]); return; }
    const ng = nextGiven[want];
    for (const j of around(pos)) {
      if (used[j]) continue;
      if (ng && far(j, at[ng]) > ng - want) continue;
      used[j] = true; go(want, j); used[j] = false;
      if (found >= limit) return;
    }
  };
  if (at[1] < 0) return 0;
  go(1, at[1]);
  return found;
}

export function trailFor(date: string): { given: number[]; answer: number[] } {
  const rand = seededRand(`coffeetrail:${date}`);
  for (;;) {
    const path = randomTrail(rand);
    if (!path) continue;
    const answer = Array(N * N).fill(0);
    path.forEach((i, k) => (answer[i] = k + 1));
    // Take numbers away, keeping 1 and the last, while there's still only one way through
    const given = [...answer];
    for (const i of shuffled([...Array(N * N).keys()], rand)) {
      if (answer[i] === 1 || answer[i] === LAST) continue;
      given[i] = 0;
      if (countAnswers(given, 2, 30_000) !== 1) given[i] = answer[i]; // too slow to be sure counts as "not sure"
    }
    const shown = given.filter(Boolean).length;
    if (shown >= 8 && shown <= 16) return { given, answer };
  }
}

/** Numbers that can't be right where they are: a number with neither its neighbour numbers nearby, or used twice */
export function problems(given: number[], mine: number[]) {
  const all = given.map((g, i) => g || mine[i]);
  const where = new Map<number, number[]>();
  all.forEach((v, i) => { if (v) where.set(v, [...(where.get(v) ?? []), i]); });
  const bad = new Set<number>();
  for (const [v, list] of where) {
    if (list.length > 1) list.forEach((i) => { if (!given[i]) bad.add(i); });
    for (const i of list) {
      if (given[i]) continue;
      for (const w of [v - 1, v + 1]) { const there = where.get(w); if (there && there.length === 1 && !touches(i, there[0])) bad.add(i); }
    }
  }
  return bad;
}
export const isSolved = (answer: number[], given: number[], mine: number[]) => answer.every((v, i) => (given[i] || mine[i]) === v);
