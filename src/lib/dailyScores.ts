// Best times for the daily puzzles (word search, sudoku, crossword, pixel pictures, bean sweeper and the rest): each person's best today, and the day's board.
import "server-only";
import { isChecked, verify } from "./proofs";
import { getMenu } from "./menuStore";
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
import { minMs as tableMin, minMsHard as tableMinHard } from "./queens";
import { minMs as parasolsMin } from "./tents";
import { minMs as tipjarMin, minMsHard as tipjarMinHard } from "./kenken";
import { minMs as towersMin } from "./skyscrapers";
import { minMs as cupsMin } from "./hitori";
import { minMs as sumsMin } from "./kakuro";
import { minMs as freecellMin } from "./freecell";
import { MIN_BOARD as boggleMin, MAX_BOARD as boggleMax } from "./boggle";
import { MIN_SCORE as billMin, MAX_SCORE as billMax } from "./billTotal";
import { minMs as tallerMin } from "./futoshiki";
import { minMs as traytilesMin } from "./shikaku";
import { minMs as seatsMin } from "./akari";
import { minMs as threadsMin } from "./threads";
import { minMs as gardenMin } from "./nurikabe";
import { minMs as ropeMin } from "./slitherlink";
import { minMs as necklaceMin } from "./masyu";
import { minMs as trailMin } from "./hidato";
import { minMs as pipesMin } from "./pipes";
import { minMs as cuttersMin } from "./cutters";
import { minMs as crypticMin } from "./cryptic";
import { minMs as starsMin } from "./starBattle";
import { MIN_SCORE as wheelMin, MAX_SCORE as wheelMax } from "./wordWheel";
import { minMs as codewordMin } from "./codeword";
import { minMs as zipMin } from "./zipPath";
import { minMs as bikesMin } from "./bikes";
import { MIN_SCORE as pushMin, MAX_SCORE as pushMax } from "./beanPush";
import { MIN_SCORE as priceMin, MAX_SCORE as priceMax } from "./priceOrder";
import { minMs as cagesMin } from "./killerSudoku";
import { MIN_SCORE as chainMin, MAX_SCORE as chainMax } from "./wordChain";
import { minMs as colourMin } from "./colourPixels";
import { MIN_SCORE as fourMin, MAX_SCORE as fourMax } from "./quordle";
import { MIN_SCORE as cornersMin, MAX_SCORE as cornersMax } from "./letterBoxed";

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
  milk: { mode: (v: unknown) => (v === "easy" ? "easy" : "daily"), min: (m: string) => (m === "easy" ? 3000 : milkMin) },
  lights: { mode: () => "daily", min: () => lightsMin },
  // Levels: "daily" is the usual grid, plus a hard (bigger) one for Table for one and Tip jar, and an easy one for Milk & coffee
  table: { mode: (v: unknown) => (v === "hard" ? "hard" : "daily"), min: (m: string) => (m === "hard" ? tableMinHard : tableMin) },
  parasols: { mode: () => "daily", min: () => parasolsMin },
  tipjar: { mode: (v: unknown) => (v === "hard" ? "hard" : "daily"), min: (m: string) => (m === "hard" ? tipjarMinHard : tipjarMin) },
  towers: { mode: () => "daily", min: () => towersMin },
  cups: { mode: () => "daily", min: () => cupsMin },
  sums: { mode: () => "daily", min: () => sumsMin },
  freecell: { mode: () => "daily", min: () => freecellMin },
  // Bean boggle stores "1,000,000 minus points", so the lowest-first board puts the top score first
  boggle: { mode: () => "daily", min: () => boggleMin, max: boggleMax },
  // Bill total packs how far off and the time together, so closest wins
  bill: { mode: () => "daily", min: () => billMin, max: billMax },
  taller: { mode: () => "daily", min: () => tallerMin },
  traytiles: { mode: () => "daily", min: () => traytilesMin },
  seats: { mode: () => "daily", min: () => seatsMin },
  threads: { mode: () => "daily", min: () => threadsMin },
  garden: { mode: () => "daily", min: () => gardenMin },
  rope: { mode: () => "daily", min: () => ropeMin },
  necklace: { mode: () => "daily", min: () => necklaceMin },
  trail: { mode: () => "daily", min: () => trailMin },
  pipes: { mode: () => "daily", min: () => pipesMin },
  cutters: { mode: () => "daily", min: () => cuttersMin },
  cryptic: { mode: () => "daily", min: () => crypticMin },
  stars: { mode: () => "daily", min: () => starsMin },
  // Word wheel packs words found (more is better), Bean push packs moves, Price order packs goes, each with the time
  wheel: { mode: () => "daily", min: () => wheelMin, max: wheelMax },
  codeword: { mode: () => "daily", min: () => codewordMin },
  zip: { mode: () => "daily", min: () => zipMin },
  bikes: { mode: () => "daily", min: () => bikesMin },
  push: { mode: () => "daily", min: () => pushMin, max: pushMax },
  price: { mode: () => "daily", min: () => priceMin, max: priceMax },
  cages: { mode: () => "daily", min: () => cagesMin },
  // Word chain packs words (more is better) and letters
  chain: { mode: () => "daily", min: () => chainMin, max: chainMax },
  colour: { mode: () => "daily", min: () => colourMin },
  // Four at once packs tries and time together, so fewest tries wins
  four: { mode: () => "daily", min: () => fourMin, max: fourMax },
  // Café corners packs words and time into one number (see letterBoxed pack), so fewest words wins
  corners: { mode: () => "daily", min: () => cornersMin, max: cornersMax },
  // Flood keeps moves and time packed into one number (see packScore), so fewest moves wins
  flood: { mode: () => "daily", min: () => packScore(MIN_MOVES, 2000), max: packScore(MAX_MOVES, 999_999) },
} as const;
export type DailyGame = keyof typeof GAMES;
/** The level a board shows when none is picked */
export const defaultMode = (game: DailyGame) => GAMES[game].mode(undefined);
export const isDailyGame = (g: unknown): g is DailyGame => typeof g === "string" && g in GAMES;

export function dailyBoard(game: DailyGame, modeIn: unknown, voter?: unknown, now = new Date()) {
  const mode = GAMES[game].mode(modeIn), date = toDateStr(now);
  const top = db.prepare("SELECT name, ms FROM daily_scores WHERE game = ? AND date = ? AND mode = ? ORDER BY ms LIMIT 10").all(game, date, mode) as { name: string; ms: number }[];
  const v = cleanVoter(voter);
  const mine = v ? (db.prepare("SELECT ms FROM daily_scores WHERE game = ? AND date = ? AND mode = ? AND voter = ?").get(game, date, mode, v) as { ms: number } | undefined) ?? null : null;
  const played = (db.prepare("SELECT COUNT(*) AS n FROM daily_scores WHERE game = ? AND date = ? AND mode = ?").get(game, date, mode) as { n: number }).n;
  // How hard is today? The middle score today, against the middle of the last fortnight's
  const med = (list: { ms: number }[]) => (list.length ? [...list].sort((a, b) => a.ms - b.ms)[Math.floor(list.length / 2)].ms : null);
  const todayAll = db.prepare("SELECT ms FROM daily_scores WHERE game = ? AND date = ? AND mode = ?").all(game, date, mode) as { ms: number }[];
  const from = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14));
  const before = db.prepare("SELECT ms FROM daily_scores WHERE game = ? AND date >= ? AND date < ? AND mode = ?").all(game, from, date, mode) as { ms: number }[];
  return { date, mode, top, mine, played, median: med(todayAll), usual: before.length >= 5 ? med(before) : null };
}

/** { mode, ms, name, voter }: keeps your best time today */
export function submitDaily(game: DailyGame, b: Record<string, unknown>, now = new Date()) {
  const voter = cleanVoter(b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const mode = GAMES[game].mode(b.mode);
  const ms = Math.round(Number(b.ms));
  const g = GAMES[game] as { max?: number };
  if (!(ms >= GAMES[game].min(mode) && ms <= (g.max ?? 3 * 3600_000))) return { error: "That time doesn't look right." };
  // Puzzles the server can check need the finished board too
  if (isChecked(game) && !verify(game, mode, toDateStr(now), b.proof, ms, () => getMenu({}).filter((m) => m.cat !== "shop" && !(m as { pup?: boolean }).pup && m.price > 0).map((m) => ({ id: m.id, name: m.name, price: m.price, img: m.img }))))
    return { error: "That doesn't look like today's finished puzzle. Refresh and try again." };
  const name = cleanText(b.name, 20).replace(/[<>]/g, "") || "Guest";
  db.prepare(`INSERT INTO daily_scores (game, date, voter, mode, name, ms) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(game, date, voter, mode) DO UPDATE SET name = excluded.name, ms = excluded.ms WHERE excluded.ms < daily_scores.ms`)
    .run(game, toDateStr(now), voter, mode, name, ms);
  return dailyBoard(game, mode, voter, now);
}
