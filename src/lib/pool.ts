// Café pool: eight-ball against the computer, with café rules. Pot all of your group (spots 1–7 or stripes 9–15),
// then the black 8. Pot your own ball and you go again. A foul (the cue ball going down, hitting the other group
// first or hitting nothing) puts the cue ball back on its spot for the other player. Pure physics and rules.
export const W = 260, H = 500, R = 8, POCKET_R = 15, CUSHION = 14;
export const POCKETS: [number, number][] = [[CUSHION, CUSHION], [W - CUSHION, CUSHION], [CUSHION - 2, H / 2], [W - CUSHION + 2, H / 2], [CUSHION, H - CUSHION], [W - CUSHION, H - CUSHION]];
export const CUE_SPOT: [number, number] = [W / 2, H * 0.78];
export const COLOURS = ["#fffaf6", "#e8b86a", "#5a7fb5", "#d64545", "#8a5aa0", "#e8873a", "#4f8a5b", "#8a3b2c", "#2b1d18", "#e8b86a", "#5a7fb5", "#d64545", "#8a5aa0", "#e8873a", "#4f8a5b", "#8a3b2c"];
export type Ball = { n: number; x: number; y: number; vx: number; vy: number; down: boolean };
export type Group = "spots" | "stripes" | null;
export type State = { balls: Ball[]; turn: 0 | 1; groups: [Group, Group]; winner: 0 | 1 | null; message: string; moving: boolean; shot: { first: number | null; potted: number[] } | null };

const groupOf = (n: number): Group => (n >= 1 && n <= 7 ? "spots" : n >= 9 ? "stripes" : null);
export function rack(): Ball[] {
  // The usual triangle: black in the middle, a spot and a stripe in the back corners
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 15, 7];
  const out: Ball[] = [{ n: 0, x: CUE_SPOT[0], y: CUE_SPOT[1], vx: 0, vy: 0, down: false }];
  let k = 0;
  for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++) out.push({ n: order[k++], x: W / 2 + (i - row / 2) * (R * 2 + 0.5), y: H * 0.26 - row * (R * 1.74), vx: 0, vy: 0, down: false });
  return out.sort((a, b) => a.n - b.n);
}
export const newGame = (): State => ({ balls: rack(), turn: 0, groups: [null, null], winner: null, message: "You break. Drag back from the white ball to aim, then let go.", moving: false, shot: null });

/** Hit the cue ball: angle in radians, power 0..1 */
export function strike(s: State, angle: number, power: number): State {
  if (s.moving || s.winner !== null) return s;
  const v = 120 + 1100 * Math.max(0, Math.min(1, power));
  return { ...s, balls: s.balls.map((b) => (b.n === 0 ? { ...b, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v } : { ...b })), moving: true, shot: { first: null, potted: [] }, message: "" };
}
/** Roll everything on by dt seconds */
export function step(s0: State, dt: number): State {
  if (!s0.moving) return s0;
  const s: State = { ...s0, balls: s0.balls.map((b) => ({ ...b })), shot: s0.shot ? { first: s0.shot.first, potted: [...s0.shot.potted] } : null };
  const n = Math.max(1, Math.ceil(dt * 200)), h = dt / n;
  const live = s.balls.filter((b) => !b.down);
  for (let k = 0; k < n; k++) {
    for (const b of live) { b.x += b.vx * h; b.y += b.vy * h; }
    // Ball on ball: equal weights, so they swap the speed along the line between them
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 >= 4 * R * R || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, overlap = 2 * R - d;
      a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; b.x += nx * overlap / 2; b.y += ny * overlap / 2;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel > 0) { a.vx -= rel * nx * 0.97; a.vy -= rel * ny * 0.97; b.vx += rel * nx * 0.97; b.vy += rel * ny * 0.97; }
      if (s.shot && s.shot.first === null && (a.n === 0 || b.n === 0)) s.shot.first = a.n === 0 ? b.n : a.n;
    }
    for (const b of live) {
      if (b.down) continue;
      if (POCKETS.some(([px, py]) => Math.hypot(b.x - px, b.y - py) < POCKET_R)) { b.down = true; b.vx = b.vy = 0; s.shot?.potted.push(b.n); continue; }
      if (b.x < CUSHION + R) { b.x = CUSHION + R; b.vx = Math.abs(b.vx) * 0.8; }
      if (b.x > W - CUSHION - R) { b.x = W - CUSHION - R; b.vx = -Math.abs(b.vx) * 0.8; }
      if (b.y < CUSHION + R) { b.y = CUSHION + R; b.vy = Math.abs(b.vy) * 0.8; }
      if (b.y > H - CUSHION - R) { b.y = H - CUSHION - R; b.vy = -Math.abs(b.vy) * 0.8; }
      const f = Math.pow(0.986, h * 120); b.vx *= f; b.vy *= f;
      if (Math.hypot(b.vx, b.vy) < 4) { b.vx = b.vy = 0; }
    }
  }
  if (s.balls.every((b) => b.down || (b.vx === 0 && b.vy === 0))) return judge(s);
  return s;
}
const left = (s: State, g: Group) => s.balls.filter((b) => !b.down && groupOf(b.n) === g).length;
/** Once everything stops: who's next, fouls, groups and the black */
function judge(s: State): State {
  const shot = s.shot ?? { first: null, potted: [] }, me = s.turn, other = (1 - me) as 0 | 1;
  const groups: [Group, Group] = [...s.groups] as [Group, Group];
  const mine = groups[me];
  const scratch = shot.potted.includes(0);
  const wrongFirst = shot.first === null || (mine ? groupOf(shot.first) !== mine && !(shot.first === 8 && left(s, mine) === 0) : shot.first === 8);
  const foul = scratch || wrongFirst;
  let balls = s.balls;
  if (scratch) balls = balls.map((b) => (b.n === 0 ? { ...b, down: false, ...freeSpot(balls) } : b));
  // The black
  if (shot.potted.includes(8)) {
    const cleared = mine !== null && left({ ...s, balls }, mine) === 0;
    const win = cleared && !foul;
    return { ...s, balls, groups, moving: false, winner: win ? me : other, message: win ? `${me === 0 ? "You" : "The computer"} sank the black! 🎱` : `The black went down too early${foul ? " (with a foul)" : ""}.` };
  }
  // First pot on an open table decides the groups
  const own = shot.potted.filter((n) => n !== 0 && n !== 8);
  if (!mine && own.length && !foul) { const g = groupOf(own[0])!; groups[me] = g; groups[other] = g === "spots" ? "stripes" : "spots"; }
  const pottedMine = own.some((n) => groupOf(n) === groups[me]);
  const keep = !foul && pottedMine;
  const who = me === 0 ? "You" : "The computer";
  const message = foul ? `Foul: ${scratch ? "the white went down" : shot.first === null ? "nothing was hit" : "the wrong ball was hit first"}. ${me === 0 ? "The computer's" : "Your"} shot.`
    : keep ? `${who} potted ${own.length === 1 ? "one" : own.length}${!s.groups[me] && groups[me] ? ` and ${me === 0 ? "take" : "takes"} ${groups[me]}` : ""}. Go again.` : `${me === 0 ? "The computer's" : "Your"} shot.`;
  return { ...s, balls, groups, turn: keep ? me : other, moving: false, message, shot: null };
}
function freeSpot(balls: Ball[]) {
  for (let k = 0; k < 40; k++) { const x = CUE_SPOT[0] + ((k % 5) - 2) * 18, y = CUE_SPOT[1] + Math.floor(k / 5) * 18; if (balls.every((b) => b.down || b.n === 0 || Math.hypot(b.x - x, b.y - y) > 2 * R + 1)) return { x, y, vx: 0, vy: 0 }; }
  return { x: CUE_SPOT[0], y: CUE_SPOT[1], vx: 0, vy: 0 };
}
/** Run a shot to the end (for the computer's planning) */
export function simulate(s: State, angle: number, power: number) { let t = strike(s, angle, power); for (let k = 0; k < 1200 && t.moving; k++) t = step(t, 1 / 60); return t; }

/** The computer: tries the obvious pots (aiming the white at the "ghost ball" spot behind each target), plays each out,
 * and keeps the best. Easy aims a bit off and doesn't always pick the best. */
export function computerShot(s: State, level: "easy" | "hard", rand: () => number): { angle: number; power: number } {
  const cue = s.balls.find((b) => b.n === 0)!, me = s.turn, mine = s.groups[me];
  const targets = s.balls.filter((b) => !b.down && b.n !== 0 && (mine ? (left(s, mine) === 0 ? b.n === 8 : groupOf(b.n) === mine) : b.n !== 8));
  const tries: { angle: number; power: number }[] = [];
  for (const t of targets) for (const [px, py] of POCKETS) {
    const dx = px - t.x, dy = py - t.y, d = Math.hypot(dx, dy);
    const gx = t.x - (dx / d) * 2 * R, gy = t.y - (dy / d) * 2 * R;
    // Skip cuts that are too thin to make
    const ax = gx - cue.x, ay = gy - cue.y, cut = (ax * dx + ay * dy) / (Math.hypot(ax, ay) * d);
    if (cut < 0.25) continue;
    for (const power of [0.35, 0.6, 0.85]) tries.push({ angle: Math.atan2(ay, ax), power });
  }
  // Nothing on? A safe-ish hit towards the nearest of our balls
  if (!tries.length) { const t = targets[0] ?? s.balls.find((b) => !b.down && b.n !== 0)!; return { angle: Math.atan2(t.y - cue.y, t.x - cue.x), power: 0.5 }; }
  const scored = tries.slice(0, 60).map((tr) => {
    const t = simulate(s, tr.angle, tr.power);
    const score = t.winner === me ? 1e5 : t.winner !== null ? -1e5 : t.turn === me ? 1000 + left(s, mine) * 10 - (mine ? left(t, mine) : 0) * 10 : t.message.startsWith("Foul") ? -500 : 0;
    return { ...tr, score: score + rand() * 5 };
  }).sort((a, b) => b.score - a.score);
  const pick = level === "hard" ? scored[0] : scored[Math.floor(rand() * Math.min(3, scored.length))];
  const wobble = level === "hard" ? (rand() - 0.5) * 0.01 : (rand() - 0.5) * 0.07;
  return { angle: pick.angle + wobble, power: pick.power };
}
export const groupName = (g: Group) => (g === "spots" ? "spots (1–7)" : g === "stripes" ? "stripes (9–15)" : "open table");
