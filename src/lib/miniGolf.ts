// Mini golf round the café: nine little holes with walls, a few bumpers and the odd sugar-bowl obstacle. Pull back
// to aim and set the power, let go to putt. Fewest strokes wins. Pure physics, so the page and tests share it.
export const W = 300, H = 480;
export const BALL_R = 6, HOLE_R = 10;
const FRICTION = 0.985; // per 1/120 s
export type Seg = [number, number, number, number];
export type Hole = { name: string; par: number; tee: [number, number]; cup: [number, number]; walls: Seg[]; bumpers: { x: number; y: number; r: number }[] };
const box = (x1: number, y1: number, x2: number, y2: number): Seg[] => [[x1, y1, x2, y1], [x2, y1, x2, y2], [x2, y2, x1, y2], [x1, y2, x1, y1]];

export const HOLES: Hole[] = [
  { name: "The counter", par: 2, tee: [150, 420], cup: [150, 80], walls: box(90, 40, 210, 450), bumpers: [] },
  { name: "Round the till", par: 3, tee: [80, 420], cup: [220, 80], walls: [...box(40, 40, 260, 450), [40, 250, 190, 250]], bumpers: [] },
  { name: "Sugar bowl", par: 2, tee: [150, 420], cup: [150, 90], walls: box(60, 40, 240, 450), bumpers: [{ x: 150, y: 250, r: 28 }] },
  { name: "The zigzag", par: 3, tee: [70, 420], cup: [230, 70], walls: [...box(30, 30, 270, 450), [30, 320, 200, 320], [100, 180, 270, 180]], bumpers: [] },
  { name: "Saucer stack", par: 3, tee: [150, 430], cup: [150, 70], walls: box(40, 30, 260, 460), bumpers: [{ x: 100, y: 300, r: 18 }, { x: 200, y: 300, r: 18 }, { x: 150, y: 200, r: 18 }, { x: 90, y: 130, r: 14 }, { x: 210, y: 130, r: 14 }] },
  { name: "Long table", par: 2, tee: [60, 240], cup: [250, 240], walls: [...box(30, 180, 280, 300)], bumpers: [{ x: 150, y: 215, r: 12 }, { x: 150, y: 265, r: 12 }] },
  { name: "The doorway", par: 3, tee: [150, 430], cup: [150, 70], walls: [...box(40, 30, 260, 460), [40, 240, 125, 240], [175, 240, 260, 240]], bumpers: [{ x: 150, y: 150, r: 16 }] },
  { name: "Window seat", par: 4, tee: [240, 430], cup: [70, 70], walls: [...box(30, 30, 270, 460), [110, 120, 110, 460], [190, 30, 190, 370]], bumpers: [] },
  { name: "The espresso machine", par: 3, tee: [70, 430], cup: [150, 240], walls: [...box(30, 30, 270, 460), [100, 170, 200, 170], [200, 170, 200, 310], [200, 310, 100, 310], [100, 310, 100, 260]], bumpers: [{ x: 230, y: 90, r: 14 }] },
];

export type Ball = { x: number; y: number; vx: number; vy: number };
export type State = { hole: number; ball: Ball; strokes: number[]; moving: boolean; sunk: boolean; done: boolean };
export const newRound = (): State => ({ hole: 0, ball: { x: HOLES[0].tee[0], y: HOLES[0].tee[1], vx: 0, vy: 0 }, strokes: HOLES.map(() => 0), moving: false, sunk: false, done: false });
export const MAX_POWER = 620; // px/s
export function putt(s: State, dx: number, dy: number): State {
  if (s.moving || s.sunk || s.done) return s;
  const len = Math.hypot(dx, dy), k = Math.min(1, len / 120);
  if (len < 4) return s;
  const strokes = s.strokes.map((n, i) => (i === s.hole ? n + 1 : n));
  return { ...s, ball: { ...s.ball, vx: (dx / len) * MAX_POWER * k, vy: (dy / len) * MAX_POWER * k }, strokes, moving: true };
}
function bounceSeg(b: Ball, [x1, y1, x2, y2]: Seg) {
  const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  const k = Math.max(0, Math.min(1, ((b.x - x1) * dx + (b.y - y1) * dy) / len2));
  const px = x1 + k * dx, py = y1 + k * dy, ox = b.x - px, oy = b.y - py, d = Math.hypot(ox, oy);
  if (d >= BALL_R || d === 0) return;
  const nx = ox / d, ny = oy / d;
  b.x = px + nx * BALL_R; b.y = py + ny * BALL_R;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; }
}
/** Roll on by dt seconds */
export function step(s0: State, dt: number): State {
  if (!s0.moving) return s0;
  const s = { ...s0, ball: { ...s0.ball } }, hole = HOLES[s.hole], b = s.ball;
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  for (let k = 0; k < n; k++) {
    b.x += b.vx * h; b.y += b.vy * h;
    for (const w of hole.walls) bounceSeg(b, w);
    for (const c of hole.bumpers) {
      const ox = b.x - c.x, oy = b.y - c.y, d = Math.hypot(ox, oy), rad = c.r + BALL_R;
      if (d < rad && d > 0) { const nx = ox / d, ny = oy / d; b.x = c.x + nx * rad; b.y = c.y + ny * rad; const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.9 * vn * nx; b.vy -= 1.9 * vn * ny; } }
    }
    const f = Math.pow(FRICTION, h * 120); b.vx *= f; b.vy *= f;
    // Drops in if it's over the cup and not going too fast
    const toCup = Math.hypot(b.x - hole.cup[0], b.y - hole.cup[1]), speed = Math.hypot(b.vx, b.vy);
    if (toCup < HOLE_R - 2 && speed < 340) { s.sunk = true; s.moving = false; b.x = hole.cup[0]; b.y = hole.cup[1]; b.vx = b.vy = 0; break; }
    if (speed < 6) { b.vx = b.vy = 0; s.moving = false; break; }
  }
  // Six over par: pick it up and move on
  if (!s.moving && !s.sunk && s.strokes[s.hole] >= hole.par + 6) s.sunk = true;
  return s;
}
export function nextHole(s: State): State {
  if (!s.sunk) return s;
  const h = s.hole + 1;
  if (h >= HOLES.length) return { ...s, done: true };
  return { ...s, hole: h, ball: { x: HOLES[h].tee[0], y: HOLES[h].tee[1], vx: 0, vy: 0 }, sunk: false, moving: false };
}
export const total = (s: State) => s.strokes.reduce((a, b) => a + b, 0);
export const PAR = HOLES.reduce((a, h) => a + h.par, 0);
