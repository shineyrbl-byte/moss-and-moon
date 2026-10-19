// Allergens and rough calories. Milk-based allergens for drinks depend on the milk chosen.
// (No imports, so the tests can load it directly.)

export type Allergen = "milk" | "nuts" | "peanuts" | "gluten" | "egg" | "soy" | "sesame" | "fish" | "shellfish" | "mustard" | "celery";
export const ALLERGENS: { id: Allergen; label: string; icon: string }[] = [
  { id: "milk", label: "Milk", icon: "🥛" },
  { id: "nuts", label: "Nuts", icon: "🥜" },
  { id: "gluten", label: "Gluten", icon: "🌾" },
  { id: "egg", label: "Egg", icon: "🥚" },
  { id: "soy", label: "Soy", icon: "🫘" },
  { id: "sesame", label: "Sesame", icon: "⚪" },
  { id: "peanuts", label: "Peanuts", icon: "🥜" },
  { id: "fish", label: "Fish", icon: "🐟" },
  { id: "shellfish", label: "Shellfish", icon: "🦐" },
  { id: "mustard", label: "Mustard", icon: "🟡" },
  { id: "celery", label: "Celery", icon: "🥬" },
];

type Addon = { id: string; kcal?: number; adds?: string[]; removes?: string[] };
type Item = { id: string; cat: string; diet?: string[]; allergens?: Allergen[]; kcal?: number; noMilk?: boolean; addons?: Addon[]; groups?: { id: string; choices: Addon[] }[]; half?: boolean };
type Opts = { size?: string; milk?: string; sweet?: string; shot?: boolean; temp?: string; syrup?: string; toppings?: string[]; addons?: string[]; picks?: Record<string, string[]>; half?: boolean };
const extras = (item: Item, o: Opts) => [...(o.addons ?? []).map((id) => item.addons?.find((x) => x.id === id)), ...(item.groups ?? []).flatMap((g) => (o.picks?.[g.id] ?? []).map((id) => g.choices.find((c) => c.id === id)))].filter(Boolean) as Addon[];
const ALL: string[] = ALLERGENS.map((a) => a.id);

/** Starting values for the menu (owners can change them in the menu editor). kcal = regular size, as it usually comes. */
export const NUTRITION: Record<string, { allergens: Allergen[]; kcal: number }> = {
  "honey-oat-latte": { allergens: [], kcal: 190 }, "rose-latte": { allergens: ["nuts", "milk"], kcal: 260 }, "pour-over": { allergens: [], kcal: 5 },
  cappuccino: { allergens: [], kcal: 130 }, cortado: { allergens: [], kcal: 90 }, "iced-brown-sugar": { allergens: [], kcal: 180 }, americano: { allergens: [], kcal: 10 },
  matcha: { allergens: [], kcal: 150 }, "honey-matcha": { allergens: [], kcal: 200 }, boba: { allergens: [], kcal: 320 }, chai: { allergens: [], kcal: 160 },
  chamomile: { allergens: [], kcal: 30 }, oolong: { allergens: [], kcal: 5 }, "lemon-iced-tea": { allergens: [], kcal: 90 },
  croissant: { allergens: ["gluten", "milk", "egg"], kcal: 280 }, macarons: { allergens: ["nuts", "egg", "milk"], kcal: 320 }, "panna-cotta": { allergens: ["milk"], kcal: 290 },
  cheesecake: { allergens: ["milk", "egg", "gluten"], kcal: 410 }, tiramisu: { allergens: ["milk", "egg", "gluten"], kcal: 450 }, "fudge-cake": { allergens: ["milk", "egg", "gluten", "soy"], kcal: 480 },
  cookie: { allergens: ["gluten", "milk", "egg", "soy"], kcal: 220 }, cupcake: { allergens: ["gluten", "milk", "egg"], kcal: 330 }, "mint-cupcake": { allergens: ["gluten", "milk", "egg"], kcal: 320 },
  donut: { allergens: ["gluten", "milk", "egg", "soy"], kcal: 300 }, sourdough: { allergens: ["gluten", "milk", "sesame"], kcal: 210 },
  "saffron-pista-latte": { allergens: ["nuts"], kcal: 270 }, "monsoon-ginger-chai": { allergens: [], kcal: 150 }, "gingerbread-latte": { allergens: ["gluten"], kcal: 280 }, "strawberry-rose-cloud": { allergens: ["milk"], kcal: 240 },
};

const isDrink = (cat: string) => cat === "coffee" || cat === "tea" || cat === "cold";

/** Allergens for this item as customised. A drink's milk adds milk (dairy), nuts (almond) or a gluten note (oat). */
export function allergensFor(item: Item, o: Opts = {}): Allergen[] {
  const set = new Set<Allergen>(item.allergens ?? []);
  if (isDrink(item.cat) && !item.groups?.length) {
    if (o.milk === "whole") set.add("milk");
    if (o.milk === "almond") set.add("nuts");
    if (o.milk === "soy") set.add("soy");
    if (o.milk === "oat") set.add("gluten"); // oat milk can carry traces of gluten
    if (o.syrup === "hazelnut") set.add("nuts");
    if (o.toppings?.includes("whipped") || o.toppings?.includes("caramel-drizzle")) set.add("milk");
  }
  // Food add-ons: an egg adds egg, gluten-free bread takes gluten away…
  for (const a of extras(item, o)) {
    for (const r of a.removes ?? []) set.delete(r as Allergen);
    for (const x of a.adds ?? []) if (ALL.includes(x)) set.add(x as Allergen);
  }
  return ALLERGENS.map((a) => a.id).filter((a) => set.has(a));
}

/** Rough calories for this item as customised (null if unknown) */
export function kcalFor(item: Item, o: Opts = {}): number | null {
  if (item.kcal === undefined) return null;
  const addons = extras(item, o).reduce((s, a) => s + (a.kcal ?? 0), 0);
  if (!isDrink(item.cat) || item.groups?.length) return Math.round((o.half && item.half ? item.kcal * 0.6 : item.kcal) + addons);
  const size = o.size === "small" ? 0.8 : o.size === "large" ? 1.3 : 1;
  const milky = item.kcal > 60 && !item.diet?.includes("vegan") && !item.noMilk;
  // Change from whole milk (what the starting values assume) for a regular cup
  const milk = !milky ? 0 : o.milk === "none" ? -90 : o.milk === "oat" ? -15 : o.milk === "almond" ? -55 : o.milk === "soy" ? -30 : 0;
  const sweet = o.sweet === "none" ? -40 : o.sweet === "less" ? -20 : o.sweet === "extra" ? 30 : 0;
  const syrup = o.syrup && o.syrup !== "none" ? 60 : 0;
  const tops = (o.toppings ?? []).reduce((s, t) => s + (t === "whipped" ? 80 : t === "caramel-drizzle" ? 40 : 5), 0);
  return Math.max(0, Math.round(((item.kcal + milk + sweet + syrup) * size + tops + (o.shot ? 5 : 0)) / 5) * 5);
}

/** For menu filters: can it be had without this allergen? (Drinks can swap their milk.) */
export function canAvoid(item: Item, allergen: Allergen) {
  return !(item.allergens ?? []).includes(allergen);
}
