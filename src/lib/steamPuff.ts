// Steam puff: tap to puff the cloud of steam upwards and float it through the gaps between stacks of cups. The world is 100
// wide and 150 tall. Pure, so the page and tests share it.
export const W = 100, H = 150;
export const X = 26, R = 4.2;
export const GRAVITY = 260, FLAP = -92, SPEED = 42, GAP = 44, PIPE_W = 14, EVERY = 58;
export const PUFF_MAX = 9999;
export type Pipe = { x: number; gapY: number; passed: boolean };
export type State = { y: number; vy: number; pipes: Pipe[]; score: number; over: boolean; started: boolean; t: number };

export const newGame = (): State => ({ y: H / 2, vy: 0, pipes: [], score: 0, over: false, started: false, t: 0 });
export const flap = (s: State): State => (s.over ? s : { ...s, vy: FLAP, started: true });
export function step(s0: State, dt: number, rand: () => number = Math.random): State {
  if (s0.over || !s0.started) return s0;
  const s: State = { ...s0, t: s0.t + dt, pipes: [] };
  s.vy = Math.min(140, s.vy + GRAVITY * dt);
  s.y += s.vy * dt;
  if (s.y - R < 0) { s.y = R; s.vy = 0; }
  if (s.y + R > H) { s.over = true; s.y = H - R; }
  for (const p0 of s0.pipes) {
    const p = { ...p0, x: p0.x - SPEED * dt };
    if (p.x + PIPE_W < -2) continue;
    if (!p.passed && p.x + PIPE_W < X - R) { p.passed = true; s.score++; }
    // Hitting a stack: inside its column and outside the gap
    if (X + R > p.x && X - R < p.x + PIPE_W && (s.y - R < p.gapY - GAP / 2 || s.y + R > p.gapY + GAP / 2)) s.over = true;
    s.pipes.push(p);
  }
  const lastX = s.pipes.length ? s.pipes[s.pipes.length - 1].x : -Infinity;
  if (lastX < W - EVERY) {
    // Gaps move a fair way, but never more than you can float in one go
    const prev = s.pipes.length ? s.pipes[s.pipes.length - 1].gapY : H / 2;
    const gapY = Math.max(GAP / 2 + 12, Math.min(H - GAP / 2 - 12, prev + (rand() - 0.5) * 70));
    s.pipes.push({ x: W + 4, gapY, passed: false });
  }
  return s;
}
