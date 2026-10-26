// Pastry drop: falling pastry pieces (the seven four-square shapes). Fill a row right across to clear it. It speeds up
// every ten rows. Pure, so the page and tests share it.
export const COLS = 10, ROWS = 20;
export const PASTRY_MAX = 9_999_990;
export type Kind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const KINDS: Kind[] = ["I", "O", "T", "S", "Z", "J", "L"];
export const NAMES: Record<Kind, string> = { I: "Baguette", O: "Brownie", T: "Croissant", S: "Swiss roll", Z: "Twist", J: "Éclair", L: "Danish" };
// Each shape as squares in a 4×4 box, in its four turns
const SHAPES: Record<Kind, number[][][]> = (() => {
  const base: Record<Kind, number[][]> = {
    I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
    S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  };
  const out = {} as Record<Kind, number[][][]>;
  for (const k of KINDS) {
    const size = k === "I" ? 4 : k === "O" ? 4 : 3;
    const turns = [base[k]];
    for (let t = 1; t < 4; t++) turns.push(k === "O" ? base[k] : turns[t - 1].map(([x, y]) => [size - 1 - y, x]));
    out[k] = turns;
  }
  return out;
})();
export type Piece = { kind: Kind; turn: number; x: number; y: number };
export type State = {
  grid: (Kind | null)[]; piece: Piece; next: Kind[]; hold: Kind | null; held: boolean;
  score: number; lines: number; level: number; over: boolean; fall: number; // seconds until it drops a row
  cleared: number[]; // rows just cleared, for the flash
};

export const cellsOf = (p: Piece) => SHAPES[p.kind][p.turn].map(([x, y]) => [p.x + x, p.y + y] as const);
export function fits(grid: (Kind | null)[], p: Piece) {
  return cellsOf(p).every(([x, y]) => x >= 0 && x < COLS && y < ROWS && (y < 0 || !grid[y * COLS + x]));
}
/** A fresh bag of all seven, shuffled, so you never wait too long for a baguette */
export function bag(rand: () => number): Kind[] {
  const b = [...KINDS];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
const spawn = (kind: Kind): Piece => ({ kind, turn: 0, x: kind === "O" ? 3 : 3, y: kind === "I" ? -1 : 0 });
export const dropSecs = (level: number) => Math.max(0.06, 0.8 * Math.pow(0.85, level - 1));

export function newGame(rand: () => number = Math.random): State {
  const next = [...bag(rand), ...bag(rand)];
  return { grid: Array(COLS * ROWS).fill(null), piece: spawn(next.shift()!), next, hold: null, held: false, score: 0, lines: 0, level: 1, over: false, fall: dropSecs(1), cleared: [] };
}

/** Move sideways (dx) or turn (dt = 1 clockwise, -1 back), nudging off a wall if it needs to */
export function shift(s: State, dx: number, dt = 0): State {
  if (s.over) return s;
  const p = { ...s.piece, x: s.piece.x + dx, turn: (s.piece.turn + dt + 4) % 4 };
  for (const kick of dt ? [0, -1, 1, -2, 2] : [0]) {
    const q = { ...p, x: p.x + kick };
    if (fits(s.grid, q)) return { ...s, piece: q };
    if (dt) { const up = { ...q, y: q.y - 1 }; if (fits(s.grid, up)) return { ...s, piece: up }; }
  }
  return s;
}
/** Where the piece would land */
export function landing(s: State): Piece {
  let p = s.piece;
  while (fits(s.grid, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
  return p;
}
const LINE_POINTS = [0, 100, 300, 500, 800];

/** Set the piece down, clear full rows and bring in the next one */
function lock(s: State, p: Piece, bonus: number, rand: () => number): State {
  const grid = [...s.grid];
  let above = false;
  for (const [x, y] of cellsOf(p)) { if (y < 0) above = true; else grid[y * COLS + x] = p.kind; }
  const full = [...Array(ROWS).keys()].filter((r) => grid.slice(r * COLS, r * COLS + COLS).every(Boolean));
  const kept = [...Array(ROWS).keys()].filter((r) => !full.includes(r)).flatMap((r) => grid.slice(r * COLS, r * COLS + COLS));
  const g2 = [...Array(full.length * COLS).fill(null), ...kept];
  const lines = s.lines + full.length, level = 1 + Math.floor(lines / 10);
  let next = s.next;
  if (next.length < 7) next = [...next, ...bag(rand)];
  const piece = spawn(next[0]);
  const t: State = { ...s, grid: g2, piece, next: next.slice(1), held: false, lines, level, score: s.score + bonus + LINE_POINTS[full.length] * s.level, fall: dropSecs(level), cleared: full };
  if (above || !fits(g2, piece)) t.over = true;
  return t;
}
/** Drop it straight down: 2 points a row it falls */
export function hardDrop(s: State, rand: () => number = Math.random): State {
  if (s.over) return s;
  const p = landing(s);
  return lock(s, p, 2 * (p.y - s.piece.y), rand);
}
/** Down one row (soft drop gives 1 point), locking it if it can't go further */
export function down(s: State, soft = false, rand: () => number = Math.random): State {
  if (s.over) return s;
  const p = { ...s.piece, y: s.piece.y + 1 };
  if (fits(s.grid, p)) return { ...s, piece: p, score: s.score + (soft ? 1 : 0), fall: dropSecs(s.level), cleared: [] };
  return lock(s, s.piece, 0, rand);
}
/** Time passing */
export function tick(s: State, dt: number, rand: () => number = Math.random): State {
  if (s.over) return s;
  let t = { ...s, fall: s.fall - dt };
  while (t.fall <= 0 && !t.over) { const f = t.fall; t = down(t, false, rand); t.fall += f; }
  return t;
}
/** Put this piece aside for later (once per piece) */
export function hold(s: State): State {
  if (s.over || s.held) return s;
  const take = s.hold ?? s.next[0];
  const next = s.hold ? s.next : s.next.slice(1);
  const piece = spawn(take);
  if (!fits(s.grid, piece)) return s;
  return { ...s, hold: s.piece.kind, held: true, piece, next };
}
