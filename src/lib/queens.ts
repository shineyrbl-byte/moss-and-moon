// Table for one: seat one guest in every row, every column and every coloured section, with no two guests in touching seats
// (not even corner to corner). Every day's floor plan has exactly one answer. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 8;
export const minMs = 5000;
export const minMsHard = 8000;
export const HINT_MS = 10000;
export type Mark = 0 | 1 | 2; // 0 empty, 1 crossed out, 2 guest

/** Tapping goes empty, crossed out, guest, empty */
export const nextMark = (m: Mark): Mark => ((m + 1) % 3) as Mark;

/** Everything that depends on the size of the floor: 8×8 is the daily, 9×9 the hard one */
export function queensOf(N: number) {
  const touching = (a: number, b: number) => a !== b && Math.abs(Math.floor(a / N) - Math.floor(b / N)) <= 1 && Math.abs((a % N) - (b % N)) <= 1;

  /** Up to `limit` ways to seat everyone, each as the seat picked in every row */
  function seatings(regions: number[], limit = 2): number[][] {
    const out: number[][] = [];
    const cols: number[] = [];
    const usedCol = new Set<number>(), usedReg = new Set<number>();
    const go = (r: number) => {
      if (out.length >= limit) return;
      if (r === N) { out.push(cols.map((c, i) => i * N + c)); return; }
      for (let c = 0; c < N; c++) {
        const reg = regions[r * N + c];
        if (usedCol.has(c) || usedReg.has(reg) || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue;
        cols[r] = c; usedCol.add(c); usedReg.add(reg);
        go(r + 1);
        usedCol.delete(c); usedReg.delete(reg);
      }
    };
    go(0);
    return out;
  }
  const countSeatings = (regions: number[], limit = 2) => seatings(regions, limit).length;

  const nextTo = (i: number) => {
    const r = Math.floor(i / N), c = i % N;
    return [r > 0 ? i - N : -1, r < N - 1 ? i + N : -1, c > 0 ? i - 1 : -1, c < N - 1 ? i + 1 : -1].filter((j) => j >= 0);
  };
  /** Is a section still in one piece? */
  function joined(regions: number[], reg: number) {
    const cells = regions.flatMap((x, i) => (x === reg ? [i] : []));
    const seen = new Set([cells[0]]), stack = [cells[0]];
    while (stack.length) for (const j of nextTo(stack.pop()!)) if (regions[j] === reg && !seen.has(j)) { seen.add(j); stack.push(j); }
    return seen.size === cells.length;
  }

  /** Today's floor: one seat per row, then a coloured section grown out from each seat, kept only if there's one answer */
  function tableFor(date: string): { regions: number[]; seats: number[] } {
    const rand = seededRand(N === 8 ? `table:${date}` : `table${N}:${date}`);
    for (;;) {
      // A seat in every row and column, none touching the row above
      const cols: number[] = [];
      const place = (r: number): boolean => {
        if (r === N) return true;
        const opts = [...Array(N).keys()].filter((c) => !cols.includes(c) && (r === 0 || Math.abs(cols[r - 1] - c) > 1));
        for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
        for (const c of opts) { cols[r] = c; if (place(r + 1)) return true; }
        cols.length = r;
        return false;
      };
      place(0);
      const seats = cols.map((c, r) => r * N + c);
      const regions = Array(N * N).fill(-1);
      seats.forEach((s, k) => { regions[s] = k; });
      // Grow the sections a square at a time: pick a section that can still grow, then one free square next to it,
      // so big sections don't swallow the floor just because they have more edges
      for (let left = N * N - N; left > 0;) {
        const edge: number[][] = Array.from({ length: N }, () => []);
        for (let i = 0; i < N * N; i++) if (regions[i] === -1) for (const j of nextTo(i)) if (regions[j] !== -1) edge[regions[j]].push(i);
        const can = edge.flatMap((e, k) => (e.length ? [k] : []));
        const reg = can[Math.floor(rand() * can.length)];
        regions[edge[reg][Math.floor(rand() * edge[reg].length)]] = reg; left--;
      }
      // While there's a second way to seat everyone, hand one of its squares to a neighbouring section
      const seatSet = new Set(seats);
      for (let fix = 0; fix < 120; fix++) {
        const other = seatings(regions).find((s) => s.some((x, r) => x !== seats[r]));
        if (!other) return { regions, seats };
        const moves: [number, number][] = [];
        for (const x of other) {
          if (seatSet.has(x)) continue;
          for (const j of nextTo(x)) if (regions[j] !== regions[x]) moves.push([x, regions[j]]);
        }
        for (let i = moves.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [moves[i], moves[j]] = [moves[j], moves[i]]; }
        const ok = moves.find(([x, to]) => { const from = regions[x]; regions[x] = to; const fine = joined(regions, from); regions[x] = from; return fine; });
        if (!ok) break;
        regions[ok[0]] = ok[1];
      }
      if (countSeatings(regions) === 1) return { regions, seats };
    }
  }

  /** Guests breaking a rule: sharing a row, column or section, or sitting next to each other */
  function clashes(regions: number[], marks: Mark[]): Set<number> {
    const g = marks.flatMap((m, i) => (m === 2 ? [i] : []));
    const bad = new Set<number>();
    for (const a of g) for (const b of g) {
      if (a >= b) continue;
      if (Math.floor(a / N) === Math.floor(b / N) || a % N === b % N || regions[a] === regions[b] || touching(a, b)) { bad.add(a); bad.add(b); }
    }
    return bad;
  }
  const isSolved = (regions: number[], marks: Mark[]) => marks.filter((m) => m === 2).length === N && clashes(regions, marks).size === 0;

  /** The seats a guest rules out, to cross off automatically */
  function ruledOut(regions: number[], at: number): number[] {
    return [...Array(N * N).keys()].filter((i) => i !== at && (Math.floor(i / N) === Math.floor(at / N) || i % N === at % N || regions[i] === regions[at] || touching(i, at)));
  }
  /** A hint that explains itself: a row, column or section with only one seat left, once crossed-off seats and the
   * seats your guests rule out are taken away */
  function explain(regions: number[], marks: Mark[]): { at: number; why: string } | null {
    const guests = marks.flatMap((m, i) => (m === 2 ? [i] : []));
    const out = new Set(guests.flatMap((g) => ruledOut(regions, g)));
    const open = (i: number) => marks[i] === 0 && !out.has(i);
    const groups: [string, number[]][] = [];
    for (let k = 0; k < N; k++) {
      groups.push([`row ${k + 1}`, [...Array(N).keys()].map((c) => k * N + c)], [`column ${k + 1}`, [...Array(N).keys()].map((r) => r * N + k)]);
      groups.push(["this section", [...Array(N * N).keys()].filter((i) => regions[i] === k)]);
    }
    for (const [what, cells] of groups) {
      if (cells.some((i) => marks[i] === 2)) continue;
      const left = cells.filter(open);
      if (left.length === 1) return { at: left[0], why: `This is the only seat left in ${what}: the others are crossed off or next to, or in line with, a guest.` };
    }
    return null;
  }
  return { N, seatings, countSeatings, tableFor, clashes, isSolved, ruledOut, explain };
}
const eight = queensOf(8);
export const { seatings, countSeatings, tableFor, clashes, isSolved, ruledOut, explain } = eight;
export const HARD = queensOf(9);
