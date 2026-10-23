// The daily café word: guesses are checked here, so the answer never reaches the page early.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { ANSWERS, TRIES, score, wordFor } from "./wordGame";
import { WORDS5 } from "./data/words5";
import { playStreak } from "./gameOrders";
import { bestRun } from "./trivia";

let allowed: Set<string> | null = null;
const isWord = (w: string) => (allowed ??= new Set([...WORDS5.split(" "), ...ANSWERS])).has(w);

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const voterFor = (customerId: number | null, v: unknown) => (customerId ? `c${customerId}` : cleanVoter(v));

type Row = { guesses: string; solved: number; done: number };

export function wordToday(customerId: number | null, v: unknown, now = new Date()) {
  const date = toDateStr(now);
  const answer = wordFor(date);
  const voter = voterFor(customerId, v);
  const row = voter ? (db.prepare("SELECT guesses, solved, done FROM word_games WHERE date = ? AND voter = ?").get(date, voter) as Row | undefined) : undefined;
  const guesses = row ? (JSON.parse(row.guesses) as string[]) : [];
  const wins = voter ? (db.prepare("SELECT date FROM word_games WHERE voter = ? AND solved = 1").all(voter) as { date: string }[]).map((r) => r.date) : [];
  const all = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(solved), 0) AS s FROM word_games WHERE date = ? AND done = 1").get(date) as { n: number; s: number };
  return {
    date, tries: TRIES,
    rows: guesses.map((g) => ({ word: g, marks: score(g, answer) })),
    solved: !!row?.solved, done: !!row?.done,
    ...(row?.done ? { answer } : {}),
    streak: playStreak(wins, date), best: bestRun(wins), played: all.n, solvedToday: all.s,
  };
}

export function guessWord(customerId: number | null, b: Record<string, unknown>, now = new Date()) {
  const voter = voterFor(customerId, b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const guess = String(b.guess ?? "").trim().toLowerCase();
  if (!/^[a-z]{5}$/.test(guess)) return { error: "Five letters, please." };
  if (!isWord(guess)) return { error: "Not in our word list." };
  const date = toDateStr(now);
  const row = db.prepare("SELECT guesses, solved, done FROM word_games WHERE date = ? AND voter = ?").get(date, voter) as Row | undefined;
  if (row?.done) return wordToday(customerId, b.voter, now);
  const guesses = [...(row ? (JSON.parse(row.guesses) as string[]) : []), guess];
  const solved = guess === wordFor(date);
  const done = solved || guesses.length >= TRIES;
  db.prepare("INSERT INTO word_games (date, voter, customer_id, guesses, solved, done) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(date, voter) DO UPDATE SET guesses = excluded.guesses, solved = excluded.solved, done = excluded.done")
    .run(date, voter, customerId, JSON.stringify(guesses), solved ? 1 : 0, done ? 1 : 0);
  return wordToday(customerId, b.voter, now);
}
