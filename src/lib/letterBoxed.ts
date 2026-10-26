// Café corners: twelve letters round a square, three on each side. Make words by hopping between sides (never two letters
// from the same side in a row). Each word starts with the last letter of the one before. Use every letter in as few words
// as you can. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";
import { COMMON4, MORE4 } from "./data/words4.ts";
import { WORDS5 } from "./data/words5.ts";
import { ANSWERS } from "./wordGame.ts";
import { HIVE_PUZZLES } from "./data/hive.ts";

export const minMs = 5000;
export const MIN_LEN = 4;
const hive = (k: "common" | "bonus") => HIVE_PUZZLES.flatMap((p) => p[k].split(/\s+/).filter(Boolean));
// Everyday words: the barista's answer only uses these
const EVERYDAY = [...new Set([...COMMON4, ...ANSWERS, ...hive("common")])].filter((w) => w.length >= MIN_LEN && /^[a-z]+$/.test(w));
let all: Set<string> | null = null;
export const isWord = (w: string) => (all ??= new Set([...COMMON4, ...MORE4, ...WORDS5.split(" "), ...ANSWERS, ...hive("common"), ...hive("bonus")])).has(w);

/** Fewest words then quickest time, packed into one number for the board */
export const pack = (words: number, ms: number) => words * 1_000_000 + Math.min(999_999, Math.max(0, Math.round(ms)));
export const unpack = (v: number) => ({ words: Math.floor(v / 1_000_000), ms: v % 1_000_000 });
export const MIN_SCORE = pack(2, minMs), MAX_SCORE = pack(12, 999_999);

export type Box = string[]; // four sides of three letters
export const sideOf = (box: Box, ch: string) => box.findIndex((s) => s.includes(ch));
/** Can this word be made on the box? (Ignores whether it's a real word.) */
export function fitsBox(box: Box, w: string) {
  for (let i = 0; i < w.length; i++) {
    const s = sideOf(box, w[i]);
    if (s < 0 || (i > 0 && s === sideOf(box, w[i - 1]))) return false;
  }
  return true;
}
/** Can this letter come next in the word being typed? */
export const canAdd = (box: Box, cur: string, ch: string) => sideOf(box, ch) >= 0 && (!cur || sideOf(box, ch) !== sideOf(box, cur[cur.length - 1]));

/** Why a word can't be played, or null if it's fine */
export function problem(box: Box, words: string[], w: string): string | null {
  if (w.length < MIN_LEN) return `Words need at least ${MIN_LEN} letters.`;
  if (words.length && w[0] !== words[words.length - 1].slice(-1)) return "Each word starts with the last letter of the one before.";
  if (!fitsBox(box, w)) return "Letters next to each other have to come from different sides.";
  if (!isWord(w)) return "That's not in our word list.";
  return null;
}
export const used = (words: string[]) => new Set(words.join(""));
export const allUsed = (box: Box, words: string[]) => { const u = used(words); return box.join("").split("").every((c) => u.has(c)); };

/** The fewest everyday words that use every letter (breadth first over letters used and the last letter) */
export function fewest(box: Box, maxWords = 5): string[] | null {
  const letters = box.join("");
  const bit = (w: string) => [...w].reduce((m, c) => m | (1 << letters.indexOf(c)), 0);
  const words = EVERYDAY.filter((w) => fitsBox(box, w)).map((w) => ({ w, m: bit(w) }));
  const full = (1 << 12) - 1;
  type Node = { mask: number; last: string; path: string[] };
  let layer: Node[] = words.map(({ w, m }) => ({ mask: m, last: w.slice(-1), path: [w] }));
  const seen = new Set<string>();
  for (let depth = 1; depth <= maxWords; depth++) {
    const done = layer.find((n) => n.mask === full);
    if (done) return done.path;
    const next: Node[] = [];
    for (const n of layer) {
      const key = `${n.mask}:${n.last}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const { w, m } of words) if (w[0] === n.last && (n.mask | m) !== n.mask) next.push({ mask: n.mask | m, last: w.slice(-1), path: [...n.path, w] });
    }
    layer = next;
  }
  return null;
}

/** Today's box: chain a few everyday words that use exactly twelve letters, then share them out over the sides */
export function cornersFor(date: string): { box: Box; best: string[] } {
  const rand = seededRand(`corners:${date}`);
  const pool = EVERYDAY.filter((w) => !/(.)\1/.test(w) && new Set(w).size === w.length);
  for (;;) {
    const chain = [pool[Math.floor(rand() * pool.length)]];
    let letters = new Set(chain[0]);
    for (let tries = 0; tries < 60 && letters.size < 12; tries++) {
      const last = chain[chain.length - 1].slice(-1);
      const opts = pool.filter((w) => w[0] === last && [...w.slice(1)].every((c) => !letters.has(c)) && letters.size + w.length - 1 <= 12);
      if (!opts.length) break;
      const w = opts[Math.floor(rand() * opts.length)];
      chain.push(w); letters = new Set([...letters, ...w]);
    }
    if (letters.size !== 12 || chain.length > 4) continue;
    // Share the letters out, three to a side, so no two letters next to each other in the chain share a side
    const ls = [...letters];
    for (let i = ls.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ls[i], ls[j]] = [ls[j], ls[i]]; }
    const pairs = new Set(chain.flatMap((w) => [...w.slice(1)].map((c, i) => [w[i], c].sort().join(""))));
    const side: Record<string, number> = {}, count = [0, 0, 0, 0];
    const place = (k: number): boolean => {
      if (k === ls.length) return true;
      for (let s = 0; s < 4; s++) {
        if (count[s] === 3 || ls.slice(0, k).some((o) => side[o] === s && pairs.has([o, ls[k]].sort().join("")))) continue;
        side[ls[k]] = s; count[s]++;
        if (place(k + 1)) return true;
        count[s]--;
      }
      return false;
    };
    if (!place(0)) continue;
    const box = [0, 1, 2, 3].map((s) => ls.filter((c) => side[c] === s).join(""));
    const best = fewest(box, chain.length) ?? chain;
    return { box, best };
  }
}
