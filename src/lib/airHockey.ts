// Air hockey on a café table: two players on one screen (each holds their own half), or you against the computer.
// First to seven. Pure physics, so the page and tests share it.
export const W = 300, H = 520, GOAL = 110, PUCK_R = 14, MALLET_R = 24, TARGET = 7;
const MAX_V = 1400;
export type V = { x: number; y: number };
export type State = { puck: V & { vx: number; vy: number }; mallets: [V, V]; prev: [V, V]; score: [number, number]; serve: 0 | 1 | null; over: boolean; t: number };
// Player 0 defends the bottom goal, player 1 the top
export const newGame = (): State => ({ puck: { x: W / 2, y: H / 2 + 60, vx: 0, vy: 0 }, mallets: [{ x: W / 2, y: H - 60 }, { x: W / 2, y: 60 }], prev: [{ x: W / 2, y: H - 60 }, { x: W / 2, y: 60 }], score: [0, 0], serve: null, over: false, t: 0 });

/** Keep a mallet on its own half and on the table */
export function clampMallet(p: V, who: 0 | 1): V {
  const top = who === 0 ? H / 2 + MALLET_R : MALLET_R, bottom = who === 0 ? H - MALLET_R : H / 2 - MALLET_R;
  return { x: Math.max(MALLET_R, Math.min(W - MALLET_R, p.x)), y: Math.max(top, Math.min(bottom, p.y)) };
}
/** The computer: guards its goal, and strikes when the puck is on its side */
export function computerMallet(s: State, level: "easy" | "hard", dt: number): V {
  const m = s.mallets[1], p = s.puck, speed = (level === "hard" ? 520 : 330) * dt;
  const attacking = p.y < H / 2 && p.vy < 260;
  // A little wobble in where it strikes, so its shots come in at an angle (and two computers can't rally forever)
  const wobble = Math.sin(s.t * 3.7) * 12;
  const target = attacking ? { x: p.x + (p.x - W / 2) * 0.15 + wobble, y: p.y - PUCK_R } : { x: W / 2 + (p.x - W / 2) * 0.5, y: 70 };
  const dx = target.x - m.x, dy = target.y - m.y, d = Math.hypot(dx, dy);
  return clampMallet(d <= speed ? target : { x: m.x + (dx / d) * speed, y: m.y + (dy / d) * speed }, 1);
}
/** Move on by dt seconds, with both mallets where the players have put them */
export function step(s0: State, dt: number, mallets: [V, V]): { s: State; goal: 0 | 1 | null; hit: boolean } {
  if (s0.over) return { s: s0, goal: null, hit: false };
  const s: State = { ...s0, puck: { ...s0.puck }, prev: s0.mallets, mallets: [clampMallet(mallets[0], 0), clampMallet(mallets[1], 1)], t: s0.t + dt };
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n, p = s.puck;
  let hit = false, goal: 0 | 1 | null = null;
  for (let k = 0; k < n; k++) {
    p.x += p.vx * h; p.y += p.vy * h;
    // Mallets push the puck, with the mallet's own speed added in
    for (const who of [0, 1] as const) {
      const m = s.mallets[who], pm = s0.mallets[who];
      const mvx = (m.x - pm.x) / dt, mvy = (m.y - pm.y) / dt;
      const ox = p.x - m.x, oy = p.y - m.y, d = Math.hypot(ox, oy), rad = PUCK_R + MALLET_R;
      if (d < rad && d > 0) {
        const nx = ox / d, ny = oy / d;
        p.x = m.x + nx * rad; p.y = m.y + ny * rad;
        const rvx = p.vx - mvx, rvy = p.vy - mvy, vn = rvx * nx + rvy * ny;
        if (vn < 0) { p.vx -= 1.9 * vn * nx; p.vy -= 1.9 * vn * ny; hit = true; }
      }
    }
    // Side walls, and the end walls either side of each goal
    if (p.x < PUCK_R) { p.x = PUCK_R; p.vx = Math.abs(p.vx) * 0.9; }
    if (p.x > W - PUCK_R) { p.x = W - PUCK_R; p.vx = -Math.abs(p.vx) * 0.9; }
    const inMouth = Math.abs(p.x - W / 2) < GOAL / 2;
    if (p.y < PUCK_R && !inMouth) { p.y = PUCK_R; p.vy = Math.abs(p.vy) * 0.9; }
    if (p.y > H - PUCK_R && !inMouth) { p.y = H - PUCK_R; p.vy = -Math.abs(p.vy) * 0.9; }
    if (p.y < -PUCK_R) { goal = 0; break; }      // into the top goal: a point for player 0
    if (p.y > H + PUCK_R) { goal = 1; break; }   // into the bottom goal: a point for player 1
    const sp = Math.hypot(p.vx, p.vy); if (sp > MAX_V) { p.vx *= MAX_V / sp; p.vy *= MAX_V / sp; }
    p.vx *= 0.9995; p.vy *= 0.9995;
  }
  if (goal !== null) {
    const score: [number, number] = [...s.score] as [number, number]; score[goal]++;
    const loser = (1 - goal) as 0 | 1;
    // The player who conceded gets the puck on their side
    return { s: { ...s, score, over: score[goal] >= TARGET, serve: loser, puck: { x: W / 2, y: loser === 0 ? H / 2 + 60 : H / 2 - 60, vx: 0, vy: 0 } }, goal, hit };
  }
  return { s, goal: null, hit };
}
