// Tip jar: fill the 5×5 grid with 1 to 5, each once in every row and column. Each outlined jar of squares has to make its
// target with its sign (+ add, × multiply, − take the smaller from the bigger, ÷ divide the bigger by the smaller).
// Each day's grid has exactly one answer. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const N = 5;
export const minMs = 8000;
export const HINT_MS = 10000;
export type Op = "+" | "×" | "−" | "÷" | "=";
export type Cage = { cells: number[]; op: Op; target: number };

const nextTo = (i: number) => {
  const r = Math.floor(i / N), c = i % N;
  return [r > 0 ? i - N : -1, r < N - 1 ? i + N : -1, c > 0 ? i - 1 : -1, c < N - 1 ? i + 1 : -1].filter((j) => j >= 0);
};

/** Does a full set of values make the target? */
export function makes(op: Op, target: number, vals: number[]) {
  if (op === "=") return vals[0] === target;
  if (op === "+") return vals.reduce((a, b) => a + b, 0) === target;
  if (op === "×") return vals.reduce((a, b) => a * b, 1) === target;
  const [a, b] = [Math.max(...vals), Math.min(...vals)];
  return op === "−" ? a - b === target : a === b * target;
}
/** Could a part-filled jar still make the target? */
function couldMake(op: Op, target: number, vals: number[], full: boolean) {
  if (full) return makes(op, target, vals);
  if (op === "+") return vals.reduce((a, b) => a + b, 0) < target;
  if (op === "×") return target % vals.reduce((a, b) => a * b, 1) === 0;
  return true;
}

/** Up to `limit` answers */
export function answers(cages: Cage[], limit = 2): number[][] {
  const cageOf = Array(N * N).fill(0);
  cages.forEach((c, k) => c.cells.forEach((i) => { cageOf[i] = k; }));
  const g = Array(N * N).fill(0), out: number[][] = [];
  const go = (i: number) => {
    if (out.length >= limit) return;
    if (i === N * N) { out.push([...g]); return; }
    const r = Math.floor(i / N), c = i % N;
    for (let v = 1; v <= N; v++) {
      let clash = false;
      for (let k = 0; k < N && !clash; k++) if (g[r * N + k] === v || g[k * N + c] === v) clash = true;
      if (clash) continue;
      g[i] = v;
      const cage = cages[cageOf[i]], vals = cage.cells.map((x) => g[x]).filter((x) => x);
      if (couldMake(cage.op, cage.target, vals, vals.length === cage.cells.length)) go(i + 1);
      g[i] = 0;
    }
  };
  go(0);
  return out;
}

/** Today's grid: a shuffled Latin square cut into jars, kept only if there's one answer */
export function jarFor(date: string): { cages: Cage[]; solution: number[] } {
  const rand = seededRand(`tipjar:${date}`);
  const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  for (;;) {
    const rows = shuffle([...Array(N).keys()]), cols = shuffle([...Array(N).keys()]), sym = shuffle([1, 2, 3, 4, 5]);
    const solution = [...Array(N * N).keys()].map((i) => sym[(rows[Math.floor(i / N)] + cols[i % N]) % N]);
    // Cut the grid into jars of 1 to 4 squares, mostly 2 or 3
    const jar = Array(N * N).fill(-1), cages: Cage[] = [];
    for (const start of shuffle([...Array(N * N).keys()])) {
      if (jar[start] !== -1) continue;
      const want = [1, 2, 2, 2, 3, 3, 3, 4][Math.floor(rand() * 8)];
      const cells = [start];
      jar[start] = cages.length;
      while (cells.length < want) {
        const free = cells.flatMap(nextTo).filter((j) => jar[j] === -1);
        if (!free.length) break;
        const j = free[Math.floor(rand() * free.length)];
        jar[j] = cages.length; cells.push(j);
      }
      const vals = cells.map((i) => solution[i]);
      let op: Op, target: number;
      if (cells.length === 1) { op = "="; target = vals[0]; }
      else if (cells.length === 2 && Math.max(...vals) % Math.min(...vals) === 0 && rand() < 0.5) { op = "÷"; target = Math.max(...vals) / Math.min(...vals); }
      else if (cells.length === 2 && rand() < 0.5) { op = "−"; target = Math.abs(vals[0] - vals[1]); }
      else if (rand() < 0.5) { op = "+"; target = vals.reduce((a, b) => a + b, 0); }
      else { op = "×"; target = vals.reduce((a, b) => a * b, 1); }
      cages.push({ cells: cells.sort((a, b) => a - b), op, target });
    }
    // Too many single squares gives too much away
    if (cages.filter((c) => c.op === "=").length > 2) continue;
    if (answers(cages).length === 1) return { cages, solution };
  }
}

/** Squares breaking a rule: the same number twice in a row or column, or a full jar that misses its target */
export function clashes(cages: Cage[], g: number[]): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < N * N; i++) {
    if (!g[i]) continue;
    const r = Math.floor(i / N), c = i % N;
    for (let k = 0; k < N; k++) {
      if (k !== c && g[r * N + k] === g[i]) bad.add(i);
      if (k !== r && g[k * N + c] === g[i]) bad.add(i);
    }
  }
  for (const cage of cages) {
    const vals = cage.cells.map((x) => g[x]);
    if (vals.every((v) => v) && !makes(cage.op, cage.target, vals)) cage.cells.forEach((x) => bad.add(x));
  }
  return bad;
}
export const isSolved = (cages: Cage[], g: number[]) => g.every((v) => v >= 1 && v <= N) && clashes(cages, g).size === 0;
/** The label in a jar's corner */
export const label = (c: Cage) => (c.op === "=" ? `${c.target}` : `${c.target}${c.op}`);
