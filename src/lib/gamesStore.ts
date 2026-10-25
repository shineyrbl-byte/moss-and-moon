// Games corner: has this person played each daily game today, and their streak for each.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { playStreak } from "./gameOrders";

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
] as const;

/** Signed-in games count you by account; the rest by the id kept in your browser */
export function gamesFor(customerId: number | null, voter: unknown, now = new Date()) {
  const anon = cleanVoter(voter);
  const me = customerId ? `c${customerId}` : anon;
  const today = toDateStr(now);
  const days = (sql: string, v: string | null) => (v ? (db.prepare(sql).all(v) as { date: string }[]).map((r) => r.date) : []);
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
  };
  const games = DAILY_GAMES.map((g) => ({ ...g, done: played[g.id].includes(today), streak: playStreak(played[g.id], today) }));
  // Days you finished every one of them
  const all = [...new Set(Object.values(played).flat())].filter((d) => DAILY_GAMES.every((g) => played[g.id].includes(d)));
  return { date: today, games, done: games.filter((g) => g.done).length, allStreak: playStreak(all, today) };
}
