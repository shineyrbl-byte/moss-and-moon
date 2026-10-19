// Rough caffeine estimates (mg). Pure, so the drink window, the diary and tests can all use it.
// An espresso shot is about 64 mg; a regular here has two shots.
export const DAILY_LIMIT = 400; // the usual guidance for healthy adults
export const LATE_HOUR = 15; // after 3pm caffeine is more likely to keep you up

type Item = { id: string; cat: string; name: string; desc?: string; caffeine?: number; traits?: { energy: number } };
type Opts = { size?: string; shot?: boolean; decaf?: boolean } | undefined;

const KNOWN: Record<string, number> = {
  americano: 128, "cold-brew": 200, "mango-cold-brew": 180, "vietnamese-iced": 150, "filter-kaapi": 100, affogato: 64, "coffee-flight": 120,
  "coconut-espresso": 128, "cold-coffee": 90, "oreo-frappe": 100, "iced-mocha": 128,
  matcha: 70, "honey-matcha": 70, "matcha-flight": 90, chai: 50, "monsoon-ginger-chai": 50, "iced-hojicha": 20, oolong: 40, kahwa: 25, boba: 40,
  "lemon-iced-tea": 40, "hot-chocolate": 15, babyccino: 0, "kids-milk": 5, tiramisu: 30, "samosa-plate": 50, "fruit-nut-bark": 15,
};
const HERBAL = /chamomile|hibiscus|ginger lemon|turmeric|rooibos|peppermint|herbal|tulsi|babyccino/i;
const COFFEE = /coffee|espresso|brew|mocha|frapp|kaapi|latte|cortado|cappuccino|flat white|long black|americano/i;

/** Caffeine in one of our dishes as it comes (0 if none) */
export function baseCaffeine(m: Item): number {
  if (typeof m.caffeine === "number") return m.caffeine;
  if (m.id in KNOWN) return KNOWN[m.id];
  const text = `${m.name} ${m.desc ?? ""}`;
  if (HERBAL.test(m.name)) return 0;
  if (m.cat === "coffee") return m.traits?.energy === 0 ? 64 : 128;
  if (m.cat === "tea") return /matcha/i.test(text) ? 70 : /chai|tea/i.test(text) ? 45 : 0;
  if (m.cat === "cold") return COFFEE.test(text) ? 110 : 0;
  return 0;
}

/** With the guest's choices: size, an extra shot, decaf */
export function caffeineFor(m: Item, opts?: Opts): number {
  const base = baseCaffeine(m);
  if (!base) return 0;
  const coffee = m.cat === "coffee" || (m.cat === "cold" && COFFEE.test(`${m.name} ${m.desc ?? ""}`));
  if (opts?.decaf && coffee) return 5;
  const size = opts?.size === "small" ? 0.8 : opts?.size === "large" ? 1.3 : 1;
  return Math.round(base * size + (opts?.shot && coffee ? 64 : 0));
}

/** A guess for something drunk elsewhere, from its name (null if we can't tell) */
export function guessCaffeine(name: string): number | null {
  const n = name.toLowerCase();
  if (/decaf/.test(n)) return 5;
  if (HERBAL.test(n)) return 0;
  if (/cold brew|nitro/.test(n)) return 200;
  if (/double|doppio/.test(n)) return 128;
  if (/espresso|ristretto|shot/.test(n)) return 64;
  if (/energy drink|red bull|monster/.test(n)) return 80;
  if (/matcha/.test(n)) return 70;
  if (/cola|coke/.test(n)) return 35;
  if (COFFEE.test(n) || /kaapi|macchiato|cold coffee/.test(n)) return 100;
  if (/chai|tea/.test(n)) return 45;
  if (/hot chocolate|cocoa/.test(n)) return 15;
  return null;
}

/** A gentle note about today's total */
export function caffeineNudge(total: number, hour: number): string | null {
  if (total > DAILY_LIMIT) return `That's over ${DAILY_LIMIT} mg, the usual daily limit for adults. Maybe water or a herbal tea next?`;
  if (hour >= LATE_HOUR && total >= 200) return "It's getting late. A decaf or the turmeric latte will be kinder to your sleep.";
  return null;
}
