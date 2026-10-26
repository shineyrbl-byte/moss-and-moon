// Bean breaker: bounce a coffee bean off the saucer to knock out the sugar cubes. The world is 100 wide and 140 tall,
// and step() moves everything on by dt seconds. Pure, so the page and tests share it.
export const W = 100, H = 140;
export const COLS = 8, BRICK_H = 5, TOP = 16, GAP = 1;
export const BALL_R = 2, PAD_Y = 130, PAD_H = 3;
export const PAD_W = 18, WIDE_W = 28;
export const LIVES = 3;
export const BREAKER_MAX = 99_990;
export const POINTS = [50, 40, 30, 20, 10, 10]; // by row, top row first
export type Power = "wide" | "slow" | "life" | "multi";
export type Ball = { x: number; y: number; vx: number; vy: number };
export type Brick = { r: number; c: number; hp: number };
export type Drop = { x: number; y: number; kind: Power };
export type State = {
  level: number; score: number; lives: number;
  pad: number; // the saucer's centre
  balls: Ball[]; bricks: Brick[]; drops: Drop[];
  stuck: boolean; // the bean sits on the saucer until you launch it
  wide: number; slow: number; // seconds left on each power-up
  over: boolean; cleared: boolean;
};

const brickW = (W - GAP * (COLS + 1)) / COLS;
export const brickBox = (b: Brick) => ({ x: GAP + b.c * (brickW + GAP), y: TOP + b.r * (BRICK_H + GAP), w: brickW, h: BRICK_H });
export const speedFor = (level: number) => Math.min(110, 62 + level * 7);

/** The wall for a level: a few shapes in turn, and from level 3 some cubes take two hits */
export function wall(level: number): Brick[] {
  const rows = Math.min(6, 4 + Math.floor(level / 2));
  const shape = (level - 1) % 4;
  const out: Brick[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
    if (shape === 1 && (r + c) % 2) continue; // checker
    if (shape === 2 && (c === 0 || c === COLS - 1) && r < 2) continue; // tray
    if (shape === 3 && Math.abs(c - 3.5) < r - 1.5) continue; // cone
    out.push({ r, c, hp: level >= 3 && r === 0 ? 2 : 1 });
  }
  return out;
}

export function newGame(): State {
  return { level: 1, score: 0, lives: LIVES, pad: W / 2, balls: [{ x: W / 2, y: PAD_Y - BALL_R, vx: 0, vy: 0 }], bricks: wall(1), drops: [], stuck: true, wide: 0, slow: 0, over: false, cleared: false };
}
export function nextLevel(s: State): State {
  const level = s.level + 1;
  return { ...s, level, pad: W / 2, balls: [{ x: W / 2, y: PAD_Y - BALL_R, vx: 0, vy: 0 }], bricks: wall(level), drops: [], stuck: true, wide: 0, slow: 0, cleared: false };
}
export const padW = (s: State) => (s.wide > 0 ? WIDE_W : PAD_W);

/** Send the bean off the saucer, a little to one side */
export function launch(s: State, rand: () => number = Math.random): State {
  if (!s.stuck || s.over) return s;
  const v = speedFor(s.level), a = (-0.35 + rand() * 0.7);
  return { ...s, stuck: false, balls: s.balls.map((b) => ({ ...b, vx: v * Math.sin(a), vy: -v * Math.cos(a) })) };
}
/** Move the saucer to x (its centre), kept on the table */
export function movePad(s: State, x: number): State {
  const w = padW(s), pad = Math.max(w / 2, Math.min(W - w / 2, x));
  return { ...s, pad, balls: s.stuck ? s.balls.map((b) => ({ ...b, x: pad })) : s.balls };
}

const POWERS: Power[] = ["wide", "slow", "multi", "life"];

/** Move the world on by dt seconds (keep dt small: the page passes at most 1/60 at a time) */
export function step(s0: State, dt: number, rand: () => number = Math.random): State {
  if (s0.over || s0.cleared || s0.stuck) return s0;
  const s: State = { ...s0, bricks: s0.bricks.map((b) => ({ ...b })), drops: s0.drops.map((d) => ({ ...d })), wide: Math.max(0, s0.wide - dt), slow: Math.max(0, s0.slow - dt) };
  const k = s.slow > 0 ? 0.65 : 1;
  const w = padW(s);
  const balls: Ball[] = [];
  for (const b0 of s0.balls) {
    const b = { ...b0 };
    b.x += b.vx * dt * k; b.y += b.vy * dt * k;
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
    if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); }
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
    // The saucer: where it lands sets the angle it leaves at
    if (b.vy > 0 && b.y + BALL_R >= PAD_Y && b.y + BALL_R <= PAD_Y + PAD_H + 2 && Math.abs(b.x - s.pad) <= w / 2 + BALL_R) {
      const v = Math.hypot(b.vx, b.vy), off = Math.max(-1, Math.min(1, (b.x - s.pad) / (w / 2)));
      const a = off * 1.05 + (rand() - 0.5) * 0.08; // up to about 60° from straight up, with a little wobble so it never loops
      b.vx = v * Math.sin(a); b.vy = -v * Math.cos(a); b.y = PAD_Y - BALL_R;
    }
    // Cubes: bounce off the side it came in from
    for (const br of s.bricks) {
      if (br.hp <= 0) continue;
      const box = brickBox(br);
      const nx = Math.max(box.x, Math.min(b.x, box.x + box.w)), ny = Math.max(box.y, Math.min(b.y, box.y + box.h));
      if ((b.x - nx) ** 2 + (b.y - ny) ** 2 > BALL_R ** 2) continue;
      const fromSide = nx === box.x || nx === box.x + box.w ? Math.abs(b.x - nx) > Math.abs(b.y - ny) : false;
      if (fromSide) b.vx = -b.vx; else b.vy = -b.vy;
      br.hp--;
      if (br.hp === 0) {
        s.score += POINTS[br.r] ?? 10;
        if (rand() < 0.12) s.drops.push({ x: box.x + box.w / 2, y: box.y + box.h, kind: POWERS[Math.floor(rand() * POWERS.length)] });
      }
      break;
    }
    if (b.y - BALL_R <= H) balls.push(b);
  }
  s.bricks = s.bricks.filter((b) => b.hp > 0);
  // Falling power-ups: caught by the saucer, or lost off the bottom
  const kept: Drop[] = [];
  for (const d of s.drops) {
    d.y += 34 * dt;
    if (d.y >= PAD_Y && d.y <= PAD_Y + PAD_H + 3 && Math.abs(d.x - s.pad) <= w / 2 + 2) {
      if (d.kind === "wide") s.wide = 12;
      if (d.kind === "slow") s.slow = 10;
      if (d.kind === "life") s.lives = Math.min(5, s.lives + 1);
      if (d.kind === "multi" && balls.length) { const b = balls[0]; balls.push({ ...b, vx: -b.vx || 20 }, { ...b, vx: b.vx * 0.5 + 15, vy: -Math.abs(b.vy) }); }
    } else if (d.y < H) kept.push(d);
  }
  s.drops = kept;
  s.balls = balls;
  if (!s.bricks.length) { s.cleared = true; s.score += 100 * s.level; return s; }
  if (!balls.length) {
    s.lives--;
    if (s.lives <= 0) { s.over = true; return s; }
    s.stuck = true; s.wide = 0; s.slow = 0; s.drops = [];
    s.balls = [{ x: s.pad, y: PAD_Y - BALL_R, vx: 0, vy: 0 }];
  }
  return s;
}
