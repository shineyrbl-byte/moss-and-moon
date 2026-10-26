// Delivery dash: ride the café bike along the street. Jump the puddles and crates, duck under the low awnings, and pick
// up beans. It speeds up the further you go. The world is 100 wide and 50 tall, ground at y = 0 going up. Pure, so the
// page and tests share it.
export const W = 100, H = 50;
export const RIDER_X = 16, RIDER_W = 7, RIDER_H = 9, DUCK_H = 5;
export const GRAVITY = 260, JUMP_V = 92;
export const DASH_MAX = 9_999_999;
export type Kind = "puddle" | "crate" | "awning";
export type Thing = { kind: Kind | "bean"; x: number; w: number; y: number; h: number };
export type State = { y: number; vy: number; ducking: boolean; speed: number; dist: number; beans: number; things: Thing[]; gap: number; over: boolean; hit: Kind | null };

export const newGame = (): State => ({ y: 0, vy: 0, ducking: false, speed: 34, dist: 0, beans: 0, things: [], gap: 40, over: false, hit: null });
/** Score: a point a metre (10 world units), and 10 a bean */
export const score = (s: State) => Math.floor(s.dist / 10) + s.beans * 10;
export const onGround = (s: State) => s.y <= 0 && s.vy <= 0;

export function jump(s: State): State { return s.over || !onGround(s) ? s : { ...s, vy: JUMP_V, ducking: false }; }
export function duck(s: State, on: boolean): State { return s.over ? s : { ...s, ducking: on && onGround(s) ? true : on ? s.ducking : false, vy: on && !onGround(s) ? Math.min(s.vy, -80) : s.vy }; }

/** What comes next along the street. Gaps shrink a little as you speed up, but always leave room to land and jump again. */
function spawn(s: State, rand: () => number): Thing[] {
  const r = rand(), x = W + 4;
  if (r < 0.38) return [{ kind: "puddle", x, w: 8 + rand() * 6, y: 0, h: 1.5 }];
  if (r < 0.66) return [{ kind: "crate", x, w: 5, y: 0, h: 5 + Math.floor(rand() * 2) * 2 }];
  if (r < 0.88) return [{ kind: "awning", x, w: 12, y: DUCK_H + 1.5, h: H }]; // low enough that only ducking gets under
  // A little arc of beans
  return [0, 1, 2, 3].map((k) => ({ kind: "bean" as const, x: x + k * 5, w: 2.5, y: 6 + Math.sin((k / 3) * Math.PI) * 10, h: 2.5 }));
}

const overlap = (a: { x: number; w: number; y: number; h: number }, b: Thing) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Move on by dt seconds (keep it small: the page steps at most 1/120 s at a time) */
export function step(s0: State, dt: number, rand: () => number = Math.random): State {
  if (s0.over) return s0;
  const s: State = { ...s0, things: [] };
  s.speed = Math.min(95, 34 + s0.dist / 400);
  const dx = s.speed * dt;
  s.dist += dx;
  // The rider
  s.vy -= GRAVITY * dt;
  s.y = Math.max(0, s.y + s.vy * dt);
  if (s.y === 0 && s.vy < 0) s.vy = 0;
  const me = { x: RIDER_X, w: RIDER_W, y: s.y, h: s.ducking && onGround(s) ? DUCK_H : RIDER_H };
  for (const t0 of s0.things) {
    const t = { ...t0, x: t0.x - dx };
    if (t.x + t.w < -5) continue;
    // A puddle only gets you if you land in it (a little forgiving at the edges)
    const box = t.kind === "puddle" ? { ...t, x: t.x + 1.5, w: t.w - 3 } : t;
    if (overlap(me, box as Thing)) {
      if (t.kind === "bean") { s.beans++; continue; }
      s.over = true; s.hit = t.kind;
    }
    s.things.push(t);
  }
  s.gap -= dx;
  if (s.gap <= 0) {
    s.things.push(...spawn(s, rand));
    // Enough room to land and take off again, and less of it as the bike gets quicker
    s.gap = 30 + s.speed * 0.45 + rand() * 40;
  }
  return s;
}
