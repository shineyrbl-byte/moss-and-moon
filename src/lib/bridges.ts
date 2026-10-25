// String lights: join the lamps with strings (one or two between a pair, straight lines, no crossing) so each lamp has as many
// strings as its number and every lamp is linked up. Any answer that follows the rules counts. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const SIZE = 7;
export const minMs = 5000;
export type Island = { r: number; c: number; n: number };
export type Bridges = Record<string, 1 | 2>; // "a-b" with a < b (island indexes)

export const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;

/** The nearest lamp in each direction from lamp i */
export function neighbours(islands: Island[], i: number): number[] {
  const out: number[] = [];
  const me = islands[i];
  for (const [dr, dc] of DIRS) {
    for (let r = me.r + dr, c = me.c + dc; r >= 0 && r < SIZE && c >= 0 && c < SIZE; r += dr, c += dc) {
      const j = islands.findIndex((x) => x.r === r && x.c === c);
      if (j >= 0) { out.push(j); break; }
    }
  }
  return out;
}

/** The empty squares a string between a and b passes over */
export function cellsBetween(islands: Island[], a: number, b: number): string[] {
  const A = islands[a], B = islands[b], out: string[] = [];
  if (A.r === B.r) for (let c = Math.min(A.c, B.c) + 1; c < Math.max(A.c, B.c); c++) out.push(`${A.r},${c}`);
  else for (let r = Math.min(A.r, B.r) + 1; r < Math.max(A.r, B.r); r++) out.push(`${r},${A.c}`);
  return out;
}
/** Would a string from a to b cross one that's already there? */
export function crosses(islands: Island[], br: Bridges, a: number, b: number) {
  const mine = new Set(cellsBetween(islands, a, b));
  return Object.keys(br).some((k) => {
    const [x, y] = k.split("-").map(Number);
    if (k === key(a, b)) return false;
    return cellsBetween(islands, x, y).some((cell) => mine.has(cell));
  });
}
export function count(br: Bridges, i: number) {
  return Object.entries(br).reduce((s, [k, v]) => (k.split("-").map(Number).includes(i) ? s + v : s), 0);
}
/** Tapping a pair goes none, one string, two, none */
export function toggle(islands: Island[], br: Bridges, a: number, b: number): Bridges | null {
  if (!neighbours(islands, a).includes(b)) return null;
  const k = key(a, b), cur = br[k] ?? 0;
  if (!cur && crosses(islands, br, a, b)) return null;
  const n = { ...br };
  if (cur === 2) delete n[k]; else n[k] = (cur + 1) as 1 | 2;
  return n;
}
export function connected(n: number, br: Bridges) {
  if (!n) return true;
  const seen = new Set([0]), stack = [0];
  while (stack.length) {
    const i = stack.pop()!;
    for (const k of Object.keys(br)) {
      const [x, y] = k.split("-").map(Number);
      const j = x === i ? y : y === i ? x : -1;
      if (j >= 0 && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === n;
}
export const isSolved = (islands: Island[], br: Bridges) =>
  islands.every((x, i) => count(br, i) === x.n) && connected(islands.length, br);

/** Grow a web of lamps from one, then add a few extra strings so there's more than one way in */
export function lightsFor(date: string): { islands: Island[]; solution: Bridges } {
  const rand = seededRand(`lights:${date}`);
  for (;;) {
    const isl: { r: number; c: number }[] = [{ r: Math.floor(rand() * SIZE), c: Math.floor(rand() * SIZE) }];
    const sol: Bridges = {};
    const taken = (r: number, c: number) => isl.some((x) => x.r === r && x.c === c);
    const nextTo = (r: number, c: number) => isl.some((x) => Math.abs(x.r - r) + Math.abs(x.c - c) === 1);
    const used = () => new Set(Object.keys(sol).flatMap((k) => { const [a, b] = k.split("-").map(Number); return cellsBetween(isl as Island[], a, b); }));
    for (let tries = 0; tries < 400 && isl.length < 12; tries++) {
      const from = Math.floor(rand() * isl.length), [dr, dc] = DIRS[Math.floor(rand() * 4)];
      const len = 2 + Math.floor(rand() * 3);
      const r = isl[from].r + dr * len, c = isl[from].c + dc * len;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || taken(r, c) || nextTo(r, c)) continue;
      const path: string[] = [];
      let ok = true;
      for (let s = 1; s < len; s++) { const pr = isl[from].r + dr * s, pc = isl[from].c + dc * s; if (taken(pr, pc)) ok = false; path.push(`${pr},${pc}`); }
      const u = used();
      if (!ok || path.some((p) => u.has(p)) || u.has(`${r},${c}`)) continue;
      isl.push({ r, c });
      sol[key(from, isl.length - 1)] = rand() < 0.4 ? 2 : 1;
    }
    if (isl.length < 10) continue;
    // A few extra strings between lamps that can already see each other
    const tmp = isl.map((x) => ({ ...x, n: 0 }));
    for (let e = 0; e < 3; e++) {
      const a = Math.floor(rand() * isl.length), ns = neighbours(tmp, a);
      const b = ns[Math.floor(rand() * ns.length)];
      if (b === undefined || sol[key(a, b)] || crosses(tmp, sol, a, b)) continue;
      sol[key(a, b)] = 1;
    }
    const islands = isl.map((x, i) => ({ ...x, n: count(sol, i) }));
    // A lamp that's on another string's path would be confusing, so start again if that happened
    if (islands.every((_, i) => neighbours(islands, i).length > 0) && isSolved(islands, sol)) return { islands, solution: sol };
  }
}
