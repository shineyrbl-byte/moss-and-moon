// Café chess: the full rules (castling, en passant, promotion, check, mate, stalemate and the usual draws) and a computer
// player. Squares run 0 (a8, top left) to 63 (h1); white pieces are capitals. Pure, so the page and tests share it.
export type Piece = "P" | "N" | "B" | "R" | "Q" | "K" | "p" | "n" | "b" | "r" | "q" | "k";
export type Color = "w" | "b";
export type Level = "easy" | "hard";
export type Move = { from: number; to: number; promo?: "q" | "r" | "b" | "n"; castle?: "K" | "Q"; ep?: boolean; take?: Piece | null };
export type State = { b: (Piece | null)[]; turn: Color; castle: string; ep: number | null; half: number; seen: Record<string, number> };

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
export function fromFen(rows: string, turn: Color = "w", castle = "KQkq", ep: number | null = null): State {
  const b: (Piece | null)[] = [];
  for (const ch of rows.replace(/\//g, "")) { if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) b.push(null); else b.push(ch as Piece); }
  const s: State = { b, turn, castle, ep, half: 0, seen: {} };
  s.seen[key(s)] = 1;
  return s;
}
export const newGame = () => fromFen(START);
export const colorOf = (p: Piece | null): Color | null => (p ? (p === p.toUpperCase() ? "w" : "b") : null);
export const sq = (name: string) => (8 - +name[1]) * 8 + (name.charCodeAt(0) - 97);
export const name = (i: number) => `${String.fromCharCode(97 + (i % 8))}${8 - Math.floor(i / 8)}`;
const R = (i: number) => Math.floor(i / 8), C = (i: number) => i % 8;
const on = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
function key(s: State) { return s.b.map((p) => p ?? ".").join("") + s.turn + s.castle + (s.ep ?? "-"); }

/** Is square i attacked by `by`? */
export function attacked(b: (Piece | null)[], i: number, by: Color): boolean {
  const r = R(i), c = C(i), up = by === "w" ? 1 : -1; // white pawns attack upwards (towards row 0)
  for (const dc of [-1, 1]) { const rr = r + up, cc = c + dc; if (on(rr, cc) && b[rr * 8 + cc] === (by === "w" ? "P" : "p")) return true; }
  for (const [dr, dc] of KN) { const rr = r + dr, cc = c + dc; if (on(rr, cc) && b[rr * 8 + cc] === (by === "w" ? "N" : "n")) return true; }
  for (const [dr, dc] of KG) { const rr = r + dr, cc = c + dc; if (on(rr, cc) && b[rr * 8 + cc] === (by === "w" ? "K" : "k")) return true; }
  for (const [dirs, kinds] of [[DIAG, "BQ"], [ORTH, "RQ"]] as const) for (const [dr, dc] of dirs) {
    for (let rr = r + dr, cc = c + dc; on(rr, cc); rr += dr, cc += dc) {
      const p = b[rr * 8 + cc];
      if (!p) continue;
      if (colorOf(p) === by && kinds.includes(p.toUpperCase())) return true;
      break;
    }
  }
  return false;
}
export const kingAt = (b: (Piece | null)[], c: Color) => b.indexOf(c === "w" ? "K" : "k");
export const inCheck = (s: State, c: Color = s.turn) => attacked(s.b, kingAt(s.b, c), c === "w" ? "b" : "w");

function pseudo(s: State): Move[] {
  const out: Move[] = [], me = s.turn, b = s.b;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || colorOf(p) !== me) continue;
    const r = R(i), c = C(i), t = p.toUpperCase();
    const add = (to: number) => {
      if (t === "P" && (R(to) === 0 || R(to) === 7)) for (const promo of ["q", "r", "b", "n"] as const) out.push({ from: i, to, promo, take: b[to] });
      else out.push({ from: i, to, take: b[to] });
    };
    if (t === "P") {
      const dir = me === "w" ? -1 : 1, startRow = me === "w" ? 6 : 1;
      if (on(r + dir, c) && !b[(r + dir) * 8 + c]) {
        add((r + dir) * 8 + c);
        if (r === startRow && !b[(r + 2 * dir) * 8 + c]) out.push({ from: i, to: (r + 2 * dir) * 8 + c, take: null });
      }
      for (const dc of [-1, 1]) {
        if (!on(r + dir, c + dc)) continue;
        const to = (r + dir) * 8 + c + dc;
        if (b[to] && colorOf(b[to]) !== me) add(to);
        else if (to === s.ep) out.push({ from: i, to, ep: true, take: me === "w" ? "p" : "P" });
      }
    } else if (t === "N" || t === "K") {
      for (const [dr, dc] of t === "N" ? KN : KG) { const rr = r + dr, cc = c + dc; if (on(rr, cc) && colorOf(b[rr * 8 + cc]) !== me) add(rr * 8 + cc); }
      if (t === "K") {
        const foe = me === "w" ? "b" : "w", home = me === "w" ? 60 : 4;
        if (i === home && !attacked(b, i, foe)) {
          const [ks, qs] = me === "w" ? ["K", "Q"] : ["k", "q"];
          if (s.castle.includes(ks) && !b[i + 1] && !b[i + 2] && b[i + 3] === (me === "w" ? "R" : "r") && !attacked(b, i + 1, foe) && !attacked(b, i + 2, foe)) out.push({ from: i, to: i + 2, castle: "K", take: null });
          if (s.castle.includes(qs) && !b[i - 1] && !b[i - 2] && !b[i - 3] && b[i - 4] === (me === "w" ? "R" : "r") && !attacked(b, i - 1, foe) && !attacked(b, i - 2, foe)) out.push({ from: i, to: i - 2, castle: "Q", take: null });
        }
      }
    } else {
      const dirs = t === "B" ? DIAG : t === "R" ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, dc] of dirs) for (let rr = r + dr, cc = c + dc; on(rr, cc); rr += dr, cc += dc) {
        const x = b[rr * 8 + cc];
        if (!x) { add(rr * 8 + cc); continue; }
        if (colorOf(x) !== me) add(rr * 8 + cc);
        break;
      }
    }
  }
  return out;
}

/** Make a move without updating the position history (for looking ahead) */
function step(s: State, m: Move): State {
  const b = [...s.b], p = b[m.from]!, me = s.turn;
  b[m.to] = m.promo ? ((me === "w" ? m.promo.toUpperCase() : m.promo) as Piece) : p;
  b[m.from] = null;
  if (m.ep) b[m.to + (me === "w" ? 8 : -8)] = null;
  if (m.castle === "K") { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = null; }
  if (m.castle === "Q") { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = null; }
  let castle = s.castle;
  if (p === "K") castle = castle.replace(/[KQ]/g, ""); if (p === "k") castle = castle.replace(/[kq]/g, "");
  for (const [at, ch] of [[63, "K"], [56, "Q"], [7, "k"], [0, "q"]] as const) if (m.from === at || m.to === at) castle = castle.replace(ch, "");
  const ep = p.toUpperCase() === "P" && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null;
  return { b, turn: me === "w" ? "b" : "w", castle, ep, half: p.toUpperCase() === "P" || m.take ? 0 : s.half + 1, seen: s.seen };
}
/** Make a move (assumed legal), counting the position for repetition draws */
export function play(s: State, m: Move): State {
  const n = step(s, m);
  n.seen = { ...s.seen };
  const k = key(n); n.seen[k] = (n.seen[k] ?? 0) + 1;
  return n;
}
/** Every legal move for whoever's turn it is */
export function moves(s: State): Move[] {
  return pseudo(s).filter((m) => { const n = step(s, m); return !attacked(n.b, kingAt(n.b, s.turn), n.turn); });
}

function lowMaterial(b: (Piece | null)[]) {
  const ps = b.filter(Boolean).map((p) => p!.toUpperCase()).filter((p) => p !== "K");
  return !ps.length || (ps.length === 1 && (ps[0] === "N" || ps[0] === "B"));
}
export type Result = { over: false } | { over: true; winner: Color | null; why: "checkmate" | "stalemate" | "fifty" | "repetition" | "material" };
export function result(s: State, ms = moves(s)): Result {
  if (!ms.length) return inCheck(s) ? { over: true, winner: s.turn === "w" ? "b" : "w", why: "checkmate" } : { over: true, winner: null, why: "stalemate" };
  if (s.half >= 100) return { over: true, winner: null, why: "fifty" };
  if ((s.seen[key(s)] ?? 0) >= 3) return { over: true, winner: null, why: "repetition" };
  if (lowMaterial(s.b)) return { over: true, winner: null, why: "material" };
  return { over: false };
}

// The computer: material plus a nudge towards good squares, looked at a few moves ahead
const VAL: Record<string, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const centre = (i: number) => 3.5 - Math.max(Math.abs(R(i) - 3.5), Math.abs(C(i) - 3.5)); // 0 at the edge, 3 in the middle
function evaluate(s: State): number {
  let v = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.b[i];
    if (!p) continue;
    const t = p.toUpperCase(), sign = colorOf(p) === "w" ? 1 : -1;
    let x = VAL[t];
    if (t === "N" || t === "B") x += centre(i) * 10;
    if (t === "P") x += (colorOf(p) === "w" ? 6 - R(i) : R(i) - 1) * 8 + (C(i) >= 2 && C(i) <= 5 ? 6 : 0);
    if (t === "Q") x += centre(i) * 3;
    if (t === "K") x += (colorOf(p) === "w" ? R(i) === 7 : R(i) === 0) ? 15 : -10;
    v += sign * x;
  }
  return s.turn === "w" ? v : -v;
}
const order = (ms: Move[]) => ms.sort((a, b) => ((b.take ? VAL[b.take.toUpperCase()] * 10 : 0) + (b.promo ? 800 : 0)) - ((a.take ? VAL[a.take.toUpperCase()] * 10 : 0) + (a.promo ? 800 : 0)));

let nodes = 0;
function quiet(s: State, alpha: number, beta: number, depth: number): number {
  nodes++;
  const stand = evaluate(s);
  if (depth === 0 || stand >= beta) return stand;
  alpha = Math.max(alpha, stand);
  for (const m of order(moves(s).filter((x) => x.take || x.promo))) {
    const v = -quiet(step(s, m), -beta, -alpha, depth - 1);
    if (v >= beta) return v;
    alpha = Math.max(alpha, v);
  }
  return alpha;
}
function search(s: State, depth: number, alpha: number, beta: number, ply: number): number {
  nodes++;
  const ms = moves(s);
  if (!ms.length) return inCheck(s) ? -100_000 + ply : 0;
  if (s.half >= 100 || (s.seen[key(s)] ?? 0) >= 3) return 0;
  if (depth === 0) return quiet(s, alpha, beta, 4);
  let best = -Infinity;
  for (const m of order(ms)) {
    const v = -search(step(s, m), depth - 1, -beta, -alpha, ply + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
/** The computer's move. Hard looks three moves deep and follows captures through; easy looks one move and slips up. */
export function bestMove(s: State, level: Level, rand: () => number = Math.random): Move {
  const ms = moves(s);
  for (let i = ms.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ms[i], ms[j]] = [ms[j], ms[i]]; }
  if (level === "easy" && rand() < 0.25) return ms[0];
  const depth = level === "hard" ? 3 : 1;
  nodes = 0;
  let best = ms[0], bestV = -Infinity;
  for (const m of order(ms)) {
    const v = -search(play(s, m), depth - 1, -Infinity, -bestV, 1) + (level === "easy" ? (rand() - 0.5) * 120 : 0);
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}
export const lastNodes = () => nodes;
/** Short move name, like e4, Nf3, exd5, O-O or e8=Q */
export function san(s: State, m: Move): string {
  if (m.castle) return m.castle === "K" ? "O-O" : "O-O-O";
  const p = s.b[m.from]!.toUpperCase();
  const n = play(s, m), check = inCheck(n) ? (moves(n).length ? "+" : "#") : "";
  if (p === "P") return `${m.take ? `${name(m.from)[0]}x` : ""}${name(m.to)}${m.promo ? `=${m.promo.toUpperCase()}` : ""}${check}`;
  const twin = moves(s).filter((x) => x.to === m.to && x.from !== m.from && s.b[x.from]?.toUpperCase() === p);
  const dis = twin.length ? (twin.some((x) => C(x.from) === C(m.from)) ? name(m.from)[1] : name(m.from)[0]) : "";
  return `${p}${dis}${m.take ? "x" : ""}${name(m.to)}${check}`;
}
