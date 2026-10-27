// Sugar stars (star battle): put two stars in every row, every column and every outlined tray, with no two stars touching,
// not even corner to corner. Each day's 10×10 has exactly one answer. Pure, so the page and tests share it.
import { seededRand, shuffled } from "./gameOrders.ts";
import { makeGrid } from "./grid.ts";

export const N = 10;
export const STARS = 2;
export const minMs = 20000;
export const HINT_MS = 15000;
export type Mark = 0 | 1 | 2; // 0 empty, 1 crossed off, 2 star

const G = makeGrid(N), { rowOf, colOf } = G;
export const touching = G.touching;
const side = G.side;

// Every way to put two non-touching stars in a row: pairs of columns at least two apart
const ROW_PAIRS: [number, number][] = [];
for (let a = 0; a < N; a++) for (let b = a + 2; b < N; b++) ROW_PAIRS.push([a, b]);

/** Up to `limit` answers (each a sorted list of star squares) for a region map */
export function answers(region: number[], limit = 2): number[][] {
  const out: number[][] = [];
  const colN = Array(N).fill(0), regN = Array(N).fill(0);
  // Squares of each region still to come, row by row, so a region that can't reach two stars is spotted early
  const regLeftFrom = [...Array(N + 1)].map(() => Array(N).fill(0));
  for (let r = N - 1; r >= 0; r--) { regLeftFrom[r] = [...regLeftFrom[r + 1]]; for (let c = 0; c < N; c++) regLeftFrom[r][region[r * N + c]]++; }
  const rowsOfReg = [...Array(N)].map((_, g) => [...new Set(region.flatMap((x, i) => (x === g ? [rowOf(i)] : [])))]);
  const lastRow = rowsOfReg.map((rs) => Math.max(...rs));
  const prev: number[] = [];
  const stars: number[] = [];
  const go = (r: number) => {
    if (out.length >= limit) return;
    if (r === N) { out.push([...stars]); return; }
    for (const [a, b] of ROW_PAIRS) {
      if (colN[a] >= STARS || colN[b] >= STARS) continue;
      if (prev.some((p) => Math.abs(p - a) <= 1 || Math.abs(p - b) <= 1)) continue;
      const ga = region[r * N + a], gb = region[r * N + b];
      if (ga === gb ? regN[ga] > 0 : regN[ga] >= STARS || regN[gb] >= STARS) continue;
      colN[a]++; colN[b]++; regN[ga]++; regN[gb]++;
      // Columns and regions must still be able to reach two
      let ok = true;
      const rowsLeft = N - r - 1;
      for (let c = 0; c < N && ok; c++) if (STARS - colN[c] > Math.ceil(rowsLeft / 2)) ok = false;
      for (let g = 0; g < N && ok; g++) {
        if (regN[g] < STARS && lastRow[g] <= r) ok = false;
        else if (STARS - regN[g] > 0 && regLeftFrom[r + 1][g] === 0) ok = false;
      }
      if (ok) {
        const keep = prev.splice(0, prev.length, a, b);
        stars.push(r * N + a, r * N + b);
        go(r + 1);
        stars.length -= 2;
        prev.splice(0, prev.length, ...keep);
      }
      colN[a]--; colN[b]--; regN[ga]--; regN[gb]--;
      if (out.length >= limit) return;
    }
  };
  go(0);
  return out;
}

/** A random valid star layout: two per row and column, none touching */
function randomStars(rand: () => number): number[] | null {
  const colN = Array(N).fill(0), stars: number[] = [];
  const go = (r: number, prev: number[]): boolean => {
    if (r === N) return true;
    for (const [a, b] of shuffled(ROW_PAIRS, rand)) {
      if (colN[a] >= STARS || colN[b] >= STARS || prev.some((p) => Math.abs(p - a) <= 1 || Math.abs(p - b) <= 1)) continue;
      if ([...Array(N).keys()].some((c) => STARS - colN[c] - (c === a || c === b ? 1 : 0) > Math.ceil((N - r - 1) / 2))) continue;
      colN[a]++; colN[b]++; stars.push(r * N + a, r * N + b);
      if (go(r + 1, [a, b])) return true;
      colN[a]--; colN[b]--; stars.length -= 2;
    }
    return false;
  };
  return go(0, []) ? stars : null;
}

/** Ten trays, each grown from a pair of nearby stars until the whole box is covered */
function growRegions(stars: number[], rand: () => number): number[] | null {
  // Pair the stars up: each with a close one not yet taken
  const left = shuffled(stars, rand), pairs: number[][] = [];
  while (left.length) {
    const a = left.shift()!;
    left.sort((x, y) => Math.hypot(rowOf(x) - rowOf(a), colOf(x) - colOf(a)) - Math.hypot(rowOf(y) - rowOf(a), colOf(y) - colOf(a)));
    const k = Math.min(left.length - 1, Math.floor(rand() * 2));
    pairs.push([a, left.splice(k, 1)[0]]);
  }
  const region = Array(N * N).fill(-1);
  // Join each pair with a straight-ish path of squares that avoids other stars
  const starSet = new Set(stars);
  for (let g = 0; g < pairs.length; g++) {
    const [a, b] = pairs[g];
    let cur = a; region[a] = g;
    for (let steps = 0; cur !== b && steps < 40; steps++) {
      const opts = side(cur).filter((j) => (region[j] === -1 || region[j] === g) && (!starSet.has(j) || j === b));
      if (!opts.length) return null;
      const dist = (j: number) => Math.abs(rowOf(j) - rowOf(b)) + Math.abs(colOf(j) - colOf(b));
      opts.sort((x, y) => dist(x) - dist(y) + (rand() - 0.5) * 0.8);
      cur = opts[0]; region[cur] = g;
    }
    if (cur !== b) return null;
  }
  // Then let the trays grow into the gaps, a square at a time
  let empty = region.filter((x) => x === -1).length;
  while (empty) {
    const edge = shuffled(region.flatMap((x, i) => (x === -1 && side(i).some((j) => region[j] >= 0) ? [i] : [])), rand);
    if (!edge.length) return null;
    const i = edge[0], near = side(i).filter((j) => region[j] >= 0);
    region[i] = region[near[Math.floor(rand() * near.length)]]; empty--;
  }
  return region;
}

/** Is tray g still in one piece? */
function connected(region: number[], g: number) {
  const cells = region.flatMap((x, i) => (x === g ? [i] : []));
  if (!cells.length) return false;
  const seen = new Set([cells[0]]), todo = [cells[0]];
  while (todo.length) for (const j of side(todo.pop()!)) if (region[j] === g && !seen.has(j)) { seen.add(j); todo.push(j); }
  return seen.size === cells.length;
}

export function starsFor(date: string): { region: number[]; stars: number[] } {
  const rand = seededRand(`sugarstars:${date}`);
  for (;;) {
    const stars = randomStars(rand);
    if (!stars) continue;
    for (let tries = 0; tries < 6; tries++) {
      const region = growRegions(stars, rand);
      if (!region) continue;
      const mine = new Set(stars);
      // While there's another answer, move one of its stars' squares into a neighbouring tray, so that answer breaks
      for (let step = 0; step < 80; step++) {
        const a = answers(region);
        if (a.length === 1) return { region, stars: a[0] };
        const other = a.find((x) => x.some((s) => !mine.has(s)))!;
        const spots = shuffled(other.filter((s) => !mine.has(s)), rand);
        let moved = false;
        for (const c of spots) {
          for (const j of shuffled(side(c), rand)) {
            const g = region[j], from = region[c];
            if (g === from) continue;
            region[c] = g;
            if (connected(region, from)) { moved = true; break; }
            region[c] = from;
          }
          if (moved) break;
        }
        if (!moved) break;
      }
    }
  }
}

/** What's wrong on the board so far: stars that touch, and rows/columns/trays with too many */
export function problems(region: number[], marks: Mark[]) {
  const stars = marks.flatMap((m, i) => (m === 2 ? [i] : []));
  const bad = new Set<number>();
  for (const a of stars) for (const b of stars) if (touching(a, b)) { bad.add(a); bad.add(b); }
  const over = (key: (i: number) => number) => {
    const n = new Map<number, number[]>();
    for (const s of stars) n.set(key(s), [...(n.get(key(s)) ?? []), s]);
    for (const list of n.values()) if (list.length > STARS) list.forEach((s) => bad.add(s));
  };
  over(rowOf); over(colOf); over((i) => region[i]);
  return bad;
}
export const isSolved = (answer: number[], marks: Mark[]) => marks.every((m, i) => (m === 2) === answer.includes(i));
export const nextMark = (m: Mark): Mark => (m === 0 ? 2 : m === 2 ? 1 : 0);
/** Borders to draw: is the square to the right / below in a different tray? */
export const borders = (region: number[], i: number) => ({ right: colOf(i) < N - 1 && region[i + 1] !== region[i], down: rowOf(i) < N - 1 && region[i + N] !== region[i] });
