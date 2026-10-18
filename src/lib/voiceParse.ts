// Turns "two iced oat lattes and a croissant" into tray lines.
// (No imports, so the tests can load it directly. The AI is used first when set up.)

export type VoiceMenuItem = { id: string; name: string; cat: string };
export type VoiceOpts = { size?: "small" | "regular" | "large"; temp?: "hot" | "iced"; milk?: "whole" | "oat" | "almond" | "none"; sweet?: "none" | "less" | "normal" | "extra"; shot?: boolean };
export type VoiceLine = { itemId: string; qty: number; opts: VoiceOpts };

const NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, ek: 1, do: 2, teen: 3, char: 4 };
const STOP = new Set(["a", "an", "the", "of", "with", "please", "and", "some", "me", "i", "want", "would", "like", "can", "get", "have", "to", "for", "one", "my", "also", "plus", "then", "add"]);
// Words people say that mean a menu item
const ALIASES: Record<string, string[]> = {
  latte: ["latte", "lattes"], cappuccino: ["cappuccino", "cappuccinos", "capp"], chai: ["chai", "chais", "masala"], matcha: ["matcha", "matchas"],
  croissant: ["croissant", "croissants"], cookie: ["cookie", "cookies", "biscuit"], americano: ["americano", "black", "long"], boba: ["boba", "bubble"],
};

// Words that usually describe options, so they count for less when matching names ("oat" milk vs Honey Oat Latte)
const OPTION_WORDS = new Set(["oat", "almond", "whole", "iced", "ice", "cold", "hot", "warm", "large", "big", "small", "little", "black", "double", "strong", "sweet", "sugar", "milk", "extra", "shot"]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const singular = (w: string) => (w.endsWith("ies") ? w.slice(0, -3) + "y" : w.endsWith("es") && w.length > 4 ? w.slice(0, -2) : w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w);

function optionsFrom(t: string): VoiceOpts {
  const o: VoiceOpts = {};
  if (/\b(iced|ice|cold|chilled)\b/.test(t)) o.temp = "iced";
  else if (/\b(hot|warm)\b/.test(t)) o.temp = "hot";
  if (/\boat\b/.test(t)) o.milk = "oat";
  else if (/\balmond\b/.test(t)) o.milk = "almond";
  else if (/\b(no milk|without milk|black)\b/.test(t)) o.milk = "none";
  else if (/\b(whole|regular milk|full fat)\b/.test(t)) o.milk = "whole";
  if (/\b(large|big|grande)\b/.test(t)) o.size = "large";
  else if (/\b(small|little|short)\b/.test(t)) o.size = "small";
  if (/\b(no sugar|unsweetened|without sugar|sugar free)\b/.test(t)) o.sweet = "none";
  else if (/\b(less sweet|less sugar|half sweet)\b/.test(t)) o.sweet = "less";
  else if (/\b(extra sweet|more sugar|extra sugar)\b/.test(t)) o.sweet = "extra";
  if (/\b(extra shot|double shot|double|strong)\b/.test(t)) o.shot = true;
  return o;
}

function bestItem(t: string, menu: VoiceMenuItem[]) {
  const words = t.split(" ").map(singular).filter((w) => !STOP.has(w));
  let best: { item: VoiceMenuItem; score: number } | null = null;
  for (const item of menu) {
    const name = norm(item.name);
    const nameWords = name.split(" ").map(singular);
    let score = 0;
    if (t.includes(name)) score += 10; // said the full name
    for (const w of words) if (w.length > 2 && nameWords.includes(w)) score += OPTION_WORDS.has(w) ? 1 : 3;
    for (const [key, said] of Object.entries(ALIASES)) if (said.some((a) => words.includes(singular(a))) && (name.includes(key) || item.id.includes(key))) score += 2;
    if (score > (best?.score ?? 0)) best = { item, score };
  }
  return best && best.score >= 2 ? best.item : null;
}

/** Best guess at what someone said. "my usual" is returned as a flag. */
export function parseVoiceOrder(text: string, menu: VoiceMenuItem[]): { lines: VoiceLine[]; usual: boolean; missed: string[] } {
  const t = norm(text);
  const usual = /\b(my usual|the usual|usual)\b/.test(t);
  const lines: VoiceLine[] = [];
  const missed: string[] = [];
  for (const part of t.split(/\b(?:and|plus|also|then)\b|,/).map((p) => p.trim()).filter(Boolean)) {
    if (/^(my |the )?usual$/.test(part)) continue;
    const item = bestItem(part, menu);
    if (!item) {
      if (part.split(" ").some((w) => !STOP.has(w) && w.length > 2)) missed.push(part);
      continue;
    }
    const n = part.match(/\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|couple|ek|do|teen|char)\b/);
    const qty = n ? (Number(n[1]) || NUMBERS[n[1]] || 1) : 1;
    lines.push({ itemId: item.id, qty: Math.min(10, Math.max(1, qty)), opts: item.cat === "bakes" ? {} : optionsFrom(part) });
  }
  return { lines, usual, missed };
}
