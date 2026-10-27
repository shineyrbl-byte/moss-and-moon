// Slice the cake: cakes and fruit get tossed up; swipe through them before they fall. Slice three or more in one swipe
// for a bonus. Don't slice a chilli (game over), and three dropped treats ends it too. Pure, so the page and tests share it.
export const WIDTH = 360, HEIGHT = 540;
export const GRAVITY = 900; // px per second²
export const SLICE_MAX = 99_990;
export type Kind = "cake" | "melon" | "orange" | "chilli";
export const EMOJI: Record<Kind, string> = { cake: "🍰", melon: "🍉", orange: "🍊", chilli: "🌶️" };
export type Item = { id: number; x: number; y: number; vx: number; vy: number; r: number; kind: Kind; sliced: boolean; gone: boolean };
export type State = { items: Item[]; t: number; nextWave: number; wave: number; score: number; misses: number; over: boolean; reason: string; nextId: number; combo: number };

export const newState = (): State => ({ items: [], t: 0, nextWave: 0.6, wave: 0, score: 0, misses: 0, over: false, reason: "", nextId: 1, combo: 0 });

function toss(s: State, rand: () => number): Item[] {
  const n = 1 + Math.floor(rand() * Math.min(4, 1 + s.wave / 4));
  const chilliOdds = Math.min(0.28, 0.06 + s.wave * 0.012);
  return [...Array(n).keys()].map(() => {
    const x = 50 + rand() * (WIDTH - 100), r = rand();
    const kind: Kind = r < chilliOdds ? "chilli" : r < 0.55 ? "cake" : r < 0.78 ? "melon" : "orange";
    // Thrown so it peaks somewhere in the top half, drifting towards the middle
    const peak = 60 + rand() * 180, vy = -Math.sqrt(2 * GRAVITY * (HEIGHT + 30 - peak));
    return { id: s.nextId++, x, y: HEIGHT + 30, vx: (WIDTH / 2 - x) * (0.3 + rand() * 0.5), vy, r: kind === "melon" ? 30 : 24, kind, sliced: false, gone: false };
  });
}
/** Move everything on by dt seconds */
export function step(s0: State, dt: number, rand: () => number): State {
  if (s0.over) return s0;
  const s: State = { ...s0, items: s0.items.map((i) => ({ ...i })), t: s0.t + dt };
  for (const i of s.items) {
    if (i.gone) continue;
    i.vy += GRAVITY * dt; i.x += i.vx * dt; i.y += i.vy * dt;
    if (i.y > HEIGHT + 40 && i.vy > 0) {
      i.gone = true;
      if (!i.sliced && i.kind !== "chilli") { s.misses++; if (s.misses >= 3) { s.over = true; s.reason = "Three treats hit the floor."; } }
    }
  }
  s.items = s.items.filter((i) => !i.gone || i.sliced).filter((i) => i.y < HEIGHT + 60);
  if (s.t >= s.nextWave) {
    s.items.push(...toss(s, rand));
    s.wave++;
    s.nextWave = s.t + Math.max(0.7, 1.6 - s.wave * 0.03) + rand() * 0.4;
  }
  return s;
}
/** Does the line from (x1,y1) to (x2,y2) pass through the circle? */
export function crosses(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number) {
  const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  const k = len2 ? Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / len2)) : 0;
  const px = x1 + k * dx - cx, py = y1 + k * dy - cy;
  return px * px + py * py <= r * r;
}
/** A piece of a swipe: slices what it crosses. `fresh` starts a new swipe (resets the combo). */
export function swipe(s0: State, x1: number, y1: number, x2: number, y2: number, fresh = false): { s: State; sliced: Item[]; bonus: number } {
  if (s0.over) return { s: s0, sliced: [], bonus: 0 };
  const s: State = { ...s0, items: s0.items.map((i) => ({ ...i })), combo: fresh ? 0 : s0.combo };
  const sliced: Item[] = [];
  for (const i of s.items) if (!i.sliced && !i.gone && crosses(x1, y1, x2, y2, i.x, i.y, i.r)) { i.sliced = true; sliced.push(i); }
  let bonus = 0;
  for (const i of sliced) {
    if (i.kind === "chilli") { s.over = true; s.reason = "Too spicy! You sliced a chilli."; continue; }
    s.score += 10; s.combo++;
    if (s.combo === 3) bonus += 30; else if (s.combo > 3) bonus += 10;
  }
  s.score += bonus;
  return { s, sliced, bonus };
}
