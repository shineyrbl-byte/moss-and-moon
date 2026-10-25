// Brew merge (2048): slide the board, matching drinks merge into the next one up. Pure, so the page and tests share it.
// A tile is its level: 1 = beans, 2 = grounds … 11 = the moon brew. Score = the value (2^level) of each tile you make.
export const SIDE = 4;
export const TILES = [
  { emoji: "🫘", name: "Beans" }, { emoji: "🟤", name: "Grounds" }, { emoji: "☕", name: "Espresso" }, { emoji: "🥃", name: "Cortado" },
  { emoji: "🤍", name: "Flat white" }, { emoji: "🥛", name: "Latte" }, { emoji: "☁️", name: "Cappuccino" }, { emoji: "🍫", name: "Mocha" },
  { emoji: "🍨", name: "Affogato" }, { emoji: "🧊", name: "Cold brew" }, { emoji: "🌙", name: "Moon brew" },
];
export const MAX_LEVEL = TILES.length;
export type Dir = "left" | "right" | "up" | "down";

/** The squares of each line, in the order tiles slide towards */
function lines(dir: Dir) {
  const out: number[][] = [];
  for (let i = 0; i < SIDE; i++) {
    const l = [...Array(SIDE).keys()].map((j) => (dir === "left" || dir === "right" ? i * SIDE + j : j * SIDE + i));
    out.push(dir === "right" || dir === "down" ? l.reverse() : l);
  }
  return out;
}
/** Slide; returns the new board, points made and whether anything moved */
export function slide(board: number[], dir: Dir) {
  const next = Array(SIDE * SIDE).fill(0);
  let gained = 0;
  for (const line of lines(dir)) {
    const vals = line.map((p) => board[p]).filter(Boolean), merged: number[] = [];
    for (let i = 0; i < vals.length; i++) {
      if (i + 1 < vals.length && vals[i] === vals[i + 1] && vals[i] < MAX_LEVEL) { merged.push(vals[i] + 1); gained += 2 ** (vals[i] + 1); i++; }
      else merged.push(vals[i]);
    }
    merged.forEach((v, i) => (next[line[i]] = v));
  }
  return { board: next, gained, moved: next.some((v, i) => v !== board[i]) };
}
/** Drop a new tile (beans, sometimes grounds) on an empty square */
export function addTile(board: number[], rand: () => number) {
  const empty = [...board.keys()].filter((p) => !board[p]);
  if (!empty.length) return board;
  const next = [...board];
  next[empty[Math.floor(rand() * empty.length)]] = rand() < 0.9 ? 1 : 2;
  return next;
}
export const canMove = (board: number[]) => (["left", "right", "up", "down"] as Dir[]).some((d) => slide(board, d).moved);
export const MAX_SCORE = 500_000;
