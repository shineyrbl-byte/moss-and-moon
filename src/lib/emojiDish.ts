// Guess the dish: emoji puzzles that spell out something on our menu. Pure, so the server and tests share it.
import { seededRand } from "./gameOrders.ts";

export const PER_DAY = 5, TRIES = 3;
/** id = the menu item; also = other names we'll accept */
export const DISH_PUZZLES: { id: string; emoji: string; also: string[] }[] = [
  { id: "cappuccino", emoji: "🇮🇹☕🫧", also: ["cappuccino"] },
  { id: "croissant", emoji: "🧈🌙", also: ["croissant"] },
  { id: "cheesecake", emoji: "🫐🧀🍰", also: ["cheesecake"] },
  { id: "tiramisu", emoji: "🇮🇹☕🍰⬆️", also: ["tiramisu"] },
  { id: "cookie", emoji: "🟤🧈🍪", also: ["brown butter cookies", "cookie"] },
  { id: "donut", emoji: "🌈✨🍩", also: ["sprinkle doughnut", "donut", "doughnut", "sprinkles donut"] },
  { id: "cold-brew", emoji: "🐢❄️☕", also: ["cold brew"] },
  { id: "mango-smoothie", emoji: "🥭🥛🥤", also: ["mango lassi", "mango smoothie", "mango lassi smoothie"] },
  { id: "strawberry-banana", emoji: "🍓🍌🥤", also: ["strawberry banana smoothie", "strawberry and banana smoothie"] },
  { id: "fresh-orange", emoji: "🍊🧃", also: ["orange juice"] },
  { id: "cheese-toastie", emoji: "3️⃣🧀🍞", also: ["cheese toastie", "three cheese toast"] },
  { id: "avocado-toast", emoji: "🔨🥑🍞", also: ["avocado toast", "smashed avo toast"] },
  { id: "pancakes", emoji: "🥛🥞🥞🥞", also: ["pancakes", "pancake stack", "buttermilk pancakes"] },
  { id: "penne-arrabbiata", emoji: "🍝😠🌶️", also: ["arrabbiata", "penne arrabiata", "pasta arrabbiata"] },
  { id: "affogato", emoji: "🍨☕🌊", also: ["affogato"] },
  { id: "watermelon-cooler", emoji: "🍉🌿❄️", also: ["watermelon cooler", "watermelon mint"] },
  { id: "nutella-shake", emoji: "🌰🍫🥤🤪", also: ["nutella shake", "freakshake", "nutella milkshake"] },
  { id: "cinnamon-roll", emoji: "🪵🌀🍞", also: ["cinnamon roll", "cinnamon bun"] },
  { id: "hot-chocolate", emoji: "🔥🍫☁️", also: ["hot chocolate", "hot chocolate with marshmallows", "hot cocoa"] },
  { id: "mango-sorbet", emoji: "🥭❄️🍧", also: ["mango sorbet"] },
  { id: "banana-bread", emoji: "🍌🍞🌰", also: ["banana bread", "banana walnut"] },
  { id: "funfetti-cookie", emoji: "🎉🎂🍪", also: ["funfetti cookie", "birthday cookie"] },
  { id: "chilli-prawns", emoji: "🌶️🦐", also: ["chilli prawns", "prawn bites", "chili prawns"] },
  { id: "recheado-wings", emoji: "🌶️🐔🪽", also: ["recheado wings", "chicken wings", "recheado chicken wings"] },
  { id: "pav-bhaji", emoji: "🍞🥔🍅🧈", also: ["pav bhaji", "pao bhaji"] },
  { id: "masala-bhutta", emoji: "🌽🔥🧂", also: ["bhutta", "masala corn", "corn on the cob"] },
  { id: "samosa-plate", emoji: "☕🔺🔺", also: ["chai and samosa", "samosa", "samosa plate", "chai samosa"] },
  { id: "hibiscus-tea", emoji: "🌺🌹🍵", also: ["hibiscus tea", "hibiscus and rose tea"] },
  { id: "chamomile", emoji: "🌼🍯🍵", also: ["chamomile", "chamomile tea", "chamomile honey"] },
  { id: "boba", emoji: "🟤🍬🧋", also: ["boba", "bubble tea", "brown sugar bubble tea"] },
  { id: "spanish-latte", emoji: "🇪🇸🥛☕", also: ["spanish latte"] },
  { id: "hazelnut-latte", emoji: "🌰🥛☕", also: ["hazelnut latte"] },
  { id: "vietnamese-iced", emoji: "🇻🇳🧊☕", also: ["vietnamese coffee", "vietnamese iced coffee"] },
  { id: "rose-kulfi", emoji: "🌹🍦🇮🇳", also: ["kulfi", "rose kulfi"] },
  { id: "black-forest", emoji: "⚫🌲🍰", also: ["black forest", "black forest cake"] },
  { id: "brownie-sundae", emoji: "🟫🍨🍒", also: ["brownie sundae", "brownie with ice cream"] },
  { id: "shakshuka", emoji: "🍳🍅🌶️🍲", also: ["shakshuka", "shakshouka"] },
  { id: "idli", emoji: "⚪⚪🥥", also: ["idli", "idli chutney", "idli and chutney"] },
  { id: "pea-soup", emoji: "🫛🌿🥣", also: ["pea soup", "pea and mint soup"] },
  { id: "dalgona", emoji: "🍯☁️☕", also: ["dalgona", "whipped coffee"] },
  { id: "oreo-frappe", emoji: "🍪🥛❄️🥤", also: ["cookies and cream frappe", "oreo frappe", "cookies and cream"] },
  { id: "pupcake", emoji: "🐶🧁", also: ["pupcake", "pup cake"] },
];

/** Lowercase letters and numbers only, accents and "&" tidied */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
function distance(a: string, b: string) {
  const d = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}
/** Right if it's the dish's name or a name we accept, allowing a small typo */
export function isRight(guess: string, name: string, also: string[]) {
  const g = norm(guess);
  if (g.length < 3) return false;
  return [name, ...also].map(norm).some((n) => n === g || (n.length >= 6 && distance(n, g) <= (n.length >= 12 ? 2 : 1)));
}

/** Today's five, from the dishes on the menu right now */
export function dishesFor(date: string, onMenu: Set<string>) {
  const pool = DISH_PUZZLES.filter((p) => onMenu.has(p.id));
  const rand = seededRand(`emojidish:${date}`);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, PER_DAY);
}
/** Share text: how many tries each took, no answers */
export const dishGrid = (tries: { ok: boolean; n: number }[]) => tries.map((t) => (t.ok ? ["🟩", "🟨", "🟧"][t.n - 1] ?? "🟧" : "⬛")).join("");
