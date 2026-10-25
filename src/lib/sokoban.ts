// Tray pusher: push every cup onto a saucer. You can push one cup at a time and never pull. Pure, so the page and tests share it.
// Levels: # wall, . saucer, $ cup, * cup on a saucer, @ you, + you on a saucer. `fewest` is the fewest steps, found by the solver below.
export type Level = { name: string; map: string[]; fewest: number };
export type Pos = { w: number; walls: Set<number>; goals: Set<number>; cups: number[]; me: number };
export type Dir = "up" | "down" | "left" | "right";

export function parse(map: string[]): Pos {
  const w = Math.max(...map.map((r) => r.length));
  const walls = new Set<number>(), goals = new Set<number>(), cups: number[] = [];
  let me = -1;
  map.forEach((row, r) => [...row.padEnd(w)].forEach((ch, c) => {
    const i = r * w + c;
    if (ch === "#") walls.add(i);
    if (ch === "." || ch === "*" || ch === "+") goals.add(i);
    if (ch === "$" || ch === "*") cups.push(i);
    if (ch === "@" || ch === "+") me = i;
  }));
  return { w, walls, goals, cups: cups.sort((a, b) => a - b), me };
}
const step = (w: number, d: Dir) => (d === "up" ? -w : d === "down" ? w : d === "left" ? -1 : 1);
export const DIRS: Dir[] = ["up", "down", "left", "right"];

/** Walk one square, pushing a cup if there's one in the way */
export function move(p: Pos, d: Dir): { pos: Pos; pushed: boolean } | null {
  const s = step(p.w, d), to = p.me + s;
  if (p.walls.has(to)) return null;
  const k = p.cups.indexOf(to);
  if (k < 0) return { pos: { ...p, me: to }, pushed: false };
  const beyond = to + s;
  if (p.walls.has(beyond) || p.cups.includes(beyond)) return null;
  const cups = [...p.cups]; cups[k] = beyond;
  return { pos: { ...p, cups: cups.sort((a, b) => a - b), me: to }, pushed: true };
}
export const solved = (p: Pos) => p.cups.every((c) => p.goals.has(c));

/** Fewest steps to solve (breadth first), or null if it can't be done within the limit */
export function solve(map: string[], limit = 400_000): number | null {
  const p0 = parse(map);
  const id = (p: Pos) => `${p.me}|${p.cups.join(",")}`;
  // A cup in a corner that isn't a saucer can never come out
  const dead = (i: number) => !p0.goals.has(i) && ((p0.walls.has(i - p0.w) || p0.walls.has(i + p0.w)) && (p0.walls.has(i - 1) || p0.walls.has(i + 1)));
  let frontier = [p0];
  const seen = new Set([id(p0)]);
  for (let depth = 0; frontier.length; depth++) {
    const next: Pos[] = [];
    for (const p of frontier) {
      if (solved(p)) return depth;
      for (const d of DIRS) {
        const m = move(p, d);
        if (!m || (m.pushed && m.pos.cups.some(dead))) continue;
        const k = id(m.pos);
        if (seen.has(k)) continue;
        seen.add(k); next.push(m.pos);
        if (seen.size > limit) return null;
      }
    }
    frontier = next;
  }
  return null;
}

// Built by working backwards from the solved position, then checked with solve()
export const LEVELS: Level[] = [
  { name: "First shift", fewest: 10, map: ["######", "#@# ##", "#.. ##", "#$$ ##", "#    #", "######"] },
  { name: "Two for the window", fewest: 14, map: ["######", "###@ #", "#  $ #", "#  $.#", "#.## #", "######"] },
  { name: "Corner table", fewest: 18, map: ["######", "##+  #", "###$.#", "#  $ #", "##   #", "######"] },
  { name: "Back counter", fewest: 22, map: ["######", "#   +#", "# #$$#", "#.   #", "#### #", "######"] },
  { name: "Morning rush", fewest: 26, map: ["######", "#    #", "##$$ #", "## # #", "#+  .#", "######"] },
  { name: "Three on a tray", fewest: 28, map: ["######", "#.##.#", "#.@$$#", "# $# #", "#    #", "######"] },
  { name: "The long bench", fewest: 32, map: ["######", "#    #", "# $$.#", "#  #$#", "#.@#.#", "######"] },
  { name: "Round the pillar", fewest: 36, map: ["#######", "#.  @##", "## #$ #", "##  $ #", "#.    #", "#######"] },
  { name: "Behind the till", fewest: 40, map: ["######", "##+$ #", "#  $.#", "# #$.#", "#    #", "######"] },
  { name: "Busy terrace", fewest: 44, map: ["#######", "#  $@.#", "## $$ #", "## .# #", "##   .#", "#######"] },
  { name: "Window seats", fewest: 48, map: ["######", "#..  #", "# #  #", "# $$ #", "# +$ #", "######"] },
  { name: "Four at once", fewest: 52, map: ["#######", "#.$@. #", "#  $$ #", "#.# $ #", "# .  ##", "#######"] },
  { name: "The snug", fewest: 56, map: ["#######", "## .. #", "#   $ #", "# $#$##", "#.  @##", "#######"] },
  { name: "Full house", fewest: 60, map: ["########", "# #  .##", "# $+# ##", "#  $$ .#", "# $.  ##", "########"] },
  { name: "Late lunch", fewest: 66, map: ["########", "###.   #", "#@$ $  #", "#  #$# #", "#   .. #", "########"] },
  { name: "Book club night", fewest: 72, map: ["########", "#..  @##", "## $#$ #", "# .  $ #", "# .$   #", "########"] },
  { name: "Pastry case", fewest: 80, map: ["########", "#  .   #", "#.$.$  #", "# $# $@#", "##.  ###", "########"] },
  { name: "Quiz night", fewest: 88, map: ["########", "#.  .###", "#.# @$ #", "# $$$  #", "#    #.#", "########"] },
  { name: "Last orders", fewest: 100, map: ["#######", "## . .#", "## #$$#", "#..   #", "#  $$ #", "##  ###", "##   @#", "#######"] },
  { name: "Closing time", fewest: 110, map: ["########", "#@  .  #", "###$   #", "#   . .#", "### #  #", "# $$   #", "#  . $ #", "########"] },
];
