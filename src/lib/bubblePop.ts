// Bubble pop: aim and fire bubbles of sugar syrup. Join three or more of a colour and they pop; any left hanging
// fall too, for more. Every few shots without a pop, the ceiling comes down a row. Pure, so the page and tests share it.
export const COLS = 9, ROWS = 13, R = 1; // positions in bubble widths: radius 1, so a row is 2 wide
export const W = COLS * 2 + 1, H = ROWS * 1.75 + 4;
export const COLOURS = ["#e391a8", "#8a5a40", "#9fae8d", "#e8b86a", "#a5c8e8"];
export const BUBBLE_MAX = 99_990;
export type State = { grid: (number | null)[]; next: number; after: number; score: number; shots: number; misses: number; over: boolean; seed: number; rows: number };
export const SHOOTER = { x: W / 2, y: H - 1.4 };

export const cx = (i: number, rows0 = 0) => { const r = Math.floor(i / COLS), c = i % COLS; return 1 + c * 2 + ((r + rows0) % 2 ? 1 : 0); };
export const cy = (i: number) => 1 + Math.floor(i / COLS) * 1.75;
export function rng(seed: number): [number, number] { const s = (seed * 1103515245 + 12345) % 2147483648; return [s / 2147483648, s]; }
const draw = (st: { seed: number }, n: number) => { const [r, s] = rng(st.seed); st.seed = s; return Math.floor(r * n); };

/** Neighbouring slots in the offset grid */
export function around(i: number, rows0: number) {
  const r = Math.floor(i / COLS), c = i % COLS, odd = (r + rows0) % 2 === 1;
  const ds = odd ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]] : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
  return ds.map(([dr, dc]) => [r + dr, c + dc]).filter(([rr, cc]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS).map(([rr, cc]) => rr * COLS + cc);
}
const coloursLeft = (g: (number | null)[]) => [...new Set(g.filter((x): x is number => x !== null))];
export function newGame(seed: number): State {
  const st = { seed: Math.max(1, Math.floor(seed) % 2147483647) };
  const grid: (number | null)[] = Array(ROWS * COLS).fill(null);
  for (let i = 0; i < COLS * 5; i++) grid[i] = draw(st, COLOURS.length);
  return { grid, next: draw(st, COLOURS.length), after: draw(st, COLOURS.length), score: 0, shots: 0, misses: 0, over: false, seed: st.seed, rows: 0 };
}

/** Where a shot at this angle (radians, 0 = straight up) ends up, and the path it takes (bouncing off the walls) */
export function trace(s: State, angle: number): { slot: number | null; path: [number, number][] } {
  let x = SHOOTER.x, y = SHOOTER.y, dx = Math.sin(angle), dy = -Math.cos(angle);
  const path: [number, number][] = [[x, y]];
  const filled = s.grid.flatMap((v, i) => (v === null ? [] : [[cx(i, s.rows), cy(i)]]));
  for (let k = 0; k < 4000; k++) {
    x += dx * 0.1; y += dy * 0.1;
    if (x < R) { x = R; dx = -dx; path.push([x, y]); }
    if (x > W - R) { x = W - R; dx = -dx; path.push([x, y]); }
    const hit = y <= R || filled.some(([bx, by]) => Math.abs(bx - x) < 1.85 && Math.abs(by - y) < 1.85 && Math.hypot(bx - x, by - y) < 1.85);
    if (hit) {
      path.push([x, y]);
      // Settle into the nearest empty slot
      let best: number | null = null, bd = Infinity;
      for (let i = 0; i < ROWS * COLS; i++) {
        if (s.grid[i] !== null) continue;
        const touchesSomething = Math.floor(i / COLS) === 0 || around(i, s.rows).some((j) => s.grid[j] !== null);
        if (!touchesSomething) continue;
        const d = Math.hypot(cx(i, s.rows) - x, cy(i) - y);
        if (d < bd) { bd = d; best = i; }
      }
      return { slot: best, path };
    }
  }
  return { slot: null, path };
}
/** Fire: the bubble sticks, matches pop, loose ones fall. */
export function fire(s0: State, angle: number): { s: State; popped: number; dropped: number; slot: number | null } {
  if (s0.over) return { s: s0, popped: 0, dropped: 0, slot: null };
  const { slot } = trace(s0, angle);
  if (slot === null) return { s: s0, popped: 0, dropped: 0, slot: null };
  const s: State = { ...s0, grid: [...s0.grid], shots: s0.shots + 1 };
  const colour = s.next;
  s.grid[slot] = colour;
  // The same-colour group the new bubble joined
  const group = new Set([slot]), todo = [slot];
  while (todo.length) for (const j of around(todo.pop()!, s.rows)) if (s.grid[j] === colour && !group.has(j)) { group.add(j); todo.push(j); }
  let popped = 0, dropped = 0;
  if (group.size >= 3) {
    for (const i of group) s.grid[i] = null;
    popped = group.size;
    // Anything no longer hanging from the ceiling falls
    const held = new Set<number>(), q = [...Array(COLS).keys()].filter((c) => s.grid[c] !== null);
    q.forEach((i) => held.add(i));
    while (q.length) for (const j of around(q.pop()!, s.rows)) if (s.grid[j] !== null && !held.has(j)) { held.add(j); q.push(j); }
    s.grid.forEach((v, i) => { if (v !== null && !held.has(i)) { s.grid[i] = null; dropped++; } });
    s.score += popped * 10 + dropped * 20;
    s.misses = 0;
  } else s.misses++;
  // Five shots without a pop, or every tenth shot anyway: the ceiling drops a row
  if (s.misses >= 5 || s.shots % 10 === 0) {
    s.misses = 0;
    const st = { seed: s.seed };
    const newRow = [...Array(COLS).keys()].map(() => { const left = coloursLeft(s.grid); return left.length ? left[draw(st, left.length)] : draw(st, COLOURS.length); });
    s.grid = [...newRow, ...s.grid.slice(0, (ROWS - 1) * COLS)];
    s.rows = (s.rows + 1) % 2;
    s.seed = st.seed;
  }
  const st = { seed: s.seed }, left = coloursLeft(s.grid);
  s.next = left.includes(s.after) || !left.length ? s.after : left[draw(st, left.length)];
  s.after = left.length ? left[draw(st, left.length)] : draw(st, COLOURS.length);
  s.seed = st.seed;
  // Cleared the lot? A fresh ceiling, and a bonus
  if (!left.length) { const g = newGame(s.seed); s.grid = g.grid; s.score += 500; s.rows = 0; }
  // Lost if bubbles reach the shooter's line
  s.over = s.grid.some((v, i) => v !== null && cy(i) > SHOOTER.y - 2.5);
  return { s, popped, dropped, slot };
}
