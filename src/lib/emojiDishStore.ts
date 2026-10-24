// Guess the dish: guesses are checked here, so the answers never reach the page early.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { getMenu } from "./menuStore";
import { CATEGORIES } from "./menu";
import { dishesFor, dishGrid, isRight, TRIES } from "./emojiDish";
import { playStreak } from "./gameOrders";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const voterFor = (customerId: number | null, v: unknown) => (customerId ? `c${customerId}` : cleanVoter(v));

function today(now: Date) {
  const date = toDateStr(now);
  const menu = new Map(getMenu().map((m) => [m.id, m]));
  return { date, menu, puzzles: dishesFor(date, new Set(menu.keys())) };
}

export function dishToday(customerId: number | null, v: unknown, now = new Date()) {
  const { date, menu, puzzles } = today(now);
  const voter = voterFor(customerId, v);
  const row = voter ? (db.prepare("SELECT guesses, done FROM dish_games WHERE date = ? AND voter = ?").get(date, voter) as { guesses: string; done: number } | undefined) : undefined;
  const guesses = row ? (JSON.parse(row.guesses) as string[][]) : [];
  const results = puzzles.map((p, i) => {
    const m = menu.get(p.id)!;
    const tries = guesses[i] ?? [];
    const ok = tries.some((g) => isRight(g, m.name, p.also));
    const over = ok || tries.length >= TRIES;
    const wrong = tries.length - (ok ? 1 : 0);
    return {
      emoji: p.emoji, tries, ok, over,
      ...(over ? { answer: m.name, id: m.id, price: m.price } : {}),
      hints: [
        ...(wrong >= 1 ? [`It's on the ${CATEGORIES.find((c) => c.id === m.cat)?.label.toLowerCase() ?? m.cat} menu`] : []),
        ...(wrong >= 2 ? [`${m.name.split(" ").map((w) => w[0] + "·".repeat(Math.max(0, w.length - 1))).join(" ")}`] : []),
      ],
    };
  });
  const done = results.every((r) => r.over);
  const days = voter ? (db.prepare("SELECT date FROM dish_games WHERE voter = ? AND score > 0").all(voter) as { date: string }[]).map((r) => r.date) : [];
  return {
    date, tries: TRIES, puzzles: results, done, score: results.filter((r) => r.ok).length,
    ...(done ? { grid: dishGrid(results.map((r) => ({ ok: r.ok, n: r.tries.length }))) } : {}),
    streak: playStreak(days, date),
  };
}

/** { i: which puzzle (0 to 4), guess, voter? } */
export function guessDish(customerId: number | null, b: Record<string, unknown>, now = new Date()) {
  const voter = voterFor(customerId, b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const { date, menu, puzzles } = today(now);
  const i = Math.floor(Number(b.i));
  const guess = String(b.guess ?? "").trim().slice(0, 60);
  if (!(i >= 0 && i < puzzles.length)) return { error: "Which one?" };
  if (guess.length < 3) return { error: "Type the dish's name." };
  const row = db.prepare("SELECT guesses FROM dish_games WHERE date = ? AND voter = ?").get(date, voter) as { guesses: string } | undefined;
  const guesses = row ? (JSON.parse(row.guesses) as string[][]) : [];
  while (guesses.length < puzzles.length) guesses.push([]);
  const p = puzzles[i], m = menu.get(p.id)!;
  if (guesses[i].some((g) => isRight(g, m.name, p.also)) || guesses[i].length >= TRIES) return dishToday(customerId, b.voter, now);
  guesses[i].push(guess);
  const score = puzzles.filter((q, k) => guesses[k].some((g) => isRight(g, menu.get(q.id)!.name, q.also))).length;
  const done = puzzles.every((q, k) => guesses[k].length >= TRIES || guesses[k].some((g) => isRight(g, menu.get(q.id)!.name, q.also)));
  db.prepare("INSERT INTO dish_games (date, voter, guesses, done, score) VALUES (?, ?, ?, ?, ?) ON CONFLICT(date, voter) DO UPDATE SET guesses = excluded.guesses, done = excluded.done, score = excluded.score")
    .run(date, voter, JSON.stringify(guesses), done ? 1 : 0, score);
  return dishToday(customerId, b.voter, now);
}
