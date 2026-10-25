// Crack the order: the secret order stays on the server, so the page only ever sees the marks.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { seededRand, playStreak } from "./gameOrders";
import { CODE_LEN, CRACK_TRIES, DRINKS, crackGrid, feedback, validGuess } from "./crack";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const voterFor = (customerId: number | null, v: unknown) => (customerId ? `c${customerId}` : cleanVoter(v));

/** Today's order (repeats allowed, like the real game) */
export function codeFor(date: string) {
  const rand = seededRand(`crack:${date}:${process.env.CRACK_SALT ?? "moss-moon"}`);
  return [...Array(CODE_LEN)].map(() => Math.floor(rand() * DRINKS.length));
}

export function crackToday(customerId: number | null, v: unknown, now = new Date()) {
  const date = toDateStr(now), voter = voterFor(customerId, v), code = codeFor(date);
  const row = voter ? (db.prepare("SELECT guesses, done, won FROM crack_games WHERE date = ? AND voter = ?").get(date, voter) as { guesses: string; done: number; won: number } | undefined) : undefined;
  const guesses = (row ? (JSON.parse(row.guesses) as number[][]) : []).map((g) => ({ guess: g, ...feedback(code, g) }));
  const done = !!row?.done;
  const stats = db.prepare("SELECT COUNT(*) AS played, COALESCE(SUM(won), 0) AS won FROM crack_games WHERE date = ? AND done = 1").get(date) as { played: number; won: number };
  const days = voter ? (db.prepare("SELECT date FROM crack_games WHERE voter = ? AND won = 1").all(voter) as { date: string }[]).map((r) => r.date) : [];
  return {
    date, guesses, done, won: !!row?.won, triesLeft: CRACK_TRIES - guesses.length,
    code: done ? code : null, grid: done ? crackGrid(guesses) : null,
    today: stats, streak: playStreak(days, date),
  };
}

/** { guess: [4 drink numbers], voter } */
export function guessCrack(customerId: number | null, b: Record<string, unknown>, now = new Date()) {
  const voter = voterFor(customerId, b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  if (!validGuess(b.guess)) return { error: `Pick ${CODE_LEN} drinks first.` };
  const date = toDateStr(now), code = codeFor(date);
  const row = db.prepare("SELECT guesses, done FROM crack_games WHERE date = ? AND voter = ?").get(date, voter) as { guesses: string; done: number } | undefined;
  if (row?.done) return { error: "You've played today's order. A new one tomorrow." };
  const guesses = [...(row ? (JSON.parse(row.guesses) as number[][]) : []), b.guess];
  const won = feedback(code, b.guess).right === CODE_LEN, done = won || guesses.length >= CRACK_TRIES;
  db.prepare(`INSERT INTO crack_games (date, voter, guesses, done, won) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date, voter) DO UPDATE SET guesses = excluded.guesses, done = excluded.done, won = excluded.won`).run(date, voter, JSON.stringify(guesses), done ? 1 : 0, won ? 1 : 0);
  return crackToday(customerId, b.voter, now);
}
