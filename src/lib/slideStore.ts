// Slide puzzle: each person's best time today, per size, and the day's board.
import "server-only";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { minMoves, minMs, slideMode } from "./slide";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);

export function slideBoard(modeIn: unknown, voter?: unknown, now = new Date()) {
  const mode = slideMode(modeIn);
  const date = toDateStr(now);
  const top = db.prepare("SELECT name, ms, moves FROM slide_scores WHERE date = ? AND mode = ? ORDER BY ms, moves LIMIT 10").all(date, mode) as { name: string; ms: number; moves: number }[];
  const v = cleanVoter(voter);
  const mine = v ? (db.prepare("SELECT ms, moves FROM slide_scores WHERE date = ? AND mode = ? AND voter = ?").get(date, mode, v) as { ms: number; moves: number } | undefined) ?? null : null;
  return { date, mode, top, mine };
}

/** { mode, ms, moves, name, voter }: keeps your best time today */
export function submitSlide(b: Record<string, unknown>, now = new Date()) {
  const voter = cleanVoter(b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const mode = slideMode(b.mode);
  const ms = Math.round(Number(b.ms)), moves = Math.round(Number(b.moves));
  if (!(ms >= minMs(mode) && ms <= 3 * 3600_000) || !(moves >= minMoves(mode) && moves <= 5000)) return { error: "That score doesn't look right." };
  const name = cleanText(b.name, 20).replace(/[<>]/g, "") || "Guest";
  db.prepare(`INSERT INTO slide_scores (date, voter, mode, name, ms, moves) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, voter, mode) DO UPDATE SET name = excluded.name, ms = excluded.ms, moves = excluded.moves WHERE excluded.ms < slide_scores.ms`)
    .run(toDateStr(now), voter, mode, name, ms, moves);
  return slideBoard(mode, voter, now);
}
