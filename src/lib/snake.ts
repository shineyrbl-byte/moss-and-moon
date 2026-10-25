// Bean snake: eat the coffee beans, grow, don't bump into yourself. Pure, so the page and tests share it.
export const GRID = 15, SNAKE_MAX = GRID * GRID - 3;
export type Dir = "up" | "down" | "left" | "right";
const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const opposite = (a: Dir, b: Dir) => (a === "up" && b === "down") || (a === "down" && b === "up") || (a === "left" && b === "right") || (a === "right" && b === "left");

export type Snake = { body: number[]; dir: Dir; bean: number; score: number; over: boolean };
/** A new game: three squares long in the middle, heading right */
export function start(rand: () => number): Snake {
  const mid = Math.floor(GRID / 2) * GRID + Math.floor(GRID / 2);
  const body = [mid, mid - 1, mid - 2];
  return { body, dir: "right", bean: placeBean(body, rand), score: 0, over: false };
}
export function placeBean(body: number[], rand: () => number) {
  const free = [...Array(GRID * GRID).keys()].filter((p) => !body.includes(p));
  return free.length ? free[Math.floor(rand() * free.length)] : -1;
}
/** One tick. The walls wrap around (it's a round café table); only your own tail ends the game. */
export function tick(s: Snake, dir: Dir, rand: () => number): Snake {
  if (s.over) return s;
  const d = opposite(s.dir, dir) ? s.dir : dir;
  const head = s.body[0], [dx, dy] = STEP[d];
  const x = (head % GRID + dx + GRID) % GRID, y = (Math.floor(head / GRID) + dy + GRID) % GRID;
  const next = y * GRID + x, eats = next === s.bean;
  const body = [next, ...(eats ? s.body : s.body.slice(0, -1))];
  if ((eats ? s.body : s.body.slice(0, -1)).includes(next)) return { ...s, dir: d, over: true };
  return { body, dir: d, bean: eats ? placeBean(body, rand) : s.bean, score: s.score + (eats ? 1 : 0), over: false };
}
/** Speeds up as you eat: 160ms a step down to 80 */
export const speed = (score: number) => Math.max(80, 160 - score * 4);
