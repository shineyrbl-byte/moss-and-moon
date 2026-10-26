// Bean muncher: steer round the café floor eating every bean, while the café cats prowl. Eat an espresso cup and the cats
// run scared for a few seconds (and you can catch them). Clear the floor for the next, quicker round. Moves are one square at
// a time; step() moves everyone on by one tick. Pure, so the page and tests share it.
export const MAP = [
  "###############",
  "#......#......#",
  "#o##.#.#.#.##o#",
  "#.............#",
  "#.##.#####.##.#",
  "#....#...#....#",
  "####.#.#.#.####",
  "#......C......#",
  "####.#.#.#.####",
  "#....#...#....#",
  "#.##.#####.##.#",
  "#......P......#",
  "#o##.#.#.#.##o#",
  "#......#......#",
  "###############",
];
export const ROWS = MAP.length, COLS = MAP[0].length;
export const MUNCH_MAX = 999_990;
export type Dir = 0 | 1 | 2 | 3; // up, right, down, left
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
export type Cat = { r: number; c: number; dir: Dir; home: [number, number] };
export type State = { beans: Set<number>; cups: Set<number>; r: number; c: number; dir: Dir; want: Dir; cats: Cat[]; scared: number; score: number; lives: number; round: number; over: boolean; cleared: boolean; tick: number; combo: number };

const wall = (r: number, c: number) => r < 0 || r >= ROWS || c < 0 || c >= COLS || MAP[r][c] === "#";
const find = (ch: string): [number, number] => { for (let r = 0; r < ROWS; r++) { const c = MAP[r].indexOf(ch); if (c >= 0) return [r, c]; } return [1, 1]; };
const START = find("P"), DEN = find("C");
export function newGame(round = 1, score = 0, lives = 3): State {
  const beans = new Set<number>(), cups = new Set<number>();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { if (MAP[r][c] === ".") beans.add(r * COLS + c); if (MAP[r][c] === "o") cups.add(r * COLS + c); }
  const cats: Cat[] = [[0, -1], [0, 1], [-1, 0]].slice(0, Math.min(3, 1 + round)).map(([dr, dc], k) => ({ r: DEN[0] + dr * 0, c: DEN[1] + dc, dir: (k % 4) as Dir, home: [DEN[0], DEN[1] + dc] as [number, number] }));
  return { beans, cups, r: START[0], c: START[1], dir: 3, want: 3, cats, scared: 0, score, lives, round, over: false, cleared: false, tick: 0, combo: 0 };
}
export const steer = (s: State, d: Dir): State => ({ ...s, want: d });
const open = (r: number, c: number, d: Dir) => !wall(r + DR[d], c + DC[d]);

/** One tick: you move a square, then the cats (who slow down when scared) */
export function step(s0: State, rand: () => number = Math.random): State {
  if (s0.over || s0.cleared) return s0;
  const s: State = { ...s0, beans: new Set(s0.beans), cups: new Set(s0.cups), cats: s0.cats.map((k) => ({ ...k })), tick: s0.tick + 1, scared: Math.max(0, s0.scared - 1) };
  if (open(s.r, s.c, s.want)) s.dir = s.want;
  if (open(s.r, s.c, s.dir)) { s.r += DR[s.dir]; s.c += DC[s.dir]; }
  const here = s.r * COLS + s.c;
  if (s.beans.delete(here)) s.score += 10;
  if (s.cups.delete(here)) { s.score += 50; s.scared = 28; s.combo = 0; }
  const meet = (k: Cat) => k.r === s.r && k.c === s.c;
  const clash = () => {
    for (const k of s.cats) {
      if (!meet(k)) continue;
      if (s.scared) { s.combo++; s.score += 100 * 2 ** (s.combo - 1); k.r = k.home[0]; k.c = k.home[1]; }
      else { s.lives--; if (s.lives <= 0) { s.over = true; return; } const f = newGame(s.round, s.score, s.lives); s.r = f.r; s.c = f.c; s.dir = 3; s.want = 3; s.cats = f.cats; s.scared = 0; return; }
    }
  };
  clash();
  if (s.over) return s;
  // Cats: at each turning, chase you (or run when scared), with a bit of wandering; scared cats move every other tick
  for (const k of s.cats) {
    // Cats are a touch slower than you (and much slower when scared)
    if ((s.scared && s.tick % 2) || s.tick % 5 === 0) continue;
    const choices = ([0, 1, 2, 3] as Dir[]).filter((d) => open(k.r, k.c, d) && d !== (k.dir + 2) % 4);
    const opts = choices.length ? choices : ([0, 1, 2, 3] as Dir[]).filter((d) => open(k.r, k.c, d));
    const dist = (d: Dir) => Math.abs(k.r + DR[d] - s.r) + Math.abs(k.c + DC[d] - s.c);
    let pick = opts[Math.floor(rand() * opts.length)];
    if (rand() < 0.42 + s.round * 0.07) pick = [...opts].sort((a, b) => (s.scared ? dist(b) - dist(a) : dist(a) - dist(b)))[0];
    k.dir = pick; k.r += DR[pick]; k.c += DC[pick];
  }
  clash();
  if (!s.beans.size && !s.cups.size && !s.over) { s.cleared = true; s.score += 200 * s.round; }
  return s;
}
export const nextRound = (s: State): State => newGame(s.round + 1, s.score, s.lives);
/** Seconds per tick: quicker each round */
export const tickSecs = (round: number) => Math.max(0.12, 0.2 - (round - 1) * 0.015);
