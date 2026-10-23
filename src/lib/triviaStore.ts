// Daily trivia answers: one per person per day (signed in, or a random id kept in the browser).
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { bestRun, questionFor } from "./trivia";
import { playStreak } from "./gameOrders";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const voterFor = (customerId: number | null, v: unknown) => (customerId ? `c${customerId}` : cleanVoter(v));

function stats(voter: string | null, date: string) {
  const all = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(correct), 0) AS r FROM trivia_answers WHERE date = ?").get(date) as { n: number; r: number };
  const days = voter ? (db.prepare("SELECT date FROM trivia_answers WHERE voter = ?").all(voter) as { date: string }[]).map((x) => x.date) : [];
  return { answered: all.n, right: all.r, streak: playStreak(days, date), best: bestRun(days) };
}

export function triviaToday(customerId: number | null, v: unknown, now = new Date()) {
  const date = toDateStr(now);
  const q = questionFor(date);
  const voter = voterFor(customerId, v);
  const mine = voter ? (db.prepare("SELECT choice, correct FROM trivia_answers WHERE date = ? AND voter = ?").get(date, voter) as { choice: number; correct: number } | undefined) : undefined;
  return {
    date, q: q.q, choices: q.choices,
    ...(mine ? { mine: { choice: mine.choice, correct: !!mine.correct, answer: q.answer, why: q.why } } : {}),
    ...stats(voter, date),
  };
}

export function answerTrivia(customerId: number | null, b: Record<string, unknown>, now = new Date()) {
  const voter = voterFor(customerId, b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const date = toDateStr(now);
  const q = questionFor(date);
  const choice = Math.floor(Number(b.choice));
  if (!(choice >= 0 && choice < q.choices.length)) return { error: "Pick one of the answers." };
  // Your first answer is the one that counts
  db.prepare("INSERT OR IGNORE INTO trivia_answers (date, voter, customer_id, choice, correct) VALUES (?, ?, ?, ?, ?)").run(date, voter, customerId, choice, choice === q.answer ? 1 : 0);
  return triviaToday(customerId, b.voter, now);
}

/** For badges: the best run of days a signed-in guest answered */
export const triviaBest = (customerId: number) => bestRun((db.prepare("SELECT date FROM trivia_answers WHERE customer_id = ?").all(customerId) as { date: string }[]).map((x) => x.date));
