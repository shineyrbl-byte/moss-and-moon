// The weekly poll: results only after you vote, one vote a person.
import "server-only";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { ideaFor, weekOf } from "./polls";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const voterFor = (customerId: number | null, v: unknown) => (customerId ? `c${customerId}` : cleanVoter(v));

function pollFor(week: string) {
  const r = db.prepare("SELECT question, choices FROM polls WHERE week = ?").get(week) as { question: string; choices: string } | undefined;
  return r ? { q: r.question, choices: JSON.parse(r.choices) as string[], custom: true } : { ...ideaFor(week), custom: false };
}

export function pollNow(customerId: number | null, v: unknown, now = new Date(), staff = false) {
  const week = weekOf(toDateStr(now));
  const p = pollFor(week);
  const voter = voterFor(customerId, v);
  const mine = voter ? (db.prepare("SELECT choice FROM poll_votes WHERE week = ? AND voter = ?").get(week, voter) as { choice: number } | undefined)?.choice ?? null : null;
  const counts = p.choices.map(() => 0);
  for (const r of db.prepare("SELECT choice, COUNT(*) AS n FROM poll_votes WHERE week = ? GROUP BY choice").all(week) as { choice: number; n: number }[]) if (r.choice < counts.length) counts[r.choice] = r.n;
  const total = counts.reduce((s, n) => s + n, 0);
  const last = pollFor(weekOf(toDateStr(new Date(now.getTime() - 7 * 86400_000))));
  const lastWeek = weekOf(toDateStr(new Date(now.getTime() - 7 * 86400_000)));
  const lastCounts = last.choices.map((_, i) => (db.prepare("SELECT COUNT(*) AS n FROM poll_votes WHERE week = ? AND choice = ?").get(lastWeek, i) as { n: number }).n);
  const lastTotal = lastCounts.reduce((s, n) => s + n, 0);
  const winner = lastTotal ? last.choices[lastCounts.indexOf(Math.max(...lastCounts))] : null;
  return {
    week, q: p.q, choices: p.choices, mine, total,
    ...(mine !== null || staff ? { counts } : {}),
    ...(staff ? { custom: p.custom } : {}),
    last: winner ? { q: last.q, winner, total: lastTotal } : null,
  };
}

export function votePoll(customerId: number | null, b: Record<string, unknown>, now = new Date()) {
  const voter = voterFor(customerId, b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const week = weekOf(toDateStr(now));
  const choice = Math.floor(Number(b.choice));
  if (!(choice >= 0 && choice < pollFor(week).choices.length)) return { error: "Pick one of the answers." };
  db.prepare("INSERT OR IGNORE INTO poll_votes (week, voter, choice) VALUES (?, ?, ?)").run(week, voter, choice);
  return pollNow(customerId, b.voter, now);
}

/** Staff: set this week's question (only before anyone has voted) */
export function setPoll(b: Record<string, unknown>, now = new Date()) {
  const week = weekOf(toDateStr(now));
  const q = cleanText(b.q, 100).replace(/[<>]/g, "");
  const choices = (Array.isArray(b.choices) ? b.choices : []).map((c) => cleanText(c, 40).replace(/[<>]/g, "")).filter(Boolean).slice(0, 5);
  if (!q) return { error: "Write a question." };
  if (choices.length < 2 || new Set(choices).size !== choices.length) return { error: "Give 2 to 5 different answers." };
  if ((db.prepare("SELECT COUNT(*) AS n FROM poll_votes WHERE week = ?").get(week) as { n: number }).n) return { error: "People have already voted this week. Set the next one on Monday." };
  db.prepare("INSERT INTO polls (week, question, choices) VALUES (?, ?, ?) ON CONFLICT(week) DO UPDATE SET question = excluded.question, choices = excluded.choices").run(week, q, JSON.stringify(choices));
  return pollNow(null, null, now, true);
}
