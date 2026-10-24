// Café connections: guesses are checked here, so a group's name and words only reach the page once found.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { checkGuess, connectionsGrid, MISTAKES, puzzleFor, tilesFor } from "./connections";
import { playStreak } from "./gameOrders";
import { bestRun } from "./trivia";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const voterFor = (customerId: number | null, v: unknown) => (customerId ? `c${customerId}` : cleanVoter(v));

export function connectionsToday(customerId: number | null, v: unknown, now = new Date(), away?: number) {
  const date = toDateStr(now);
  const p = puzzleFor(date);
  const voter = voterFor(customerId, v);
  const row = voter ? (db.prepare("SELECT guesses, solved, done FROM connections_games WHERE date = ? AND voter = ?").get(date, voter) as { guesses: string; solved: number; done: number } | undefined) : undefined;
  const guesses = row ? (JSON.parse(row.guesses) as string[][]) : [];
  const results = guesses.map((g) => checkGuess(p, g).level);
  const found = results.filter((l): l is number => l !== null);
  const mistakes = results.filter((l) => l === null).length;
  const done = !!row?.done;
  // Found groups in the order found; when it's over, the rest are shown too
  const shown = done ? [...found, ...[0, 1, 2, 3].filter((l) => !found.includes(l))] : found;
  const wins = voter ? (db.prepare("SELECT date FROM connections_games WHERE voter = ? AND solved = 1").all(voter) as { date: string }[]).map((r) => r.date) : [];
  const all = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(solved), 0) AS s FROM connections_games WHERE date = ? AND done = 1").get(date) as { n: number; s: number };
  const taken = new Set(shown.flatMap((l) => p[l].words));
  return {
    date, mistakesAllowed: MISTAKES, mistakes, done, solved: !!row?.solved,
    groups: shown.map((l) => ({ level: l, name: p[l].name, words: p[l].words, found: found.includes(l) })),
    tiles: tilesFor(date).filter((w) => !taken.has(w)),
    tried: guesses.map((g) => [...g].sort().join(" ")),
    ...(done ? { grid: connectionsGrid(p, guesses) } : {}),
    ...(away !== undefined ? { away } : {}),
    streak: playStreak(wins, date), best: bestRun(wins), played: all.n, solvedToday: all.s,
  };
}

/** { words: four of today's tiles, voter? } */
export function guessConnections(customerId: number | null, b: Record<string, unknown>, now = new Date()) {
  const voter = voterFor(customerId, b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const date = toDateStr(now);
  const p = puzzleFor(date);
  const words = Array.isArray(b.words) ? [...new Set(b.words.map((w) => String(w).toUpperCase()))] : [];
  const tiles = new Set(tilesFor(date));
  if (words.length !== 4 || !words.every((w) => tiles.has(w))) return { error: "Pick four words from today's board." };
  const row = db.prepare("SELECT guesses, done FROM connections_games WHERE date = ? AND voter = ?").get(date, voter) as { guesses: string; done: number } | undefined;
  if (row?.done) return connectionsToday(customerId, b.voter, now);
  const guesses = row ? (JSON.parse(row.guesses) as string[][]) : [];
  const key = [...words].sort().join(" ");
  if (guesses.some((g) => [...g].sort().join(" ") === key)) return { error: "You've already tried those four." };
  const foundWords = new Set(guesses.flatMap((g) => { const l = checkGuess(p, g).level; return l === null ? [] : p[l].words; }));
  if (words.some((w) => foundWords.has(w))) return { error: "One of those is already in a group." };
  const next = [...guesses, words];
  const res = next.map((g) => checkGuess(p, g).level);
  const solved = res.filter((l) => l !== null).length === 4;
  const done = solved || res.filter((l) => l === null).length >= MISTAKES;
  db.prepare("INSERT INTO connections_games (date, voter, guesses, solved, done) VALUES (?, ?, ?, ?, ?) ON CONFLICT(date, voter) DO UPDATE SET guesses = excluded.guesses, solved = excluded.solved, done = excluded.done")
    .run(date, voter, JSON.stringify(next), solved ? 1 : 0, done ? 1 : 0);
  return connectionsToday(customerId, b.voter, now, checkGuess(p, words).away);
}
