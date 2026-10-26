// Terrace backgammon against the computer. You (side 0) move from point 24 down to 1 and bear off below 1; the computer
// (side 1) goes the other way. pts[i] for i = 1..24 holds a count: positive for your checkers, negative for the computer's.
// A roll of a double is played four times. You must use as much of the roll as you can, and if only one die can be used,
// the larger one. Pure, so the page and tests share it.
export type Side = 0 | 1;
export type Level = "easy" | "hard";
export type State = { pts: number[]; bar: [number, number]; off: [number, number]; turn: Side };
export type Step = { from: number; to: number; die: number; hit: boolean }; // from 25 (yours) or 0 (theirs) is the bar; to 0 / 25 is off

export function newGame(): State {
  const pts = Array(26).fill(0);
  pts[24] = 2; pts[13] = 5; pts[8] = 3; pts[6] = 5; // yours
  pts[1] = -2; pts[12] = -5; pts[17] = -3; pts[19] = -5; // the computer's
  return { pts, bar: [0, 0], off: [0, 0], turn: 0 };
}
const mine = (s: State, side: Side, i: number) => (side === 0 ? s.pts[i] > 0 : s.pts[i] < 0);
const count = (s: State, side: Side, i: number) => Math.abs(s.pts[i]) * (mine(s, side, i) ? 1 : 0);
const blocked = (s: State, side: Side, i: number) => (side === 0 ? s.pts[i] < -1 : s.pts[i] > 1);
/** All checkers home (points 1-6 for you, 19-24 for the computer), so you can bear off */
export function allHome(s: State, side: Side) {
  if (s.bar[side]) return false;
  for (let i = 1; i <= 24; i++) if (mine(s, side, i) && (side === 0 ? i > 6 : i < 19)) return false;
  return true;
}
/** Single checker moves for one die */
export function stepsFor(s: State, side: Side, die: number): Step[] {
  const out: Step[] = [], dir = side === 0 ? -1 : 1;
  const tryFrom = (from: number) => {
    const to = from + dir * die;
    if (to >= 1 && to <= 24) {
      if (!blocked(s, side, to)) out.push({ from, to, die, hit: side === 0 ? s.pts[to] === -1 : s.pts[to] === 1 });
      return;
    }
    // Bearing off: exactly, or with a bigger die from the furthest-back checker
    if (!allHome(s, side)) return;
    const dist = side === 0 ? from : 25 - from;
    const further = side === 0 ? [...Array(6 - from).keys()].some((k) => mine(s, side, from + 1 + k)) : [...Array(from - 19).keys()].some((k) => mine(s, side, 19 + k));
    if (dist === die || (die > dist && !further)) out.push({ from, to: side === 0 ? 0 : 25, die, hit: false });
  };
  if (s.bar[side]) { tryFrom(side === 0 ? 25 : 0); return out; }
  for (let i = 1; i <= 24; i++) if (mine(s, side, i)) tryFrom(i);
  return out;
}
export function applyStep(s: State, side: Side, st: Step): State {
  const pts = [...s.pts], bar: [number, number] = [...s.bar], off: [number, number] = [...s.off];
  const sign = side === 0 ? 1 : -1;
  if (st.from === 25 || st.from === 0) bar[side]--; else pts[st.from] -= sign;
  if (st.to === 0 || st.to === 25) off[side]++;
  else {
    if (st.hit) { pts[st.to] = 0; bar[side === 0 ? 1 : 0]++; }
    pts[st.to] += sign;
  }
  return { ...s, pts, bar, off };
}
const dieList = (d: [number, number]) => (d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : [d[0], d[1]]);

/** Every way to play a roll, as lists of steps, keeping only those that use as much of the roll as possible */
export function plays(s: State, dice: [number, number], dedupe = true): Step[][] {
  const side = s.turn, out: Step[][] = [];
  const walk = (cur: State, left: number[], path: Step[]) => {
    let moved = false;
    for (const die of [...new Set(left)]) {
      for (const st of stepsFor(cur, side, die)) {
        moved = true;
        const i = left.indexOf(die);
        walk(applyStep(cur, side, st), [...left.slice(0, i), ...left.slice(i + 1)], [...path, st]);
      }
    }
    if (!moved) out.push(path);
  };
  walk(s, dieList(dice), []);
  const most = Math.max(0, ...out.map((p) => p.length));
  let best = out.filter((p) => p.length === most);
  // Only one die playable: it has to be the larger one, if that one can be played
  if (most === 1 && dice[0] !== dice[1]) { const hi = Math.max(...dice); if (best.some((p) => p[0].die === hi)) best = best.filter((p) => p[0].die === hi); }
  // Drop plays that end in the same place (the page keeps them all, so you can make the moves in any order)
  if (!dedupe) return best;
  const seen = new Set<string>();
  return best.filter((p) => { const k = JSON.stringify(end(s, p)); if (seen.has(k)) return false; seen.add(k); return true; });
}
export const end = (s: State, p: Step[]) => p.reduce((x, st) => applyStep(x, s.turn, st), s);
export const finish = (s: State): State => ({ ...s, turn: s.turn === 0 ? 1 : 0 });
export const winner = (s: State): Side | null => (s.off[0] === 15 ? 0 : s.off[1] === 15 ? 1 : null);
/** How far each side still has to travel */
export function pips(s: State, side: Side) {
  let n = s.bar[side] * 25;
  for (let i = 1; i <= 24; i++) n += count(s, side, i) * (side === 0 ? i : 25 - i);
  return n;
}
/** A gammon (double) if the loser hadn't borne any off, a backgammon (triple) if they also still had a checker on the bar or in the winner's home */
export function winKind(s: State, w: Side): 1 | 2 | 3 {
  const l = (1 - w) as Side;
  if (s.off[l]) return 1;
  const inHome = [...Array(6).keys()].some((k) => mine(s, l, w === 0 ? 1 + k : 19 + k));
  return s.bar[l] || inHome ? 3 : 2;
}

/** How good a position looks for `side` once its move is made */
function value(s: State, side: Side): number {
  const foe = (1 - side) as Side;
  if (s.off[side] === 15) return 1e6;
  let v = (pips(s, foe) - pips(s, side)) * 1.0 + s.off[side] * 6 + s.bar[foe] * 14 - s.bar[side] * 14;
  const race = (() => { // no more contact: just run
    let lastMine = side === 0 ? 0 : 25, lastFoe = side === 0 ? 25 : 0;
    for (let i = 1; i <= 24; i++) { if (mine(s, side, i)) lastMine = side === 0 ? Math.max(lastMine, i) : Math.min(lastMine, i); if (mine(s, foe, i)) lastFoe = side === 0 ? Math.min(lastFoe, i) : Math.max(lastFoe, i); }
    return !s.bar[0] && !s.bar[1] && (side === 0 ? lastMine < lastFoe : lastMine > lastFoe);
  })();
  if (race) return v;
  for (let i = 1; i <= 24; i++) {
    const n = count(s, side, i);
    if (n === 1) {
      // A lone checker the other side could hit: worse the more of their checkers are within reach
      let shooters = s.bar[foe] ? 2 : 0;
      for (let d = 1; d <= 12; d++) { const j = side === 0 ? i + d : i - d; if (j >= 1 && j <= 24 && mine(s, foe, j)) shooters++; }
      if (shooters) v -= 6 + shooters * 2 + (side === 0 ? 25 - i : i) * 0.25;
    }
    if (n >= 2) { const home = side === 0 ? i <= 6 : i >= 19; v += home ? 7 : 3; }
  }
  // Points in a row make a wall the other side can't pass
  let run = 0;
  for (let i = 1; i <= 24; i++) { if (count(s, side, i) >= 2) { run++; if (run >= 3) v += 4 * run; } else run = 0; }
  return v;
}
/** The computer's play for a roll */
export function bestPlay(s: State, dice: [number, number], level: Level, rand: () => number = Math.random): Step[] {
  const ps = plays(s, dice);
  if (ps.length <= 1) return ps[0] ?? [];
  const scored = ps.map((p) => ({ p, v: value(end(s, p), s.turn) + (level === "easy" ? (rand() - 0.5) * 90 : rand() * 0.01) })).sort((a, b) => b.v - a.v);
  return scored[0].p;
}
export const roll = (rand: () => number = Math.random): [number, number] => [1 + Math.floor(rand() * 6), 1 + Math.floor(rand() * 6)];
