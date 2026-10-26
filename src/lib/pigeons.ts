// Pigeon patrol: a flock of pigeons marches across the terrace and down towards the tables. Slide the saucer and flick coffee
// beans up at them; dodge the crumbs they drop. Clear the flock for the next, quicker one. The world is 100 wide, 140 tall.
// Pure, so the page and tests share it.
export const W = 100, H = 140;
export const ROWS = 4, COLS = 7, PW = 8, PH = 6, GAPX = 4, GAPY = 5;
export const SHIP_Y = 130, SHIP_W = 12;
export const PIGEON_MAX = 999_990;
export type Bird = { r: number; c: number; alive: boolean };
export type Shot = { x: number; y: number };
export type State = {
  birds: Bird[]; fx: number; fy: number; dir: 1 | -1; // flock offset and direction
  ship: number; shots: Shot[]; crumbs: Shot[]; score: number; lives: number; wave: number; over: boolean; cool: number; hitFor: number;
};
const flock = () => [...Array(ROWS * COLS).keys()].map((i) => ({ r: Math.floor(i / COLS), c: i % COLS, alive: true }));
export const newGame = (): State => ({ birds: flock(), fx: 8, fy: 14, dir: 1, ship: W / 2, shots: [], crumbs: [], score: 0, lives: 3, wave: 1, over: false, cool: 0, hitFor: 0 });
export const birdBox = (s: State, b: Bird) => ({ x: s.fx + b.c * (PW + GAPX), y: s.fy + b.r * (PH + GAPY), w: PW, h: PH });
export const POINTS = [40, 30, 20, 10];
export const moveShip = (s: State, x: number): State => ({ ...s, ship: Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, x)) });
/** Flick a bean (one at a time on screen, with a short wait between) */
export const fire = (s: State): State => (s.over || s.cool > 0 || s.shots.length >= 2 ? s : { ...s, shots: [...s.shots, { x: s.ship, y: SHIP_Y - 3 }], cool: 0.35 });

export function step(s0: State, dt: number, rand: () => number = Math.random): State {
  if (s0.over) return s0;
  const s: State = { ...s0, birds: s0.birds.map((b) => ({ ...b })), cool: Math.max(0, s0.cool - dt), hitFor: Math.max(0, s0.hitFor - dt) };
  const alive = s.birds.filter((b) => b.alive);
  // The flock speeds up as it thins out, and with every wave
  const speed = (6 + s.wave * 2.5) * (1 + (ROWS * COLS - alive.length) / (ROWS * COLS) * 2.2);
  s.fx += s.dir * speed * dt;
  const xs = alive.map((b) => birdBox(s, b)), left = Math.min(...xs.map((b) => b.x)), right = Math.max(...xs.map((b) => b.x + b.w));
  if (right > W - 1 || left < 1) { s.dir = (s.dir * -1) as 1 | -1; s.fx += s.dir * 1.5; s.fy += 3; }
  // Beans fly up and hit the first pigeon in their way
  s.shots = s0.shots.map((b) => ({ ...b, y: b.y - 130 * dt })).filter((b) => b.y > 0);
  s.shots = s.shots.filter((b) => {
    const hit = s.birds.find((x) => { if (!x.alive) return false; const box = birdBox(s, x); return b.x > box.x && b.x < box.x + box.w && b.y > box.y && b.y < box.y + box.h; });
    if (!hit) return true;
    hit.alive = false; s.score += POINTS[hit.r] * s.wave;
    return false;
  });
  // Crumbs fall; a few pigeons at the bottom of each column drop them now and then
  s.crumbs = s0.crumbs.map((c) => ({ ...c, y: c.y + 55 * dt })).filter((c) => c.y < H);
  const bottoms = [...Array(COLS).keys()].map((c) => s.birds.filter((b) => b.alive && b.c === c).sort((a, b) => b.r - a.r)[0]).filter(Boolean);
  if (bottoms.length && rand() < dt * (0.8 + s.wave * 0.25)) { const b = bottoms[Math.floor(rand() * bottoms.length)]; const box = birdBox(s, b); s.crumbs.push({ x: box.x + box.w / 2, y: box.y + box.h }); }
  if (s.hitFor === 0 && s.crumbs.some((c) => Math.abs(c.x - s.ship) < SHIP_W / 2 && c.y > SHIP_Y - 2 && c.y < SHIP_Y + 4)) {
    s.lives--; s.crumbs = []; s.hitFor = 1.5;
    if (s.lives <= 0) s.over = true;
  }
  // The flock reaching the tables ends it
  if (alive.some((b) => birdBox(s, b).y + PH >= SHIP_Y - 4)) s.over = true;
  // A cleared flock brings the next
  if (!s.birds.some((b) => b.alive)) return { ...s, birds: flock(), fx: 8, fy: 14, dir: 1, shots: [], crumbs: [], wave: s.wave + 1, score: s.score + 100 * s.wave };
  return s;
}
