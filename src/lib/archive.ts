// Puzzle archive: replay the last week of the daily puzzles that are built from the date. Past days get their own saved
// progress (so today's game is never overwritten) and don't go on the boards.
export const ARCHIVE_DAYS = 7;
const pad = (n: number) => String(n).padStart(2, "0");
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => local(new Date());

/** The days you can go back to: yesterday first */
export function pastDays(today: string, n = ARCHIVE_DAYS): string[] {
  const [y, m, d] = today.split("-").map(Number);
  return [...Array(n).keys()].map((k) => local(new Date(y, m - 1, d - 1 - k)));
}
/** Practice puzzles come from any day between this and the start of the archive week */
export const PRACTICE_FROM = "2024-01-01";
const realDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && local(new Date(`${s}T12:00:00`)) === s;
/** A ?day= value, if it's one of the archive days (or, for practice, any older day back to PRACTICE_FROM) */
export const validDay = (day: unknown, today: string, practice = false) => {
  if (typeof day !== "string") return null;
  if (pastDays(today).includes(day)) return day;
  const oldest = pastDays(today)[ARCHIVE_DAYS - 1];
  return practice && realDay(day) && day >= PRACTICE_FROM && day < oldest ? day : null;
};
/** A random older day for a practice puzzle */
export function practiceDay(today: string, rand = Math.random) {
  const from = Date.parse(`${PRACTICE_FROM}T12:00:00`), to = Date.parse(`${pastDays(today)[ARCHIVE_DAYS - 1]}T12:00:00`);
  const n = Math.round((to - from) / 86400_000);
  const [y, m, d] = PRACTICE_FROM.split("-").map(Number);
  return local(new Date(y, m - 1, d + Math.floor(rand() * n)));
}
/** Is this page a practice puzzle (?practice=1)? Browser only. */
export function isPractice(): boolean {
  try { const q = new URLSearchParams(window.location.search); return q.get("practice") === "1" && validDay(q.get("day"), todayStr(), true) !== null; } catch { return false; }
}

/** The day this page is playing: from ?day= in the address, or today. Browser only. */
export function playDay(): string {
  const today = todayStr();
  try { const q = new URLSearchParams(window.location.search); return validDay(q.get("day"), today, q.get("practice") === "1") ?? today; } catch { return today; }
}
export const isPast = (date: string) => !!date && date < todayStr();
/** Where a page keeps its progress: past days get their own key */
export function dayKey(key: string) {
  const d = playDay();
  // Practice puzzles share one slot, so old ones don't pile up in storage
  return d === todayStr() ? key : isPractice() ? `${key}@practice` : `${key}@${d}`;
}

/** The puzzles in the archive, with the key each one saves under */
export const ARCHIVE_GAMES = [
  { id: "wordsearch", href: "/word-search", title: "Word search", emoji: "🔎", key: "mm-wordsearch" },
  { id: "sudoku", href: "/sudoku", title: "Mini sudoku", emoji: "☕", key: "mm-sudoku" },
  { id: "crossword", href: "/crossword", title: "Mini crossword", emoji: "📝", key: "mm-crossword" },
  { id: "nonogram", href: "/pixel-picture", title: "Pixel picture", emoji: "🟫", key: "mm-nonogram" },
  { id: "ladder", href: "/word-ladder", title: "Word ladder", emoji: "🪜", key: "mm-ladder" },
  { id: "jigsaw", href: "/jigsaw", title: "Café jigsaw", emoji: "🧩", key: "mm-jigsaw" },
  { id: "paths", href: "/pour-paths", title: "Pour paths", emoji: "🫗", key: "mm-paths" },
  { id: "tiles", href: "/tea-tiles", title: "Tea tiles", emoji: "🀄", key: "mm-tiles" },
  { id: "spot", href: "/spot-the-difference", title: "Spot the difference", emoji: "🔍", key: "mm-spot" },
  { id: "cipher", href: "/cryptogram", title: "Café cryptogram", emoji: "🔏", key: "mm-cipher" },
  { id: "flood", href: "/flood", title: "Flood the cup", emoji: "🎨", key: "mm-flood" },
  { id: "lamps", href: "/lamp-switch", title: "Lamp switch", emoji: "💡", key: "mm-lamps" },
  { id: "jumble", href: "/bean-jumble", title: "Bean jumble", emoji: "🔀", key: "mm-jumble" },
  { id: "milk", href: "/milk-and-coffee", title: "Milk & coffee", emoji: "🥛", key: "mm-milk" },
  { id: "lights", href: "/string-lights", title: "String lights", emoji: "✨", key: "mm-lights" },
  { id: "table", href: "/table-for-one", title: "Table for one", emoji: "🪑", key: "mm-table" },
  { id: "parasols", href: "/parasols", title: "Parasols", emoji: "⛱️", key: "mm-parasols" },
  { id: "tipjar", href: "/tip-jar", title: "Tip jar", emoji: "🪙", key: "mm-tipjar" },
  { id: "towers", href: "/cake-towers", title: "Cake towers", emoji: "🎂", key: "mm-towers" },
  { id: "cups", href: "/spare-cups", title: "Spare cups", emoji: "🥤", key: "mm-cups" },
  { id: "corners", href: "/cafe-corners", title: "Café corners", emoji: "🔤", key: "mm-corners" },
  { id: "sums", href: "/bean-sums", title: "Bean sums", emoji: "➕", key: "mm-sums" },
  { id: "freecell", href: "/cafe-freecell", title: "Café FreeCell", emoji: "🃏", key: "mm-freecell" },
  { id: "boggle", href: "/bean-boggle", title: "Bean boggle", emoji: "🔠", key: "mm-boggle" },
  { id: "bill", href: "/bill-total", title: "Bill total", emoji: "🧾", key: "mm-bill" },
  { id: "taller", href: "/taller-order", title: "Taller order", emoji: "📏", key: "mm-taller" },
  { id: "traytiles", href: "/tray-tiles", title: "Tray tiles", emoji: "🍱", key: "mm-traytiles" },
  { id: "seats", href: "/window-seats", title: "Window seats", emoji: "💡", key: "mm-seats" },
  { id: "four", href: "/four-at-once", title: "Four at once", emoji: "🍀", key: "mm-four" },
  { id: "threads", href: "/menu-threads", title: "Menu threads", emoji: "🧵", key: "mm-threads" },
  { id: "garden", href: "/garden-plots", title: "Garden plots", emoji: "🌷", key: "mm-garden" },
  { id: "rope", href: "/queue-rope", title: "Queue rope", emoji: "🪢", key: "mm-rope" },
  { id: "necklace", href: "/bead-necklace", title: "Bead necklace", emoji: "📿", key: "mm-necklace" },
  { id: "trail", href: "/coffee-trail", title: "Coffee trail", emoji: "☕", key: "mm-trail" },
  { id: "pipes", href: "/steam-pipes", title: "Steam pipes", emoji: "♨️", key: "mm-pipes" },
  { id: "cutters", href: "/cookie-cutters", title: "Cookie cutters", emoji: "🍪", key: "mm-cutters" },
  { id: "cryptic", href: "/cryptic-clue", title: "Cryptic clue", emoji: "✏️", key: "mm-cryptic" },
  { id: "stars", href: "/sugar-stars", title: "Sugar stars", emoji: "⭐", key: "mm-stars" },
  { id: "wheel", href: "/word-wheel", title: "Word wheel", emoji: "🎡", key: "mm-wheel" },
  { id: "codeword", href: "/codeword", title: "Codeword", emoji: "🔢", key: "mm-codeword" },
  { id: "zip", href: "/zip-path", title: "Zip path", emoji: "〰️", key: "mm-zip" },
  { id: "bikes", href: "/delivery-bikes", title: "Delivery bikes", emoji: "🚲", key: "mm-bikes" },
  { id: "push", href: "/bean-push", title: "Bean push", emoji: "🫘", key: "mm-push" },
  { id: "price", href: "/price-order", title: "Price order", emoji: "💸", key: "mm-price" },
] as const;

/** Has a past day been finished? `keys` is every saved key in this browser, `get` reads one. */
export function finishedOn(key: string, day: string, keys: string[], get: (k: string) => string | null) {
  return keys.some((k) => {
    if (!(k === `${key}@${day}` || (k.startsWith(`${key}-`) && k.endsWith(`@${day}`)))) return false;
    try { const v = JSON.parse(get(k) ?? "null"); return v?.date === day && v.doneMs != null; } catch { return false; }
  });
}
