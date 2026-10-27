// Sugar swap: swap two neighbouring sweets to make a line of three or more of a kind. Lines clear, the sweets above
// fall, new ones drop in, and chains score more. Thirty swaps a game. Pure, so the page and tests share it.
export const N = 8, KINDS = 6, MOVES = 30;
export const SWEETS = ["🍩", "🧁", "🍪", "🍬", "🍫", "🥐"];
export const SWAP_MAX = 99_990;
export type State = { b: number[]; score: number; moves: number; over: boolean; chain: number; seed: number };

/** A small seeded random, kept in the state so a game replays the same way */
export function rng(seed: number): [number, number] { const s = (seed * 1103515245 + 12345) % 2147483648; return [s / 2147483648, s]; }
function draw(st: { seed: number }) { const [r, s] = rng(st.seed); st.seed = s; return Math.floor(r * KINDS); }

/** Every square that's part of a line of three or more */
export function lines(b: number[]): Set<number> {
  const out = new Set<number>();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const i = r * N + c, v = b[i];
    if (v < 0) continue;
    if (c <= N - 3 && b[i + 1] === v && b[i + 2] === v) { let k = c; while (k < N && b[r * N + k] === v) out.add(r * N + k++); }
    if (r <= N - 3 && b[i + N] === v && b[i + 2 * N] === v) { let k = r; while (k < N && b[k * N + c] === v) out.add(k++ * N + c); }
  }
  return out;
}
const adjacent = (a: number, b: number) => (Math.abs(a - b) === 1 && Math.floor(a / N) === Math.floor(b / N)) || Math.abs(a - b) === N;
/** Is there any swap that makes a line? */
export function hasMove(b: number[]) {
  for (let i = 0; i < N * N; i++) for (const j of [i + 1, i + N]) {
    if (j >= N * N || !adjacent(i, j)) continue;
    const t = [...b]; [t[i], t[j]] = [t[j], t[i]];
    if (lines(t).size) return true;
  }
  return false;
}
export function newGame(seed: number): State {
  const st = { seed: Math.max(1, Math.floor(seed) % 2147483647) };
  for (;;) {
    const b: number[] = [];
    for (let i = 0; i < N * N; i++) {
      // No lines to start with
      let v = draw(st), guard = 0;
      while (((i % N >= 2 && b[i - 1] === v && b[i - 2] === v) || (i >= 2 * N && b[i - N] === v && b[i - 2 * N] === v)) && guard++ < 20) v = draw(st);
      b.push(v);
    }
    if (hasMove(b) && !lines(b).size) return { b, score: 0, moves: MOVES, over: false, chain: 0, seed: st.seed };
  }
}
/** Clear lines, drop the sweets down, fill from the top, and repeat while new lines form. Returns how much it scored. */
export function settle(s0: State): { s: State; cleared: number; chains: number } {
  const s = { ...s0, b: [...s0.b] };
  let cleared = 0, chains = 0;
  for (;;) {
    const ln = lines(s.b);
    if (!ln.size) break;
    chains++;
    cleared += ln.size;
    s.score += ln.size * 10 * chains + (ln.size >= 5 ? 50 : ln.size === 4 ? 20 : 0);
    for (const i of ln) s.b[i] = -1;
    for (let c = 0; c < N; c++) {
      const col = [...Array(N).keys()].map((r) => s.b[r * N + c]).filter((v) => v >= 0);
      const fresh = Array(N - col.length).fill(0).map(() => draw(s));
      [...fresh, ...col].forEach((v, r) => (s.b[r * N + c] = v));
    }
  }
  return { s: { ...s, chain: chains }, cleared, chains };
}
/** Try a swap. Only swaps that make a line count (and use a move). */
export function swap(s: State, a: number, b: number): { s: State; ok: boolean; chains: number } {
  if (s.over || !adjacent(a, b)) return { s, ok: false, chains: 0 };
  const t = [...s.b]; [t[a], t[b]] = [t[b], t[a]];
  if (!lines(t).size) return { s, ok: false, chains: 0 };
  const r = settle({ ...s, b: t, moves: s.moves - 1 });
  let n = r.s;
  // Stuck with no swaps left? Shuffle the board (for free)
  let guard = 0;
  while (!hasMove(n.b) && guard++ < 20) { const st = { seed: n.seed }; const b2 = [...n.b].map(() => draw(st)); n = settle({ ...n, b: b2, seed: st.seed }).s; n = { ...n, score: r.s.score }; }
  return { s: { ...n, over: n.moves <= 0 }, ok: true, chains: r.chains };
}
