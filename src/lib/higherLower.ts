// Higher or lower: which of two menu items costs more? Pure, so the page and tests share it.
export type HLItem = { id: string; name: string; price: number; img: string };
export const HL_MAX = 500;
/** Two items with different prices (null if the menu can't make a pair) */
export function pairFrom(items: HLItem[], rand: () => number, not: string[] = []): [HLItem, HLItem] | null {
  const pool = items.filter((i) => !not.includes(i.id));
  for (let t = 0; t < 50; t++) {
    const a = pool[Math.floor(rand() * pool.length)], b = pool[Math.floor(rand() * pool.length)];
    if (a && b && a.id !== b.id && a.price !== b.price) return [a, b];
  }
  return null;
}
