// Market run: the barista dashes through the morning market with a tray of coffees. Tap to jump the crates and duck
// (hold down) under the awnings. It speeds up as you go. Pure, so the page and tests share it.
export const W = 400, H = 200, GROUND = 160;
export const RUN_MAX = 9_999_990;
const G = 2200, JUMP = 760;
export type Thing = { x: number; w: number; h: number; kind: "crate" | "awning" | "cup" };
export type State = { y: number; vy: number; ducking: boolean; things: Thing[]; speed: number; dist: number; score: number; cups: number; over: boolean; nextIn: number; seed: number };
export const newGame = (seed = 1): State => ({ y: 0, vy: 0, ducking: false, things: [], speed: 260, dist: 0, score: 0, cups: 0, over: false, nextIn: 1.2, seed });
function rnd(s: { seed: number }) { s.seed = (s.seed * 1103515245 + 12345) % 2147483648; return s.seed / 2147483648; }
export const jump = (s: State): State => (s.over || s.y > 0 ? s : { ...s, vy: JUMP, ducking: false });
export const duck = (s: State, on: boolean): State => (s.over ? s : { ...s, ducking: on && s.y === 0 });
/** The runner's box: 24 wide, 40 tall standing or 22 ducking, x from 40 */
export const runnerBox = (s: State) => ({ x: 40, w: 24, top: GROUND - s.y - (s.ducking ? 22 : 40), bottom: GROUND - s.y });
export function step(s0: State, dt: number): State {
  if (s0.over) return s0;
  const s: State = { ...s0, things: s0.things.map((t) => ({ ...t })) };
  s.vy -= G * dt; s.y = Math.max(0, s.y + s.vy * dt); if (s.y === 0) s.vy = 0;
  s.speed = Math.min(620, 260 + s.dist / 40);
  for (const t of s.things) t.x -= s.speed * dt;
  s.things = s.things.filter((t) => t.x + t.w > -10);
  s.dist += s.speed * dt;
  s.nextIn -= dt;
  if (s.nextIn <= 0) {
    const r = rnd(s), kind: Thing["kind"] = r < 0.55 ? "crate" : r < 0.8 ? "awning" : "cup";
    s.things.push(kind === "crate" ? { x: W + 10, w: 22 + Math.floor(rnd(s) * 3) * 14, h: 24 + Math.floor(rnd(s) * 2) * 14, kind } : kind === "awning" ? { x: W + 10, w: 60, h: 30, kind } : { x: W + 10, w: 16, h: 16, kind });
    s.nextIn = Math.max(0.55, 1.3 - s.dist / 6000) + rnd(s) * 0.6;
  }
  const me = runnerBox(s);
  for (const t of s.things) {
    if (t.x > me.x + me.w || t.x + t.w < me.x) continue;
    if (t.kind === "crate" && me.bottom > GROUND - t.h) { s.over = true; break; }
    // Awnings hang low: from 28 to 58 above the ground. Duck under, or be high enough to clear them
    if (t.kind === "awning" && me.top < GROUND - 28 && me.bottom > GROUND - 58) { s.over = true; break; }
    if (t.kind === "cup" && me.top < GROUND - 50 && me.bottom > GROUND - 70) { t.x = -999; s.cups++; s.score += 50; }
  }
  s.score = Math.floor(s.dist / 10) * 10 + s.cups * 50;
  return s;
}
