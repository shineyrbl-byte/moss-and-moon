// Tasting notes. Guests tap them in the coffee diary; dishes get them from their description.
// Pure, so the diary page, the server and tests share it.
export const FLAVOURS = [
  { id: "chocolatey", label: "Chocolatey", icon: "🍫" },
  { id: "nutty", label: "Nutty", icon: "🌰" },
  { id: "caramel", label: "Caramel", icon: "🍯" },
  { id: "fruity", label: "Fruity", icon: "🍑" },
  { id: "berry", label: "Berry", icon: "🫐" },
  { id: "citrus", label: "Citrus", icon: "🍋" },
  { id: "floral", label: "Floral", icon: "🌸" },
  { id: "spicy", label: "Spiced", icon: "🌶" },
  { id: "earthy", label: "Earthy", icon: "🍂" },
  { id: "creamy", label: "Creamy", icon: "🥛" },
  { id: "bright", label: "Bright", icon: "✨" },
  { id: "bold", label: "Bold", icon: "💪" },
] as const;
export type Flavour = (typeof FLAVOURS)[number]["id"];
export const MAX_NOTES = 4;
const IDS = new Set<string>(FLAVOURS.map((f) => f.id));

/** Keep only real notes, at most four, no repeats */
export const cleanFlavours = (v: unknown): Flavour[] => (Array.isArray(v) ? [...new Set(v.map(String))].filter((x) => IDS.has(x)).slice(0, MAX_NOTES) as Flavour[] : []);

const WORDS: [Flavour, RegExp][] = [
  ["chocolatey", /chocolat|cocoa|mocha|brownie|fudge|nutella|oreo/i],
  ["nutty", /hazelnut|almond|pistachio|walnut|nut\b|nutty|cashew/i],
  ["caramel", /caramel|brown sugar|jaggery|honey|condensed|molasses|maple/i],
  ["fruity", /mango|passionfruit|fruit|watermelon|banana|kiwi|apple|wine-like|juicy/i],
  ["berry", /berry|strawberr|raspberr|blueberr|blackberr|cherr/i],
  ["citrus", /lime|lemon|orange|citrus|kokum|tonic/i],
  ["floral", /rose|hibiscus|chamomile|floral|lavender|jasmine/i],
  ["spicy", /cardamom|cinnamon|ginger|spice|masala|saffron|kesar|pepper|nutmeg|clove|chilli/i],
  ["earthy", /earthy|matcha|hojicha|roasted|turmeric|chicory|kahwa/i],
  ["creamy", /cream|milk|oat|velvet|silky|gelato|kulfi|lassi|curd/i],
  ["bright", /bright|tart|zesty|fresh|single-origin|pour-over|fizz|soda/i],
  ["bold", /bold|strong|double|ristretto|long black|kick|decoction/i],
];

/** Flavour notes a dish probably has, from its name and description */
export function dishFlavours(m: { name: string; desc?: string }): Flavour[] {
  const text = `${m.name} ${m.desc ?? ""}`;
  return WORDS.filter(([, re]) => re.test(text)).map(([f]) => f);
}

/** The flavours you love most: notes on better-rated coffees count more (5★ = 3, 4★ = 2, 3★ = 1, lower = 0) */
export function favouriteFlavours(entries: { rating: number; flavours: Flavour[] }[], n = 3): Flavour[] {
  const score = new Map<Flavour, number>();
  for (const e of entries) for (const f of e.flavours) score.set(f, (score.get(f) ?? 0) + Math.max(0, e.rating - 2));
  return [...score.entries()].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1] || FLAVOURS.findIndex((x) => x.id === a[0]) - FLAVOURS.findIndex((x) => x.id === b[0])).slice(0, n).map(([f]) => f);
}

export const flavourLabel = (f: string) => { const x = FLAVOURS.find((y) => y.id === f); return x ? `${x.icon} ${x.label}` : f; };
