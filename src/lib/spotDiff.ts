// Spot the difference: two café scenes drawn from emoji, five changes in the second. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export const COLS = 6, ROWS = 5, DIFFS = 5;
export const TIME_MS = 120_000, MISS_MS = 5000, minMs = 4000;
// Things you'd see around a café
const ITEMS = ["☕", "🍵", "🧋", "🥐", "🍩", "🍪", "🧁", "🍰", "🥧", "🍫", "🍯", "🥛", "🫖", "🍓", "🍋", "🌿", "🪴", "🌵", "📚", "🕯️", "🖼️", "🎨", "🧸", "🐈", "🍎", "🥨", "🥯", "🧇", "🍌", "🌻", "⏰", "💡", "🎧", "🧶", "🍒", "🥑"];
// Bright things, where a colour change is easy to see
const COLOURFUL = new Set(["🍩", "🧁", "🍰", "🍓", "🍋", "🌿", "🪴", "🌵", "📚", "🎨", "🧸", "🍎", "🍌", "🌻", "🎧", "🧶", "🍒", "🥑", "🍵"]);

export type Item = { cell: number; emoji: string; size: number; rot: number; dx: number; dy: number; hue: number };
export type DiffKind = "swap" | "gone" | "added" | "colour" | "bigger" | "turned";
export type Scene = { left: Item[]; right: Item[]; diffs: { cell: number; kind: DiffKind }[] };

export function sceneFor(date: string): Scene {
  const rand = seededRand(`spot:${date}`);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const cells = [...Array(COLS * ROWS).keys()];
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const filled = cells.slice(0, 20), empty = cells.slice(20);
  const left: Item[] = filled.map((cell) => ({ cell, emoji: pick(ITEMS), size: 0.85 + rand() * 0.3, rot: Math.round((rand() - 0.5) * 24), dx: (rand() - 0.5) * 0.3, dy: (rand() - 0.5) * 0.3, hue: 0 }));
  const right = left.map((it) => ({ ...it }));
  const diffs: Scene["diffs"] = [];
  const used = new Set<number>();
  // Changes go on squares that don't touch each other, so each one is clearly separate
  const touches = (a: number, b: number) => Math.abs((a % COLS) - (b % COLS)) <= 1 && Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) <= 1;
  const clear = (c: number) => ![...used].some((u) => touches(u, c));
  const kinds: DiffKind[] = ["swap", "gone", "added", "colour", "bigger", "turned"];
  while (diffs.length < DIFFS) {
    const kind = pick(kinds);
    if (kind === "added") {
      const c = empty.find((x) => clear(x));
      if (c === undefined) continue;
      used.add(c);
      right.push({ cell: c, emoji: pick(ITEMS), size: 1, rot: 0, dx: 0, dy: 0, hue: 0 });
      diffs.push({ cell: c, kind });
      continue;
    }
    const options = right.filter((it) => clear(it.cell) && (kind !== "colour" || COLOURFUL.has(it.emoji)));
    if (!options.length) continue;
    const it = pick(options);
    used.add(it.cell);
    if (kind === "swap") it.emoji = pick(ITEMS.filter((e) => e !== it.emoji));
    if (kind === "colour") it.hue = 150 + Math.round(rand() * 60);
    if (kind === "bigger") it.size = it.size * 1.6;
    if (kind === "turned") it.rot = it.rot + 90;
    diffs.push({ cell: it.cell, kind });
  }
  return { left, right: right.filter((it) => !diffs.some((d) => d.kind === "gone" && d.cell === it.cell)), diffs };
}

/** Which difference (if any) a tap at (x, y) in 0..1 picture units lands on; a little slack around each square */
export function hitDiff(scene: Scene, x: number, y: number, found: number[]) {
  const cx = x * COLS, cy = y * ROWS;
  return scene.diffs.findIndex((d, i) => {
    if (found.includes(i)) return false;
    const dx = cx - ((d.cell % COLS) + 0.5), dy = cy - (Math.floor(d.cell / COLS) + 0.5);
    return Math.abs(dx) <= 0.7 && Math.abs(dy) <= 0.7;
  });
}
