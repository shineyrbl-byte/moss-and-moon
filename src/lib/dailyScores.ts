// Best times for the daily puzzles (word search, sudoku, crossword, pixel pictures, bean sweeper and the rest): each person's best today, and the day's board.
import "server-only";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { minMs as wsMin } from "./wordSearch";
import { minMs as sudokuMin, sudokuMode } from "./sudoku";
import { minMs as xwMin } from "./crossword";
import { minMs as nonoMin, nonoMode } from "./nonogram";
import { minMs as sweepMin, sweepMode } from "./sweeper";
import { minMs as ladderMin } from "./wordLadder";
import { minMs as jigMin, jigsawMode } from "./jigsaw";
import { minMs as pathsMin, pathMode } from "./pourPaths";
import { minMs as tilesMin } from "./teaTiles";
import { minMs as spotMin } from "./spotDiff";
import { minMs as cipherMin } from "./cryptogram";
import { minMs as lampsMin } from "./lamps";
import { MAX_MOVES, MIN_MOVES, packScore } from "./flood";
import { minMs as jumbleMin } from "./jumble";
import { minMs as milkMin } from "./binairo";
import { minMs as lightsMin } from "./bridges";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const GAMES = {
  wordsearch: { mode: () => "daily", min: () => wsMin },
  sudoku: { mode: (v: unknown) => sudokuMode(v), min: (m: string) => sudokuMin(sudokuMode(m)) },
  crossword: { mode: () => "daily", min: () => xwMin },
  nonogram: { mode: (v: unknown) => nonoMode(v), min: (m: string) => nonoMin(nonoMode(m)) },
  sweeper: { mode: (v: unknown) => sweepMode(v), min: (m: string) => sweepMin(sweepMode(m)) },
  ladder: { mode: () => "daily", min: () => ladderMin },
  jigsaw: { mode: (v: unknown) => jigsawMode(v), min: (m: string) => jigMin(jigsawMode(m)) },
  paths: { mode: (v: unknown) => pathMode(v), min: (m: string) => pathsMin(pathMode(m)) },
  tiles: { mode: () => "daily", min: () => tilesMin },
  spot: { mode: () => "daily", min: () => spotMin },
  cipher: { mode: () => "daily", min: () => cipherMin },
  lamps: { mode: () => "daily", min: () => lampsMin },
  jumble: { mode: () => "daily", min: () => jumbleMin },
  milk: { mode: () => "daily", min: () => milkMin },
  lights: { mode: () => "daily", min: () => lightsMin },
  // Flood keeps moves and time packed into one number (see packScore), so fewest moves wins
  flood: { mode: () => "daily", min: () => packScore(MIN_MOVES, 2000), max: packScore(MAX_MOVES, 999_999) },
} as const;
export type DailyGame = keyof typeof GAMES;
export const isDailyGame = (g: unknown): g is DailyGame => typeof g === "string" && g in GAMES;

export function dailyBoard(game: DailyGame, modeIn: unknown, voter?: unknown, now = new Date()) {
  const mode = GAMES[game].mode(modeIn), date = toDateStr(now);
  const top = db.prepare("SELECT name, ms FROM daily_scores WHERE game = ? AND date = ? AND mode = ? ORDER BY ms LIMIT 10").all(game, date, mode) as { name: string; ms: number }[];
  const v = cleanVoter(voter);
  const mine = v ? (db.prepare("SELECT ms FROM daily_scores WHERE game = ? AND date = ? AND mode = ? AND voter = ?").get(game, date, mode, v) as { ms: number } | undefined) ?? null : null;
  const played = (db.prepare("SELECT COUNT(*) AS n FROM daily_scores WHERE game = ? AND date = ? AND mode = ?").get(game, date, mode) as { n: number }).n;
  return { date, mode, top, mine, played };
}

/** { mode, ms, name, voter }: keeps your best time today */
export function submitDaily(game: DailyGame, b: Record<string, unknown>, now = new Date()) {
  const voter = cleanVoter(b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const mode = GAMES[game].mode(b.mode);
  const ms = Math.round(Number(b.ms));
  const g = GAMES[game] as { max?: number };
  if (!(ms >= GAMES[game].min(mode) && ms <= (g.max ?? 3 * 3600_000))) return { error: "That time doesn't look right." };
  const name = cleanText(b.name, 20).replace(/[<>]/g, "") || "Guest";
  db.prepare(`INSERT INTO daily_scores (game, date, voter, mode, name, ms) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(game, date, voter, mode) DO UPDATE SET name = excluded.name, ms = excluded.ms WHERE excluded.ms < daily_scores.ms`)
    .run(game, toDateStr(now), voter, mode, name, ms);
  return dailyBoard(game, mode, voter, now);
}
