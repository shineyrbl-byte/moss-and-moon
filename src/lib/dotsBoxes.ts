// Sugar cubes: dots and boxes against the computer. Draw a line; close a box to claim it and go again. Pure, so the page and tests share it.
export const R = 5, C = 5; // boxes
export type Level = "easy" | "hard";
export type Side = 0 | 1; // 0 you, 1 the computer
export type State = { lines: boolean[]; owner: (Side | null)[] };

export const H_COUNT = (R + 1) * C; // horizontal lines first, then vertical
export const LINES = H_COUNT + R * (C + 1);
export const hLine = (r: number, c: number) => r * C + c;
export const vLine = (r: number, c: number) => H_COUNT + r * (C + 1) + c;
/** The four lines round a box */
export const sides = (b: number) => { const r = Math.floor(b / C), c = b % C; return [hLine(r, c), hLine(r + 1, c), vLine(r, c), vLine(r, c + 1)]; };
const BOX_SIDES = [...Array(R * C).keys()].map(sides);
/** The one or two boxes a line borders */
export const boxesOf = (l: number) => BOX_SIDES.flatMap((s, b) => (s.includes(l) ? [b] : []));
const LINE_BOXES = [...Array(LINES).keys()].map(boxesOf);

export const start = (): State => ({ lines: Array(LINES).fill(false), owner: Array(R * C).fill(null) });
const drawn = (s: State, b: number) => BOX_SIDES[b].filter((l) => s.lines[l]).length;
export const open = (s: State) => s.lines.flatMap((x, i) => (x ? [] : [i]));
export const over = (s: State) => s.lines.every(Boolean);
export const score = (s: State, who: Side) => s.owner.filter((o) => o === who).length;

/** Draw a line. Returns how many boxes it closed (closing any means the same player goes again). */
export function play(s: State, l: number, who: Side): { state: State; closed: number } | null {
  if (s.lines[l]) return null;
  const lines = [...s.lines]; lines[l] = true;
  const owner = [...s.owner];
  let closed = 0;
  for (const b of LINE_BOXES[l]) if (BOX_SIDES[b].every((x) => lines[x])) { owner[b] = who; closed++; }
  return { state: { lines, owner }, closed };
}

/** A line that closes a box right now */
const closing = (s: State) => open(s).filter((l) => LINE_BOXES[l].some((b) => drawn(s, b) === 3));
/** A line that doesn't hand over a box (no box ends up with three sides) */
const safe = (s: State) => open(s).filter((l) => LINE_BOXES[l].every((b) => drawn(s, b) < 2));
/** How many boxes the other player could grab in a row after this line */
function giveaway(s: State, l: number) {
  let st = play(s, l, 0)!.state, n = 0;
  for (;;) {
    const c = closing(st);
    if (!c.length) return n;
    const r = play(st, c[0], 1)!;
    st = r.state; n += r.closed;
  }
}

/** The computer's line. Easy grabs most boxes and is careless about handing them over. Hard takes every box, plays safe while it can,
 * then gives away the fewest it has to, and keeps the last two boxes of a long chain for you so it gets the next chain. */
export function bestLine(s: State, level: Level, rand = Math.random): number {
  const o = open(s), pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const c = closing(s), sf = safe(s);
  if (level === "easy") {
    if (c.length && rand() < 0.8) return pick(c);
    if (sf.length && rand() < 0.6) return pick(sf);
    return pick(o);
  }
  if (c.length === 1 && !sf.length) {
    // The last two boxes of a chain: X has three sides (closed by L), Y next to it has two, and the chain stops after Y.
    // Taking both means we then have to open the next chain for you; drawing Y's far side (M) hands you the two and you open it for us.
    const L = c[0], X = LINE_BOXES[L].find((b) => drawn(s, b) === 3)!, Y = LINE_BOXES[L].find((b) => b !== X);
    if (Y !== undefined && drawn(s, Y) === 2) {
      const M = BOX_SIDES[Y].find((l) => !s.lines[l] && l !== L)!;
      const Z = LINE_BOXES[M].find((b) => b !== Y);
      if (Z === undefined || drawn(s, Z) < 2) {
        const rest = play(play(s, L, 1)!.state, M, 1)!.state;
        const next = open(rest);
        if (next.length && Math.min(...next.map((l) => giveaway(rest, l))) > 2) return M;
      }
    }
  }
  if (c.length) return c[0];
  if (sf.length) return pick(sf);
  let best = o[0], bestN = Infinity;
  for (const l of o) { const n = giveaway(s, l); if (n < bestN) { bestN = n; best = l; } }
  return best;
}
