// Bead necklace: draw one closed loop through the middles of squares (across and down, never crossing itself) that goes
// through every bead. On a white bead the loop goes straight, and turns on at least one side of it. On a black bead the
// loop turns, and goes straight on both sides. Each day's necklace has exactly one answer. Pure, so the page and tests share it.
//
// Inside the solver, the loop is the edge of a region of the (N-1)×(N-1) little squares between the square middles: a
// middle is on the loop when the four little squares around it aren't all the same, and it's a turn when one or three of them are inside.
import { seededRand, shuffled } from "./gameOrders.ts";

export const N = 7;
const M = N - 1;
export const minMs = 10000;
export const HINT_MS = 10000;
export type Bead = 0 | 1 | 2; // none, white, black
/** Links between square middles: across ones first (N rows of N-1), then down ones (N-1 rows of N) */
export const ACROSS = N * (N - 1), LINKS = ACROSS + (N - 1) * N;
export const across = (r: number, c: number) => r * (N - 1) + c; // (r, c) to (r, c+1)
export const down = (r: number, c: number) => ACROSS + r * N + c; // (r, c) to (r+1, c)

const f = (reg: number[], r: number, c: number) => (r < 0 || r >= M || c < 0 || c >= M ? 0 : reg[r * M + c]);
/** The four little squares round a middle: top-left, top-right, bottom-left, bottom-right (-1 if not decided) */
const quad = (reg: number[], r: number, c: number) => [f(reg, r - 1, c - 1), f(reg, r - 1, c), f(reg, r, c - 1), f(reg, r, c)];
/** What the loop does at a middle: "off", "across", "down", "turn", or "bad" (touching itself), or null if not yet known */
function shape(reg: number[], r: number, c: number): "off" | "across" | "down" | "turn" | "bad" | null {
  const [a, b, d, e] = quad(reg, r, c);
  if (a < 0 || b < 0 || d < 0 || e < 0) return null;
  const n = a + b + d + e;
  if (n === 0 || n === 4) return "off";
  if (n === 1 || n === 3) return "turn";
  if (a === e) return "bad"; // corner to corner
  return a === b ? "across" : "down"; // top pair the same: the edge runs across between them
}
/** Which links the loop uses at a middle that's a turn: the two directions it leaves in */
function turnDirs(reg: number[], r: number, c: number): [number, number][] {
  const [a, b, d, e] = quad(reg, r, c);
  const out: [number, number][] = [];
  if (a !== b) out.push([-1, 0]); // up: between top-left and top-right
  if (d !== e) out.push([1, 0]);
  if (a !== d) out.push([0, -1]);
  if (b !== e) out.push([0, 1]);
  return out;
}
/** Does the bead's rule hold? null if it can't be told yet */
function beadOk(reg: number[], beads: Bead[], i: number): boolean | null {
  const r = Math.floor(i / N), c = i % N, s = shape(reg, r, c);
  if (s === null) return null;
  if (s === "off" || s === "bad") return false;
  if (beads[i] === 1) {
    if (s === "turn") return false;
    const [o1, o2] = s === "across" ? [[r, c - 1], [r, c + 1]] : [[r - 1, c], [r + 1, c]];
    const s1 = shape(reg, o1[0], o1[1]), s2 = shape(reg, o2[0], o2[1]);
    if (s1 === "turn" || s2 === "turn") return true;
    return s1 === null || s2 === null ? null : false;
  }
  if (s !== "turn") return false;
  for (const [dr, dc] of turnDirs(reg, r, c)) {
    const t = shape(reg, r + dr, c + dc);
    if (t === null) return null;
    if (t !== (dr ? "down" : "across")) return false;
  }
  return true;
}
function goodRegion(reg: number[]) {
  const ins = reg.flatMap((v, i) => (v ? [i] : []));
  if (!ins.length) return false;
  const reach = (start: number[], val: number) => {
    const seen = new Set(start), stack = [...start];
    while (stack.length) { const i = stack.pop()!, r = Math.floor(i / M), c = i % M; for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) { if (rr < 0 || rr >= M || cc < 0 || cc >= M) continue; const j = rr * M + cc; if (reg[j] === val && !seen.has(j)) { seen.add(j); stack.push(j); } } }
    return seen.size;
  };
  if (reach([ins[0]], 1) !== ins.length) return false;
  const border = [...Array(M * M).keys()].filter((i) => !reg[i] && (i < M || i >= M * (M - 1) || i % M === 0 || i % M === M - 1));
  if (reach(border, 0) !== M * M - ins.length) return false;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (shape(reg, r, c) === "bad") return false;
  return true;
}

/** After finishing row `r` of little squares: can this still become one region with no holes? Inside pieces that no longer
 * reach the newest row can't join anything, so there must be only one; outside pockets that reach neither the newest row
 * nor the edge are holes. */
/** Has the inside already closed up above row r+1 (inside squares exist, but none in row r)? */
function closed(reg: number[], r: number) {
  let any = false;
  for (let i = 0; i < (r + 1) * M; i++) if (reg[i] === 1) any = true;
  if (!any) return false;
  for (let c = 0; c < M; c++) if (reg[r * M + c] === 1) return false;
  return true;
}
function stillPossible(reg: number[], r: number) {
  const id = Array(M * M).fill(-1);
  let pieces = 0, closedInside = false, insidePieces = 0;
  for (let i = 0; i < (r + 1) * M; i++) {
    if (id[i] !== -1) continue;
    const val = reg[i], cells = [i];
    id[i] = pieces;
    for (let k = 0; k < cells.length; k++) {
      const x = cells[k], xr = Math.floor(x / M), xc = x % M;
      for (const [rr, cc] of [[xr - 1, xc], [xr + 1, xc], [xr, xc - 1], [xr, xc + 1]]) {
        if (rr < 0 || rr > r || cc < 0 || cc >= M) continue;
        const j = rr * M + cc;
        if (reg[j] === val && id[j] === -1) { id[j] = pieces; cells.push(j); }
      }
    }
    pieces++;
    const reachesNew = cells.some((x) => Math.floor(x / M) === r);
    if (val === 1) { insidePieces++; if (!reachesNew) closedInside = true; }
    else if (!reachesNew && !cells.some((x) => x < M || x % M === 0 || x % M === M - 1)) return false;
  }
  return !(closedInside && insidePieces > 1);
}
/** Up to `limit` answers, as regions */
export function answers(beads: Bead[], limit = 2): number[][] {
  const reg = Array(M * M).fill(-1), out: number[][] = [];
  const beadAt = beads.flatMap((b, i) => (b ? [i] : []));
  const go = (k: number) => {
    if (out.length >= limit) return;
    if (k === M * M) { if (goodRegion(reg) && beadAt.every((i) => beadOk(reg, beads, i))) out.push([...reg]); return; }
    for (const v of [0, 1]) {
      reg[k] = v;
      const r = Math.floor(k / M), c = k % M;
      // The middles this little square finishes off can't touch corner to corner
      let ok = shape(reg, r, c) !== "bad" && (c !== M - 1 || shape(reg, r, c + 1) !== "bad");
      if (ok && r === M - 1) ok = shape(reg, r + 1, c) !== "bad" && (c !== M - 1 || shape(reg, r + 1, c + 1) !== "bad");
      if (ok) for (const i of beadAt) if (beadOk(reg, beads, i) === false) { ok = false; break; }
      if (ok && c === M - 1) ok = stillPossible(reg, r);
      // Once the region has closed up, nothing more can be inside
      if (ok && v === 1 && r > 0 && closed(reg, r - 1)) ok = false;
      if (ok) go(k + 1);
    }
    reg[k] = -1;
  };
  go(0);
  return out;
}

/** The links a region's loop uses */
export function linksOf(reg: number[]): boolean[] {
  const L = Array(LINKS).fill(false);
  for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) L[across(r, c)] = f(reg, r - 1, c) !== f(reg, r, c);
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) L[down(r, c)] = f(reg, r, c - 1) !== f(reg, r, c);
  return L;
}

export function necklaceFor(date: string): { beads: Bead[]; region: number[] } {
  const rand = seededRand(`necklace:${date}`);
  for (;;) {
    const reg = Array(M * M).fill(0);
    reg[Math.floor(rand() * M * M)] = 1;
    const want = Math.floor(M * M * (0.35 + rand() * 0.2));
    for (let tries = 0; tries < 400 && reg.filter(Boolean).length < want; tries++) {
      const edge = [...Array(M * M).keys()].filter((i) => !reg[i] && [i - M, i + M, i % M ? i - 1 : -1, i % M < M - 1 ? i + 1 : -1].some((j) => j >= 0 && j < M * M && reg[j]));
      const i = edge[Math.floor(rand() * edge.length)];
      reg[i] = 1;
      if (!goodRegion(reg)) reg[i] = 0;
    }
    if (!goodRegion(reg)) continue;
    // Every middle where a bead's rule holds could have one
    const could: { i: number; b: Bead }[] = [];
    for (let i = 0; i < N * N; i++) for (const b of [1, 2] as Bead[]) { const t = Array(N * N).fill(0) as Bead[]; t[i] = b; if (beadOk(reg, t, i)) could.push({ i, b }); }
    if (could.length < 16) continue;
    const beads = Array(N * N).fill(0) as Bead[];
    const order = shuffled(could, rand);
    // Plenty of beads to start, then one more at a time until there's only one answer (more beads also make it quicker to check)
    for (const x of order.slice(0, 16)) if (!beads[x.i]) beads[x.i] = x.b;
    let k = 16;
    while (answers(beads).length !== 1 && k < order.length) { const x = order[k++]; if (!beads[x.i]) beads[x.i] = x.b; }
    if (answers(beads).length !== 1) continue;
    return { beads, region: reg };
  }
}

/** Is a set of drawn links one simple loop through every bead, keeping the bead rules? */
export function isSolved(beads: Bead[], links: boolean[]) {
  const deg = Array(N * N).fill(0), nbr: number[][] = Array.from({ length: N * N }, () => []);
  for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) if (links[across(r, c)]) { const a = r * N + c; deg[a]++; deg[a + 1]++; nbr[a].push(a + 1); nbr[a + 1].push(a); }
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) if (links[down(r, c)]) { const a = r * N + c; deg[a]++; deg[a + N]++; nbr[a].push(a + N); nbr[a + N].push(a); }
  if (deg.some((d) => d !== 0 && d !== 2)) return false;
  const on = deg.flatMap((d, i) => (d ? [i] : []));
  if (!on.length) return false;
  const seen = new Set([on[0]]), stack = [on[0]];
  while (stack.length) for (const j of nbr[stack.pop()!]) if (!seen.has(j)) { seen.add(j); stack.push(j); }
  if (seen.size !== on.length) return false;
  const straight = (i: number) => nbr[i].length === 2 && (nbr[i][0] + nbr[i][1] === 2 * i);
  for (let i = 0; i < N * N; i++) {
    if (!beads[i]) continue;
    if (deg[i] !== 2) return false;
    if (beads[i] === 1) { if (!straight(i) || !nbr[i].some((j) => !straight(j))) return false; }
    else { if (straight(i) || !nbr[i].every((j) => straight(j) && (2 * j - i === nbr[j][0] || 2 * j - i === nbr[j][1]))) return false; }
  }
  return true;
}
