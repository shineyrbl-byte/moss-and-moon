// Hangman with café words: guess the word a letter at a time before the cup runs dry (seven wrong guesses). Each word
// comes with its category as a clue. Pure.
import { shuffled } from "./gameOrders.ts";
import { WEEKLY_WORDS } from "./data/weeklyWords.ts";

export const LIVES = 7;
export const WORDS = Object.keys(WEEKLY_WORDS).filter((w) => w.length >= 5 && /^[a-z]+$/.test(w));
export const clueFor = (w: string) => WEEKLY_WORDS[w];
export type State = { word: string; guessed: string[]; over: boolean; won: boolean };
export function newWord(rand: () => number, not: string[] = []): State {
  const word = shuffled(WORDS.filter((w) => !not.includes(w)), rand)[0] ?? WORDS[0];
  return { word, guessed: [], over: false, won: false };
}
export const wrong = (s: State) => s.guessed.filter((l) => !s.word.includes(l)).length;
export function guess(s: State, letter: string): State {
  const l = letter.toLowerCase();
  if (s.over || !/^[a-z]$/.test(l) || s.guessed.includes(l)) return s;
  const g = [...s.guessed, l], won = [...s.word].every((ch) => g.includes(ch));
  const next = { ...s, guessed: g, won };
  return { ...next, over: won || wrong(next) >= LIVES };
}
export const shown = (s: State) => [...s.word].map((ch) => (s.guessed.includes(ch) || s.over ? ch : "_"));
