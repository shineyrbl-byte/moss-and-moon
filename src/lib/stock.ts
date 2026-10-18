// Ingredient stock: drinks use up beans, milk, matcha… and an item shows as
// sold out by itself when something it needs runs out.
import "server-only";
import { db } from "./db";
import type { MenuItem } from "./menu";
import type { Options, QuoteLine } from "./pricing";

export type Ingredient = { id: string; name: string; unit: string; qty: number; low_at: number; cost: number | null };

// cost: rough Indian wholesale prices in ₹ per g or ml (owners can change them in Admin → Stock)
export const DEFAULT_INGREDIENTS: Ingredient[] = [
  { id: "espresso-beans", name: "Espresso beans", unit: "g", qty: 5000, low_at: 500, cost: 1.6 },
  { id: "milk-whole", name: "Whole milk", unit: "ml", qty: 20000, low_at: 2000, cost: 0.07 },
  { id: "milk-oat", name: "Oat milk", unit: "ml", qty: 10000, low_at: 1500, cost: 0.28 },
  { id: "milk-almond", name: "Almond milk", unit: "ml", qty: 6000, low_at: 1000, cost: 0.32 },
  { id: "matcha", name: "Matcha powder", unit: "g", qty: 1000, low_at: 120, cost: 6 },
  { id: "tea-leaves", name: "Loose-leaf tea", unit: "g", qty: 2000, low_at: 200, cost: 1.2 },
  { id: "tapioca", name: "Tapioca pearls", unit: "g", qty: 3000, low_at: 400, cost: 0.45 },
];

export function seedIngredients() {
  const n = (db.prepare("SELECT COUNT(*) AS n FROM ingredients").get() as { n: number }).n;
  if (!n) {
    const add = db.prepare("INSERT INTO ingredients (id, name, unit, qty, low_at, cost) VALUES (?, ?, ?, ?, ?, ?)");
    for (const i of DEFAULT_INGREDIENTS) add.run(i.id, i.name, i.unit, i.qty, i.low_at, i.cost);
  }
  // Older databases: fill in starting costs once
  const fill = db.prepare("UPDATE ingredients SET cost = ? WHERE id = ? AND cost IS NULL");
  for (const i of DEFAULT_INGREDIENTS) fill.run(i.cost, i.id);
}

export function getIngredients(): Ingredient[] {
  seedIngredients();
  return db.prepare("SELECT * FROM ingredients ORDER BY name").all() as Ingredient[];
}

/** Sensible defaults so stock works without setting up every item by hand */
export function defaultUses(item: MenuItem): { ingredient: string; amount: number }[] {
  if (item.cat === "bakes") return [];
  const text = `${item.name} ${item.desc}`.toLowerCase();
  if (item.cat === "coffee") {
    const milky = !item.diet?.includes("vegan") && !/pour-over|long black|americano/.test(text);
    return [{ ingredient: "espresso-beans", amount: 18 }, ...(milky ? [{ ingredient: "milk", amount: 200 }] : [])];
  }
  if (/matcha/.test(text)) return [{ ingredient: "matcha", amount: 4 }, { ingredient: "milk", amount: 200 }];
  if (/boba|pearl/.test(text)) return [{ ingredient: "tea-leaves", amount: 5 }, { ingredient: "tapioca", amount: 40 }, { ingredient: "milk", amount: 150 }];
  if (/chai/.test(text)) return [{ ingredient: "tea-leaves", amount: 5 }, { ingredient: "milk", amount: 150 }];
  return [{ ingredient: "tea-leaves", amount: 5 }];
}

const SIZE = { small: 0.8, regular: 1, large: 1.3 } as const;
const MILK = { whole: "milk-whole", oat: "milk-oat", almond: "milk-almond" } as const;

/** Ingredient amounts needed for one cup/piece with these options */
export function needsFor(item: MenuItem, o: Options): Map<string, number> {
  const out = new Map<string, number>();
  const mult = SIZE[o.size ?? "regular"] ?? 1;
  const uses = item.uses?.length ? item.uses : defaultUses(item);
  for (const u of uses) {
    let id = u.ingredient;
    if (id === "milk") {
      if (o.milk === "none") continue;
      id = MILK[(o.milk as keyof typeof MILK) ?? "whole"] ?? "milk-whole";
    }
    out.set(id, (out.get(id) ?? 0) + u.amount * (item.cat === "bakes" ? 1 : mult));
  }
  if (o.shot) out.set("espresso-beans", (out.get("espresso-beans") ?? 0) + 9);
  return out;
}

function totals(lines: QuoteLine[], find: (id: string) => MenuItem | undefined) {
  const need = new Map<string, number>();
  for (const l of lines) {
    const item = find(l.itemId);
    if (!item) continue;
    for (const [id, amt] of needsFor(item, l.opts)) need.set(id, (need.get(id) ?? 0) + amt * l.qty);
  }
  return need;
}

function stockMap() {
  return new Map(getIngredients().map((i) => [i.id, i]));
}

function itemFinder() {
  const rows = db.prepare("SELECT id, data FROM menu_items").all() as { id: string; data: string }[];
  const map = new Map(rows.map((r) => [r.id, { ...(JSON.parse(r.data) as MenuItem), id: r.id }]));
  return (id: string) => map.get(id);
}

/** Returns the name of a missing ingredient, or null if we can make it all */
export function checkStock(lines: QuoteLine[]): string | null {
  const have = stockMap();
  for (const [id, amt] of totals(lines, itemFinder())) {
    const ing = have.get(id);
    if (ing && ing.qty < amt) return ing.name.toLowerCase();
  }
  return null;
}

/** Take the ingredients for an order out of stock */
export function consumeStock(lines: QuoteLine[]) {
  const upd = db.prepare("UPDATE ingredients SET qty = MAX(0, qty - ?) WHERE id = ?");
  for (const [id, amt] of totals(lines, itemFinder())) upd.run(amt, id);
}

/** Can we make one standard version of this item right now? */
export function canMake(item: MenuItem, have = stockMap()) {
  const defaults: Options = item.cat === "bakes" ? {} : { size: "regular", milk: item.diet?.includes("vegan") ? "none" : "whole" };
  for (const [id, amt] of needsFor(item, defaults)) {
    const ing = have.get(id);
    if (ing && ing.qty < amt) return false;
  }
  return true;
}

export { stockMap };
