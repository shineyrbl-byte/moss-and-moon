// Bill total: six numbers and a target. Add, take away, multiply and divide to hit it (or get as close as you can). Every
// step must give a whole number above zero, and each number can only be used once. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const minMs = 4000;
export type Op = "+" | "−" | "×" | "÷";
export const OPS: Op[] = ["+", "−", "×", "÷"];
export function apply(a: number, op: Op, b: number): number | null {
  if (op === "+") return a + b;
  if (op === "×") return a * b;
  if (op === "−") return a > b ? a - b : null;
  return b > 0 && a % b === 0 ? a / b : null;
}

/** Every number you can reach, with one way to get there (the steps, written out) */
export function reachable(nums: number[]): Map<number, string[]> {
  const best = new Map<number, string[]>();
  const seen = new Set<string>();
  const go = (pool: { v: number; steps: string[] }[]) => {
    const k = pool.map((x) => x.v).sort((a, b) => a - b).join(",");
    if (seen.has(k)) return;
    seen.add(k);
    for (const x of pool) { const cur = best.get(x.v); if (!cur || x.steps.length < cur.length) best.set(x.v, x.steps); }
    for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) {
      if (i === j) continue;
      const a = pool[i], b = pool[j];
      for (const op of OPS) {
        if ((op === "+" || op === "×") && i > j) continue; // the same either way round
        const v = apply(a.v, op, b.v);
        if (v === null || (op === "×" && (a.v === 1 || b.v === 1)) || (op === "÷" && b.v === 1)) continue;
        const rest = pool.filter((_, k) => k !== i && k !== j);
        go([...rest, { v, steps: [...a.steps, ...b.steps, `${a.v} ${op} ${b.v} = ${v}`] }]);
      }
    }
  };
  go(nums.map((v) => ({ v, steps: [] })));
  return best;
}

/** Today's bill: one or two big numbers and the rest small, and a three-figure target that can be hit exactly */
export function billFor(date: string): { nums: number[]; target: number; way: string[] } {
  const rand = seededRand(`bill:${date}`);
  const pick = <T,>(a: T[]) => a.splice(Math.floor(rand() * a.length), 1)[0];
  for (;;) {
    const big = [25, 50, 75, 100], small = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];
    const nBig = rand() < 0.5 ? 1 : 2;
    const nums = [...[...Array(nBig)].map(() => pick(big)), ...[...Array(6 - nBig)].map(() => pick(small))].sort((a, b) => b - a);
    const reach = reachable(nums);
    // A target that takes a bit of working out: not one of the numbers, and not made in a single step
    const ok = [...reach.entries()].filter(([v, steps]) => v >= 101 && v <= 999 && steps.length >= 3);
    if (ok.length < 20) continue;
    const [target, way] = ok[Math.floor(rand() * ok.length)];
    return { nums, target, way };
  }
}
/** Fewest steps off, then quickest, packed for the board (the same way Flood packs moves and time) */
export const pack = (off: number, ms: number) => off * 1_000_000 + Math.min(999_999, Math.max(0, Math.round(ms)));
export const unpack = (v: number) => ({ off: Math.floor(v / 1_000_000), ms: v % 1_000_000 });
export const MIN_SCORE = pack(0, minMs), MAX_SCORE = pack(99, 999_999);
/** How far a total is from the target; more than 99 off doesn't count */
export const offBy = (target: number, v: number) => Math.abs(target - v);
