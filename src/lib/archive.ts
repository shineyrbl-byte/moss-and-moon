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
/** A ?day= value, if it's one of the archive days */
export const validDay = (day: unknown, today: string) => (typeof day === "string" && pastDays(today).includes(day) ? day : null);

/** The day this page is playing: from ?day= in the address, or today. Browser only. */
export function playDay(): string {
  const today = todayStr();
  try { return validDay(new URLSearchParams(window.location.search).get("day"), today) ?? today; } catch { return today; }
}
export const isPast = (date: string) => !!date && date < todayStr();
/** Where a page keeps its progress: past days get their own key */
export function dayKey(key: string) {
  const d = playDay();
  return d === todayStr() ? key : `${key}@${d}`;
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
] as const;

/** Has a past day been finished? `keys` is every saved key in this browser, `get` reads one. */
export function finishedOn(key: string, day: string, keys: string[], get: (k: string) => string | null) {
  return keys.some((k) => {
    if (!(k === `${key}@${day}` || (k.startsWith(`${key}-`) && k.endsWith(`@${day}`)))) return false;
    try { const v = JSON.parse(get(k) ?? "null"); return v?.date === day && v.doneMs != null; } catch { return false; }
  });
}
