// Pastry defence: ants march along the path to the pastry case. Spend coins on helpers beside the path: a cinnamon
// cannon (steady), a sugar sprayer (slows them) or an espresso shot (big hit, slow to reload). Each ant that gets
// through eats a pastry; lose all ten and it's over. Every wave is bigger. Pure, so the page and tests share it.
export const COLS = 10, ROWS = 12, PASTRIES = 10;
export const DEFENCE_MAX = 999_990;
/** The path, as squares from the door to the pastry case */
export const PATH: [number, number][] = (() => {
  const pts: [number, number][] = [[0, 2], [7, 2], [7, 5], [2, 5], [2, 8], [8, 8], [8, 11]];
  const out: [number, number][] = [];
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = k === 1 ? 0 : 1; s <= steps; s++) out.push([x0 + Math.sign(x1 - x0) * s, y0 + Math.sign(y1 - y0) * s]);
  }
  return out;
})();
const onPath = new Set(PATH.map(([x, y]) => y * COLS + x));
export type Kind = "cannon" | "sugar" | "espresso";
export const TOWERS: Record<Kind, { cost: number; range: number; reload: number; damage: number; slow: number; emoji: string; name: string }> = {
  cannon: { cost: 30, range: 2.2, reload: 0.6, damage: 3, slow: 0, emoji: "🌀", name: "Cinnamon cannon" },
  sugar: { cost: 40, range: 1.8, reload: 0.9, damage: 1, slow: 0.5, emoji: "🧂", name: "Sugar sprayer" },
  espresso: { cost: 70, range: 3.2, reload: 2.2, damage: 12, slow: 0, emoji: "☕", name: "Espresso shot" },
};
export type Tower = { at: number; kind: Kind; cool: number };
export type Ant = { id: number; d: number; hp: number; max: number; speed: number; slowFor: number; big: boolean };
export type State = { towers: Tower[]; ants: Ant[]; coins: number; pastries: number; wave: number; toSpawn: number; spawnIn: number; between: number; score: number; over: boolean; nextId: number; shots: { from: number; x: number; y: number; t: number }[] };
export const newGame = (): State => ({ towers: [], ants: [], coins: 90, pastries: PASTRIES, wave: 0, toSpawn: 0, spawnIn: 0, between: 3, score: 0, over: false, nextId: 1, shots: [] });
export const canBuild = (s: State, at: number, kind: Kind) => !onPath.has(at) && at >= 0 && at < COLS * ROWS && !s.towers.some((t) => t.at === at) && s.coins >= TOWERS[kind].cost;
export function build(s: State, at: number, kind: Kind): State | null {
  if (!canBuild(s, at, kind)) return null;
  return { ...s, towers: [...s.towers, { at, kind, cool: 0 }], coins: s.coins - TOWERS[kind].cost };
}
/** Sell a helper back for half */
export function sell(s: State, at: number): State {
  const t = s.towers.find((x) => x.at === at);
  return t ? { ...s, towers: s.towers.filter((x) => x !== t), coins: s.coins + Math.floor(TOWERS[t.kind].cost / 2) } : s;
}
/** Where an ant is, in squares, from how far along the path it's got */
export function antXY(d: number): [number, number] {
  const k = Math.min(PATH.length - 1, Math.floor(d)), f = Math.min(1, d - k), a = PATH[k], b = PATH[Math.min(PATH.length - 1, k + 1)];
  return [a[0] + (b[0] - a[0]) * f + 0.5, a[1] + (b[1] - a[1]) * f + 0.5];
}
export function step(s0: State, dt: number): State {
  if (s0.over) return s0;
  const s: State = { ...s0, ants: s0.ants.map((a) => ({ ...a })), towers: s0.towers.map((t) => ({ ...t })), shots: s0.shots.map((x) => ({ ...x, t: x.t - dt })).filter((x) => x.t > 0) };
  // Waves: a pause, then ants one after another; every fifth wave has a big beetle
  if (!s.toSpawn && !s.ants.length) {
    s.between -= dt;
    if (s.between <= 0) { s.wave++; s.toSpawn = 6 + s.wave * 2; s.spawnIn = 0; s.between = 4; }
  }
  if (s.toSpawn) {
    s.spawnIn -= dt;
    if (s.spawnIn <= 0) {
      const big = s.wave % 5 === 0 && s.toSpawn === 1, hp = Math.round((4 + s.wave * 2.2) * (big ? 8 : 1));
      s.ants.push({ id: s.nextId++, d: 0, hp, max: hp, speed: (big ? 0.9 : 1.4) + s.wave * 0.04, slowFor: 0, big });
      s.toSpawn--; s.spawnIn = Math.max(0.35, 0.9 - s.wave * 0.03);
    }
  }
  for (const a of s.ants) { a.d += a.speed * (a.slowFor > 0 ? 0.5 : 1) * dt; a.slowFor = Math.max(0, a.slowFor - dt); }
  // Ants that reach the case eat a pastry (a beetle eats three)
  const through = s.ants.filter((a) => a.d >= PATH.length - 1);
  for (const a of through) s.pastries -= a.big ? 3 : 1;
  s.ants = s.ants.filter((a) => a.d < PATH.length - 1);
  // Helpers fire at the ant furthest along within range
  for (const t of s.towers) {
    t.cool -= dt;
    if (t.cool > 0) continue;
    const spec = TOWERS[t.kind], tx = (t.at % COLS) + 0.5, ty = Math.floor(t.at / COLS) + 0.5;
    const target = s.ants.filter((a) => { const [x, y] = antXY(a.d); return Math.hypot(x - tx, y - ty) <= spec.range; }).sort((a, b) => b.d - a.d)[0];
    if (!target) continue;
    target.hp -= spec.damage; if (spec.slow) target.slowFor = 1.5;
    const [x, y] = antXY(target.d); s.shots.push({ from: t.at, x, y, t: 0.12 });
    t.cool = spec.reload;
  }
  const dead = s.ants.filter((a) => a.hp <= 0);
  for (const a of dead) { s.coins += a.big ? 40 : 5 + Math.floor(s.wave / 3); s.score += a.big ? 200 : 10; }
  s.ants = s.ants.filter((a) => a.hp > 0);
  if (s.pastries <= 0) { s.pastries = 0; s.over = true; }
  return s;
}
