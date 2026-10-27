// Game profiles: a little picture, a favourite game and up to three trophies to show off, seen by friends. Pure.
import { TROPHIES } from "./trophies.ts";
import { ANY_TIME, DAILY_KIND } from "./gameCatalog.ts";

export const AVATARS = ["☕", "🍵", "🧁", "🥐", "🍰", "🍩", "🌙", "🌿", "🌸", "🐈", "🐕", "🦉", "🐢", "🦜", "🌻", "🎲", "🧩", "♟️", "🃏", "⭐"];
export const SHOWCASE_MAX = 3;
export type Profile = { avatar: string; fav: string; showcase: string[] };
const GAME_IDS = new Set([...Object.keys(DAILY_KIND), ...ANY_TIME.map((g) => g.id)]);
const TROPHY_IDS = new Set(TROPHIES.map((t) => t.id));

/** Keeps only things we know: a listed picture, a real game, real trophies (at most three, no repeats) */
export function cleanProfile(b: Record<string, unknown>): Profile {
  const avatar = typeof b.avatar === "string" && AVATARS.includes(b.avatar) ? b.avatar : "";
  const fav = typeof b.fav === "string" && GAME_IDS.has(b.fav) ? b.fav : "";
  const showcase = Array.isArray(b.showcase) ? [...new Set(b.showcase.filter((t): t is string => typeof t === "string" && TROPHY_IDS.has(t)))].slice(0, SHOWCASE_MAX) : [];
  return { avatar, fav, showcase };
}
export const trophyById = (id: string) => TROPHIES.find((t) => t.id === id) ?? null;
export const anyTimeGame = (id: string) => ANY_TIME.find((g) => g.id === id) ?? null;
