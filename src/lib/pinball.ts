// Pinball parlour: a small café-themed pinball table. Launch the ball, keep it up with the flippers, hit the sugar-cube
// bumpers and roll over C-A-F-É at the top. Three balls. Pure physics, so the page and tests share it.
export const WIDTH = 320, HEIGHT = 560;
export const BALL_R = 8;
export const PINBALL_MAX = 9_999_990;
const G = 760; // the table's tilt, as gravity in px/s²
const MAX_V = 1500;

type Seg = [number, number, number, number];
/** The table's walls, as line segments */
export const WALLS: Seg[] = [
  [12, 470, 12, 70], [12, 70, 40, 24], [40, 24, 110, 10], [110, 10, 250, 10], [250, 10, 296, 30], [296, 30, 312, 70], // outside, round the top
  [312, 70, 312, 548], // shooter lane, outside
  [290, 140, 290, 470], // shooter lane, inside (the right edge of the table)
  [12, 470, 90, 508], [290, 470, 214, 508], // the guides down to the flippers
  [12, 380, 40, 410], [290, 380, 262, 410], // little kicks above the guides
];
export const BUMPERS = [{ x: 110, y: 170, r: 19 }, { x: 205, y: 165, r: 19 }, { x: 158, y: 235, r: 19 }];
export const CUP = { x: 158, y: 340, r: 15 }; // the coffee-cup target in the middle
export const ROLLOVERS = [{ x: 95, y: 62 }, { x: 140, y: 52 }, { x: 185, y: 52 }, { x: 230, y: 62 }]; // C A F É
export const FLIPPER_LEN = 50;
export const PIVOTS = [{ x: 90, y: 510 }, { x: 214, y: 510 }]; // tips stay far enough apart that a ball can't wedge between them
const REST = [0.46, Math.PI - 0.46], UP = [-0.5, Math.PI + 0.5];
const FLIP_SPEED = 20; // radians a second
export const SHOOTER = { x: 301, y: 530 };

export type Ball = { x: number; y: number; vx: number; vy: number };
export type State = { ball: Ball | null; inShooter: boolean; balls: number; score: number; angle: [number, number]; lit: boolean[]; flash: number[]; over: boolean; t: number };
export const newState = (): State => ({ ball: { x: SHOOTER.x, y: SHOOTER.y, vx: 0, vy: 0 }, inShooter: true, balls: 3, score: 0, angle: [REST[0], REST[1]], lit: [false, false, false, false], flash: [0, 0, 0, 0], over: false, t: 0 });

export const flipperTip = (k: number, a: number) => ({ x: PIVOTS[k].x + FLIPPER_LEN * Math.cos(a), y: PIVOTS[k].y + FLIPPER_LEN * Math.sin(a) });
/** Shoot the ball up the lane (power 0..1) */
export function launch(s: State, power = 0.85): State {
  if (!s.inShooter || !s.ball || s.over) return s;
  return { ...s, inShooter: false, ball: { ...s.ball, vy: -(820 + 520 * Math.max(0, Math.min(1, power))) } };
}

function bounceSeg(b: Ball, seg: Seg, rad: number, e: number, surf = { vx: 0, vy: 0 }) {
  const [x1, y1, x2, y2] = seg, dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  const k = Math.max(0, Math.min(1, ((b.x - x1) * dx + (b.y - y1) * dy) / len2));
  const px = x1 + k * dx, py = y1 + k * dy, ox = b.x - px, oy = b.y - py, d = Math.hypot(ox, oy);
  if (d >= rad || d === 0) return false;
  const nx = ox / d, ny = oy / d;
  b.x = px + nx * rad; b.y = py + ny * rad;
  const rvx = b.vx - surf.vx, rvy = b.vy - surf.vy, vn = rvx * nx + rvy * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
  return true;
}
function bounceCircle(b: Ball, c: { x: number; y: number; r: number }, kick: number) {
  const ox = b.x - c.x, oy = b.y - c.y, d = Math.hypot(ox, oy), rad = c.r + BALL_R;
  if (d >= rad || d === 0) return false;
  const nx = ox / d, ny = oy / d;
  b.x = c.x + nx * rad; b.y = c.y + ny * rad;
  const vn = b.vx * nx + b.vy * ny;
  // Bumpers fire the ball away at a good speed, whatever it came in at
  const out = Math.max(kick, -vn * 0.6);
  b.vx += (out - vn) * nx; b.vy += (out - vn) * ny;
  return true;
}

/** Move on by dt seconds, with the flipper buttons held or not */
export function step(s0: State, dt: number, held: [boolean, boolean]): State {
  if (s0.over) return s0;
  const s: State = { ...s0, angle: [...s0.angle] as [number, number], lit: [...s0.lit], flash: s0.flash.map((f) => Math.max(0, f - dt)), ball: s0.ball ? { ...s0.ball } : null, t: s0.t + dt };
  const subs = 20, h = dt / subs;
  for (let n = 0; n < subs; n++) {
    // Flippers swing towards up (held) or rest
    const omega = [0, 0];
    for (let k = 0; k < 2; k++) {
      const target = held[k] ? UP[k] : REST[k], a = s.angle[k], dir = Math.sign(target - a);
      const na = Math.abs(target - a) < FLIP_SPEED * h ? target : a + dir * FLIP_SPEED * h;
      omega[k] = (na - a) / h; s.angle[k] = na;
    }
    const b = s.ball;
    if (!b || s.inShooter) continue;
    b.vy += G * h;
    const sp = Math.hypot(b.vx, b.vy); if (sp > MAX_V) { b.vx *= MAX_V / sp; b.vy *= MAX_V / sp; }
    b.x += b.vx * h; b.y += b.vy * h;
    for (const w of WALLS) bounceSeg(b, w, BALL_R, 0.45);
    for (let k = 0; k < 2; k++) {
      const tip = flipperTip(k, s.angle[k]), p = PIVOTS[k];
      // The flipper's surface moves where the ball touches it: speed = ω × distance from the pivot
      const fx = tip.x - p.x, fy = tip.y - p.y, along = Math.max(0, Math.min(1, ((b.x - p.x) * fx + (b.y - p.y) * fy) / (fx * fx + fy * fy)));
      const cx = p.x + along * fx, cy = p.y + along * fy;
      const surf = { vx: -omega[k] * (cy - p.y), vy: omega[k] * (cx - p.x) };
      bounceSeg(b, [p.x, p.y, tip.x, tip.y], BALL_R + 5, 0.3, surf);
    }
    BUMPERS.forEach((bm, k) => { if (bounceCircle(b, bm, 560)) { s.score += 100; s.flash[k] = 0.15; } });
    if (bounceCircle(b, CUP, 380)) { s.score += 250; s.flash[3] = 0.2; }
    ROLLOVERS.forEach((r, k) => {
      if (!s.lit[k] && Math.hypot(b.x - r.x, b.y - r.y) < 13) { s.lit[k] = true; s.score += 10; }
    });
    if (s.lit.every(Boolean)) { s.score += 1000; s.lit = s.lit.map(() => false); }
    // Down the middle, or back down the shooter lane: next ball
    if (b.y > HEIGHT + 20 || (b.y > 500 && (b.x < -10 || b.x > WIDTH + 10))) {
      if (b.x > 290) { s.ball = { x: SHOOTER.x, y: SHOOTER.y, vx: 0, vy: 0 }; s.inShooter = true; continue; }
      const balls = s.balls - 1;
      s.balls = balls;
      if (balls <= 0) { s.over = true; s.ball = null; }
      else { s.ball = { x: SHOOTER.x, y: SHOOTER.y, vx: 0, vy: 0 }; s.inShooter = true; }
      break;
    }
  }
  return s;
}
