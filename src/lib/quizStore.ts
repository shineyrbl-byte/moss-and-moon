// Quiz night: staff run it, guests join on their phones, the TV shows the question and the scores.
// Answers stay on the server until a question closes.
import "server-only";
import { db } from "./db";
import { QUESTIONS } from "./trivia";
import { cleanName, points, QUIZ_SIZES } from "./quizNight";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
/** How long each question stays open */
export const qMs = () => Number(process.env.QUIZ_Q_MS) || 20_000;
type Row = { id: number; title: string; questions: string; q_index: number; status: string; q_started: number | null; ended_at: string | null };

/** The quiz on now, or one that finished in the last hour (so everyone can see the final scores) */
function current(): Row | null {
  return (db.prepare(`SELECT * FROM quiz_nights WHERE status != 'done' OR ended_at >= datetime('now', '-1 hour') ORDER BY id DESC LIMIT 1`).get() as Row | undefined) ?? null;
}
/** A question closes by itself when its time is up */
const phaseOf = (q: Row, now: number) => (q.status === "question" && q.q_started !== null && now >= q.q_started + qMs() ? "reveal" : q.status) as "lobby" | "question" | "reveal" | "done";

export function quizState(voter?: unknown, staff = false, now = Date.now()) {
  const q = current();
  if (!q) return { quiz: null };
  const v = cleanVoter(voter), phase = phaseOf(q, now);
  const order = JSON.parse(q.questions) as number[];
  const cur = q.q_index >= 0 && q.q_index < order.length ? QUESTIONS[order[q.q_index]] : null;
  const open = phase === "reveal" || phase === "done";
  const players = (db.prepare("SELECT COUNT(*) AS n FROM quiz_players WHERE quiz_id = ?").get(q.id) as { n: number }).n;
  const top = db.prepare("SELECT name, score FROM quiz_players WHERE quiz_id = ? ORDER BY score DESC, name LIMIT 10").all(q.id) as { name: string; score: number }[];
  const me = v ? ((db.prepare("SELECT name, score FROM quiz_players WHERE quiz_id = ? AND voter = ?").get(q.id, v) as { name: string; score: number } | undefined) ?? null) : null;
  const mine = v && cur ? ((db.prepare("SELECT choice, points FROM quiz_answers WHERE quiz_id = ? AND q_index = ? AND voter = ?").get(q.id, q.q_index, v) as { choice: number; points: number } | undefined) ?? null) : null;
  const counts = cur ? cur.choices.map((_, i) => (db.prepare("SELECT COUNT(*) AS n FROM quiz_answers WHERE quiz_id = ? AND q_index = ? AND choice = ?").get(q.id, q.q_index, i) as { n: number }).n) : [];
  const rank = me ? (db.prepare("SELECT COUNT(*) AS n FROM quiz_players WHERE quiz_id = ? AND score > ?").get(q.id, me.score) as { n: number }).n + 1 : null;
  return {
    quiz: {
      id: q.id, title: q.title, phase, index: q.q_index, total: order.length, players, top,
      endsAt: phase === "question" && q.q_started !== null ? q.q_started + qMs() : null,
      question: cur && phase !== "lobby" ? { q: cur.q, choices: cur.choices, answer: open || staff ? cur.answer : null, why: open ? cur.why : null } : null,
      answered: counts.reduce((a, b) => a + b, 0), counts: open || staff ? counts : null,
      me: me ? { ...me, rank, choice: mine?.choice ?? null, points: open ? (mine?.points ?? 0) : null } : null,
    },
  };
}

/** Staff: { action: "start", title?, size? } | { action: "next" } | { action: "end" } */
export function hostQuiz(b: Record<string, unknown>, now = Date.now()) {
  const q = current(), live = q && q.status !== "done" ? q : null;
  if (b.action === "start") {
    if (live) return { error: "A quiz is already on. End it first." };
    const size = QUIZ_SIZES.includes(Number(b.size) as (typeof QUIZ_SIZES)[number]) ? Number(b.size) : 10;
    const order = [...QUESTIONS.keys()];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const title = (typeof b.title === "string" ? b.title.replace(/[<>]/g, "").trim().slice(0, 60) : "") || "Quiz night";
    db.prepare("INSERT INTO quiz_nights (title, questions) VALUES (?, ?)").run(title, JSON.stringify(order.slice(0, size)));
    return quizState(null, true, now);
  }
  if (!live) return { error: "There's no quiz on right now." };
  if (b.action === "end") {
    db.prepare("UPDATE quiz_nights SET status = 'done', ended_at = datetime('now') WHERE id = ?").run(live.id);
    return quizState(null, true, now);
  }
  if (b.action === "next") {
    const phase = phaseOf(live, now), total = (JSON.parse(live.questions) as number[]).length;
    if (phase === "question") db.prepare("UPDATE quiz_nights SET status = 'reveal' WHERE id = ?").run(live.id); // close it early
    else if (live.q_index + 1 >= total) db.prepare("UPDATE quiz_nights SET status = 'done', ended_at = datetime('now') WHERE id = ?").run(live.id);
    else db.prepare("UPDATE quiz_nights SET status = 'question', q_index = q_index + 1, q_started = ? WHERE id = ?").run(now, live.id);
    return quizState(null, true, now);
  }
  return { error: "What should the quiz do?" };
}

/** Guests: { name, voter } */
export function joinQuiz(b: Record<string, unknown>, now = Date.now()) {
  const q = current(), v = cleanVoter(b.voter), name = cleanName(b.name);
  if (!q || q.status === "done") return { error: "There's no quiz on right now." };
  if (!v) return { error: "Something went wrong. Refresh and try again." };
  if (!name) return { error: "Pick a team name first." };
  const taken = db.prepare("SELECT 1 FROM quiz_players WHERE quiz_id = ? AND lower(name) = lower(?) AND voter != ?").get(q.id, name, v);
  if (taken) return { error: "Another team has that name. Try another." };
  db.prepare("INSERT INTO quiz_players (quiz_id, voter, name) VALUES (?, ?, ?) ON CONFLICT(quiz_id, voter) DO UPDATE SET name = excluded.name").run(q.id, v, name);
  return quizState(v, false, now);
}

/** Guests: { choice, voter } */
export function answerQuiz(b: Record<string, unknown>, now = Date.now()) {
  const q = current(), v = cleanVoter(b.voter);
  if (!q || !v) return { error: "There's no quiz on right now." };
  if (!db.prepare("SELECT 1 FROM quiz_players WHERE quiz_id = ? AND voter = ?").get(q.id, v)) return { error: "Join the quiz first." };
  if (phaseOf(q, now) !== "question") return { error: "Too late, that question has closed." };
  const cur = QUESTIONS[(JSON.parse(q.questions) as number[])[q.q_index]];
  const choice = Number(b.choice);
  if (!Number.isInteger(choice) || choice < 0 || choice >= cur.choices.length) return { error: "Pick an answer." };
  const ms = now - (q.q_started ?? now), got = choice === cur.answer ? points(ms, qMs()) : 0;
  const r = db.prepare("INSERT OR IGNORE INTO quiz_answers (quiz_id, q_index, voter, choice, ms, points) VALUES (?, ?, ?, ?, ?, ?)").run(q.id, q.q_index, v, choice, ms, got);
  if (!r.changes) return { error: "You've already answered this one." };
  if (got) db.prepare("UPDATE quiz_players SET score = score + ? WHERE quiz_id = ? AND voter = ?").run(got, q.id, v);
  return quizState(v, false, now);
}
