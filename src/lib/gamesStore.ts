// Games corner: has this person played each daily game today, and their streak for each.
import "server-only";
import { db } from "./db";
import { votersFor } from "./syncStore";
import { toDateStr } from "./cafe";
import { playStreak } from "./gameOrders";
import { fiveDays, todaysFive } from "./todaysFive";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);

export const DAILY_GAMES = [
  { id: "word", title: "The café word", emoji: "🔤", href: "/word", blurb: "Guess the five-letter word" },
  { id: "connections", title: "Café connections", emoji: "🧩", href: "/connections", blurb: "Four groups of four" },
  { id: "dish", title: "Guess the dish", emoji: "🍰", href: "/guess-the-dish", blurb: "Emoji puzzles from the menu" },
  { id: "trivia", title: "Daily trivia", emoji: "❓", href: "/trivia", blurb: "One coffee question" },
  { id: "wordsearch", title: "Word search", emoji: "🔎", href: "/word-search", blurb: "Eight hidden words" },
  { id: "sudoku", title: "Mini sudoku", emoji: "☕", href: "/sudoku", blurb: "Six treats, no repeats" },
  { id: "memory", title: "Memory match", emoji: "🃏", href: "/memory", blurb: "Find the pairs" },
  { id: "slide", title: "Slide puzzle", emoji: "🖼", href: "/slide", blurb: "Put the picture back" },
  { id: "crossword", title: "Mini crossword", emoji: "📝", href: "/crossword", blurb: "A five-by-five grid" },
  { id: "nonogram", title: "Pixel picture", emoji: "🟫", href: "/pixel-picture", blurb: "Shade by the numbers" },
  { id: "crack", title: "Crack the order", emoji: "🔐", href: "/crack-the-order", blurb: "Guess the secret four" },
  { id: "sweeper", title: "Bean sweeper", emoji: "🫘", href: "/bean-sweeper", blurb: "Don't spill the beans" },
  { id: "ladder", title: "Word ladder", emoji: "🪜", href: "/word-ladder", blurb: "One letter at a time" },
  { id: "jigsaw", title: "Café jigsaw", emoji: "🧩", href: "/jigsaw", blurb: "Today's menu photo" },
  { id: "hive", title: "Bean hive", emoji: "🐝", href: "/bean-hive", blurb: "Seven letters, how many words?" },
  { id: "paths", title: "Pour paths", emoji: "🫗", href: "/pour-paths", blurb: "Join the matching cups" },
  { id: "tiles", title: "Tea tiles", emoji: "🀄", href: "/tea-tiles", blurb: "Clear the table in pairs" },
  { id: "spot", title: "Spot the difference", emoji: "🔍", href: "/spot-the-difference", blurb: "Five changes, two minutes" },
  { id: "cipher", title: "Café cryptogram", emoji: "🔏", href: "/cryptogram", blurb: "Crack the coded saying" },
  { id: "flood", title: "Flood the cup", emoji: "🎨", href: "/flood", blurb: "One colour, fewest moves" },
  { id: "lamps", title: "Lamp switch", emoji: "💡", href: "/lamp-switch", blurb: "Turn every lamp off" },
  { id: "jumble", title: "Bean jumble", emoji: "🔀", href: "/bean-jumble", blurb: "Five scrambled café words" },
  { id: "milk", title: "Milk & coffee", emoji: "🥛", href: "/milk-and-coffee", blurb: "Half and half, never three" },
  { id: "lights", title: "String lights", emoji: "✨", href: "/string-lights", blurb: "Link up every lamp" },
  { id: "table", title: "Table for one", emoji: "🪑", href: "/table-for-one", blurb: "Eight guests, nobody touching" },
  { id: "parasols", title: "Parasols", emoji: "⛱️", href: "/parasols", blurb: "Shade for every table" },
  { id: "tipjar", title: "Tip jar", emoji: "🪙", href: "/tip-jar", blurb: "Make every jar add up" },
  { id: "towers", title: "Cake towers", emoji: "🎂", href: "/cake-towers", blurb: "How many cakes can you see?" },
  { id: "cups", title: "Spare cups", emoji: "🥤", href: "/spare-cups", blurb: "Put away the repeats" },
  { id: "corners", title: "Café corners", emoji: "🔤", href: "/cafe-corners", blurb: "Twelve letters, fewest words" },
  { id: "sums", title: "Bean sums", emoji: "➕", href: "/bean-sums", blurb: "Make every run add up" },
  { id: "freecell", title: "Café FreeCell", emoji: "🃏", href: "/cafe-freecell", blurb: "Today's deal, every card face up" },
  { id: "boggle", title: "Bean boggle", emoji: "🔠", href: "/bean-boggle", blurb: "Three minutes, sixteen letters" },
  { id: "bill", title: "Bill total", emoji: "🧾", href: "/bill-total", blurb: "Six numbers, one total" },
  { id: "taller", title: "Taller order", emoji: "📏", href: "/taller-order", blurb: "Signs between the cups" },
  { id: "traytiles", title: "Tray tiles", emoji: "🍱", href: "/tray-tiles", blurb: "Cut the tray into rectangles" },
  { id: "seats", title: "Window seats", emoji: "💡", href: "/window-seats", blurb: "Light every seat" },
  { id: "four", title: "Four at once", emoji: "🍀", href: "/four-at-once", blurb: "Four words, nine tries" },
  { id: "threads", title: "Menu threads", emoji: "🧵", href: "/menu-threads", blurb: "Find the menu in the letters" },
  { id: "garden", title: "Garden plots", emoji: "🌷", href: "/garden-plots", blurb: "Lay the garden path" },
  { id: "rope", title: "Queue rope", emoji: "🪢", href: "/queue-rope", blurb: "One loop round the numbers" },
  { id: "necklace", title: "Bead necklace", emoji: "📿", href: "/bead-necklace", blurb: "Thread every bead" },
  { id: "trail", title: "Coffee trail", emoji: "☕", href: "/coffee-trail", blurb: "Number the trail, one to 36" },
  { id: "pipes", title: "Steam pipes", emoji: "♨️", href: "/steam-pipes", blurb: "Turn the pipes, fill every cup" },
  { id: "cutters", title: "Cookie cutters", emoji: "🍪", href: "/cookie-cutters", blurb: "Fit every cutter in the dough" },
  { id: "cryptic", title: "Cryptic clue", emoji: "✏️", href: "/cryptic-clue", blurb: "One clue, two ways in" },
  { id: "stars", title: "Sugar stars", emoji: "⭐", href: "/sugar-stars", blurb: "Two stars in every row and tray" },
  { id: "wheel", title: "Word wheel", emoji: "🎡", href: "/word-wheel", blurb: "Nine letters, one in the middle" },
  { id: "codeword", title: "Codeword", emoji: "🔢", href: "/codeword", blurb: "Numbers for letters" },
  { id: "zip", title: "Zip path", emoji: "〰️", href: "/zip-path", blurb: "One line through every square" },
  { id: "bikes", title: "Delivery bikes", emoji: "🚲", href: "/delivery-bikes", blurb: "Find the parked fleet" },
  { id: "push", title: "Bean push", emoji: "🫘", href: "/bean-push", blurb: "Push the sacks into place" },
  { id: "price", title: "Price order", emoji: "💸", href: "/price-order", blurb: "Cheapest to dearest" },
] as const;

/** The days you played each daily game. Signed-in games count you by account; the rest by the id kept in your browser. */
export function playedMap(customerId: number | null, voter: unknown): Record<string, string[]> {
  const anon = cleanVoter(voter);
  const me = customerId ? `c${customerId}` : anon;
  // Signed in, the games kept by browser count every browser you've synced from
  const anons = [...new Set([anon, ...votersFor(customerId)].filter(Boolean))] as string[];
  const days = (sql: string, v: string | null) => {
    const vs = v && v === anon ? anons : v ? [v] : anons;
    return [...new Set(vs.flatMap((x) => (db.prepare(sql).all(x) as { date: string }[]).map((r) => r.date)))];
  };
  const played: Record<string, string[]> = {
    word: days("SELECT date FROM word_games WHERE voter = ? AND done = 1", me),
    connections: days("SELECT date FROM connections_games WHERE voter = ? AND done = 1", me),
    dish: days("SELECT date FROM dish_games WHERE voter = ? AND done = 1", me),
    trivia: days("SELECT date FROM trivia_answers WHERE voter = ?", me),
    wordsearch: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'wordsearch' AND voter = ?", anon),
    sudoku: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'sudoku' AND voter = ?", anon),
    memory: days("SELECT DISTINCT date FROM memory_scores WHERE voter = ?", anon),
    slide: days("SELECT DISTINCT date FROM slide_scores WHERE voter = ?", anon),
    crossword: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'crossword' AND voter = ?", anon),
    nonogram: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'nonogram' AND voter = ?", anon),
    crack: days("SELECT date FROM crack_games WHERE voter = ? AND done = 1", me),
    sweeper: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'sweeper' AND voter = ?", anon),
    ladder: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'ladder' AND voter = ?", anon),
    jigsaw: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'jigsaw' AND voter = ?", anon),
    hive: days("SELECT date FROM hive_games WHERE voter = ? AND score > 0", me),
    paths: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'paths' AND voter = ?", anon),
    tiles: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'tiles' AND voter = ?", anon),
    spot: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'spot' AND voter = ?", anon),
    cipher: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'cipher' AND voter = ?", anon),
    flood: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'flood' AND voter = ?", anon),
    lamps: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'lamps' AND voter = ?", anon),
    jumble: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'jumble' AND voter = ?", anon),
    milk: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'milk' AND voter = ?", anon),
    lights: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'lights' AND voter = ?", anon),
    table: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'table' AND voter = ?", anon),
    parasols: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'parasols' AND voter = ?", anon),
    tipjar: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'tipjar' AND voter = ?", anon),
    towers: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'towers' AND voter = ?", anon),
    cups: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'cups' AND voter = ?", anon),
    corners: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'corners' AND voter = ?", anon),
    sums: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'sums' AND voter = ?", anon),
    freecell: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'freecell' AND voter = ?", anon),
    boggle: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'boggle' AND voter = ?", anon),
    bill: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'bill' AND voter = ?", anon),
    taller: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'taller' AND voter = ?", anon),
    traytiles: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'traytiles' AND voter = ?", anon),
    seats: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'seats' AND voter = ?", anon),
    four: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'four' AND voter = ?", anon),
    threads: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'threads' AND voter = ?", anon),
    garden: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'garden' AND voter = ?", anon),
    rope: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'rope' AND voter = ?", anon),
    necklace: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'necklace' AND voter = ?", anon),
    trail: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'trail' AND voter = ?", anon),
    pipes: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'pipes' AND voter = ?", anon),
    cutters: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'cutters' AND voter = ?", anon),
    cryptic: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'cryptic' AND voter = ?", anon),
    stars: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'stars' AND voter = ?", anon),
    wheel: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'wheel' AND voter = ?", anon),
    codeword: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'codeword' AND voter = ?", anon),
    zip: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'zip' AND voter = ?", anon),
    bikes: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'bikes' AND voter = ?", anon),
    push: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'push' AND voter = ?", anon),
    price: days("SELECT DISTINCT date FROM daily_scores WHERE game = 'price' AND voter = ?", anon),
  };
  return played;
}

export function gamesFor(customerId: number | null, voter: unknown, now = new Date()) {
  const today = toDateStr(now);
  const played = playedMap(customerId, voter);
  const games = DAILY_GAMES.map((g) => ({ ...g, done: played[g.id].includes(today), streak: playStreak(played[g.id], today) }));
  // Days you finished every one of them
  const all = [...new Set(Object.values(played).flat())].filter((d) => DAILY_GAMES.every((g) => played[g.id].includes(d)));
  const ids = todaysFive(today);
  const five = { ids, done: ids.filter((id) => played[id].includes(today)).length, streak: playStreak(fiveDays(played), today) };
  return { date: today, games, done: games.filter((g) => g.done).length, allStreak: playStreak(all, today), five };
}
