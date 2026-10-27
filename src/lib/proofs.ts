// Server checks for the daily boards: with a score comes the finished board (or the moves), and the server rebuilds
// today's puzzle with the same code to check it really is solved. It stops anyone posting a made-up time without
// solving. (The puzzles are built in the browser, so it can't stop someone who works the answer out from the code.)
import { sudokuFor, isComplete, sudokuMode } from "./sudoku.ts";
import { crosswordFor, isSolved as xwSolved } from "./crossword.ts";
import { trailFor, isSolved as trailSolved } from "./hidato.ts";
import { starsFor, isSolved as starsSolved, type Mark as StarMark } from "./starBattle.ts";
import { seatsFor, isSolved as seatsSolved } from "./akari.ts";
import { gardenFor, isSolved as gardenSolved } from "./nurikabe.ts";
import { zipFor, isSolved as zipSolved } from "./zipPath.ts";
import { bikesFor, isSolved as bikesSolved, type Mark as BikeMark } from "./bikes.ts";
import { codewordFor, isSolved as codeSolved } from "./codeword.ts";
import { pipesFor, isSolved as pipesSolved } from "./pipes.ts";
import { cuttersFor, isSolved as cuttersSolved, type Placed } from "./cutters.ts";
import { levelFor, move as pushMove, start as pushStart, isSolved as pushSolved, type Dir } from "./beanPush.ts";
import { wheelFor, MAX_MAIN } from "./wordWheel.ts";
import { priceFor, isRight as priceRight, type PItem } from "./priceOrder.ts";

/** The puzzles the server checks */
export const CHECKED = ["sudoku", "crossword", "trail", "stars", "seats", "garden", "zip", "bikes", "codeword", "pipes", "cutters", "push", "wheel", "price"] as const;
export const isChecked = (g: string) => (CHECKED as readonly string[]).includes(g);

// Some puzzles take a moment to build, so keep the day's copy
const cache = new Map<string, unknown>();
function once<T>(key: string, make: () => T): T {
  if (!cache.has(key)) { if (cache.size > 200) cache.clear(); cache.set(key, make()); }
  return cache.get(key) as T;
}
const arr = (x: unknown): x is unknown[] => Array.isArray(x) && x.length < 2000;
const nums = (x: unknown): x is number[] => arr(x) && x.every((v) => typeof v === "number");

/** Is `proof` a solved copy of today's puzzle for this game (and does it match the packed score)? */
export function verify(game: string, mode: string, date: string, proof: unknown, score: number, menu: () => PItem[] = () => []): boolean {
  try {
    switch (game) {
      case "sudoku": { if (!nums(proof)) return false; const p = once(`sd:${date}:${mode}`, () => sudokuFor(date, sudokuMode(mode))); return p.puzzle.every((v, i) => !v || proof[i] === v) && isComplete(proof); }
      case "crossword": { if (!arr(proof)) return false; return xwSolved(proof.map(String), once(`xw:${date}`, () => crosswordFor(date)).rows); }
      case "trail": { if (!nums(proof)) return false; const p = once(`tr:${date}`, () => trailFor(date)); return trailSolved(p.answer, p.given, proof); }
      case "stars": { if (!nums(proof)) return false; return starsSolved(once(`st:${date}`, () => starsFor(date)).stars, proof as StarMark[]); }
      case "seats": { if (!nums(proof)) return false; return seatsSolved(once(`se:${date}`, () => seatsFor(date)).walls, proof as never); }
      case "garden": { if (!nums(proof)) return false; return gardenSolved(once(`ga:${date}`, () => gardenFor(date)).clues, proof as never); }
      case "zip": { if (!nums(proof)) return false; return zipSolved(once(`zp:${date}`, () => zipFor(date)).marks, proof); }
      case "bikes": { if (!nums(proof)) return false; return bikesSolved(once(`bk:${date}`, () => bikesFor(date)), proof as BikeMark[]); }
      case "codeword": { if (!proof || typeof proof !== "object") return false; return codeSolved(once(`cw:${date}`, () => codewordFor(date)), proof as Record<number, string>); }
      case "pipes": { if (!nums(proof)) return false; const p = once(`pp:${date}`, () => pipesFor(date)); return pipesSolved(p.tiles, p.spins, proof); }
      case "cutters": { if (!arr(proof)) return false; return cuttersSolved(once(`cu:${date}`, () => cuttersFor(date)), proof as Placed[]); }
      case "push": {
        // Replay the moves: every one must be possible, the room must end tidy, and the count must match the score
        if (!nums(proof) || proof.length !== Math.floor(score / 1_000_000)) return false;
        const l = once(`bp:${date}`, () => levelFor(date));
        let s = pushStart(l);
        for (const d of proof) { const n = pushMove(l, s, d as Dir); if (!n) return false; s = n; }
        return pushSolved(l, s);
      }
      case "wheel": {
        if (!arr(proof)) return false;
        const w = once(`ww:${date}`, () => wheelFor(date)), found = [...new Set(proof.map(String))];
        return found.length === proof.length && found.every((x) => w.main.includes(x)) && found.length === MAX_MAIN - Math.floor(score / 1_000_000);
      }
      case "price": {
        if (!arr(proof) || !proof.length || proof.length !== Math.floor(score / 1_000_000)) return false;
        const items = priceFor(date, menu());
        return !!items && priceRight(items, (proof[proof.length - 1] as unknown[]).map(String));
      }
    }
  } catch { return false; }
  return true;
}
