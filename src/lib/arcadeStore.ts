// Weekly high scores for the arcade games (higher or lower, brew merge, bean snake, call the order). Each person keeps their best this week.
import "server-only";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { weekOf } from "./polls";
import { HL_MAX } from "./higherLower";
import { MAX_SCORE } from "./merge";
import { SNAKE_MAX } from "./snake";
import { TYPING_MAX } from "./callOrder";
import { STACKER_MAX } from "./stacker";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const GAMES = { higherlower: HL_MAX, merge: MAX_SCORE, snake: SNAKE_MAX, typing: TYPING_MAX, stacker: STACKER_MAX } as const;
export type ArcadeGame = keyof typeof GAMES;
export const isArcadeGame = (g: unknown): g is ArcadeGame => typeof g === "string" && g in GAMES;

export function arcadeBoard(game: ArcadeGame, voter?: unknown, now = new Date()) {
  const week = weekOf(toDateStr(now)), v = cleanVoter(voter);
  const top = db.prepare("SELECT name, score FROM arcade_scores WHERE game = ? AND week = ? ORDER BY score DESC, at LIMIT 10").all(game, week) as { name: string; score: number }[];
  const mine = v ? ((db.prepare("SELECT score FROM arcade_scores WHERE game = ? AND week = ? AND voter = ?").get(game, week, v) as { score: number } | undefined)?.score ?? null) : null;
  const best = v ? ((db.prepare("SELECT MAX(score) AS s FROM arcade_scores WHERE game = ? AND voter = ?").get(game, v) as { s: number | null }).s) : null;
  return { week, top, mine, best };
}

/** { game, score, name, voter }: keeps your best this week */
export function submitArcade(game: ArcadeGame, b: Record<string, unknown>, now = new Date()) {
  const voter = cleanVoter(b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const score = Number(b.score);
  if (!Number.isInteger(score) || score < 1 || score > GAMES[game] || (game === "merge" && score % 4 !== 0)) return { error: "That score doesn't look right." };
  const name = cleanText(b.name, 20).replace(/[<>]/g, "") || "Guest";
  db.prepare(`INSERT INTO arcade_scores (game, week, voter, name, score) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(game, week, voter) DO UPDATE SET name = excluded.name, score = excluded.score, at = datetime('now') WHERE excluded.score > arcade_scores.score`)
    .run(game, weekOf(toDateStr(now)), voter, name, score);
  return arcadeBoard(game, voter, now);
}
