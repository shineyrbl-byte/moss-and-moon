// Friends: everyone gets a short friend code; add a friend's code to see their times next to yours. One way, like following.
import "server-only";
import { league, type Row } from "./league";
import { randomInt } from "node:crypto";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { weekOf } from "./polls";
import { DAILY_GAMES } from "./gamesStore";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I/L to mix up
export const MAX_FRIENDS = 40;
export const cleanCode = (c: unknown) => (typeof c === "string" ? c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) : "");

function codeFor(voter: string) {
  return (db.prepare("SELECT code, name FROM friend_codes WHERE voter = ?").get(voter) as { code: string; name: string } | undefined) ?? null;
}
/** Your code (made the first time you ask), under the name you'd like friends to see */
export function setName(voterIn: unknown, nameIn: unknown) {
  const voter = cleanVoter(voterIn);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const name = cleanText(nameIn, 20).replace(/[<>]/g, "");
  if (!name) return { error: "Pick a name your friends will know." };
  const have = codeFor(voter);
  if (have) db.prepare("UPDATE friend_codes SET name = ? WHERE voter = ?").run(name, voter);
  else for (let tries = 0; tries < 20; tries++) {
    const code = [...Array(6)].map(() => ALPHA[randomInt(ALPHA.length)]).join("");
    if (db.prepare("INSERT OR IGNORE INTO friend_codes (code, voter, name) VALUES (?, ?, ?)").run(code, voter, name).changes) break;
  }
  return board(voter);
}
export function addFriend(voterIn: unknown, codeIn: unknown) {
  const voter = cleanVoter(voterIn), code = cleanCode(codeIn);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const row = db.prepare("SELECT voter FROM friend_codes WHERE code = ?").get(code) as { voter: string } | undefined;
  if (!row) return { error: "We couldn't find that code. Check it with your friend." };
  if (row.voter === voter) return { error: "That's your own code!" };
  const n = (db.prepare("SELECT COUNT(*) AS n FROM friends WHERE voter = ?").get(voter) as { n: number }).n;
  if (n >= MAX_FRIENDS) return { error: `You can have up to ${MAX_FRIENDS} friends.` };
  db.prepare("INSERT OR IGNORE INTO friends (voter, friend) VALUES (?, ?)").run(voter, row.voter);
  return board(voter);
}
export function removeFriend(voterIn: unknown, codeIn: unknown) {
  const voter = cleanVoter(voterIn), code = cleanCode(codeIn);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const row = db.prepare("SELECT voter FROM friend_codes WHERE code = ?").get(code) as { voter: string } | undefined;
  if (row) db.prepare("DELETE FROM friends WHERE voter = ? AND friend = ?").run(voter, row.voter);
  return board(voter);
}
export type Person = { code: string; name: string; me: boolean; played: number; times: Record<string, number>; weekly: number | null };
/** You and your friends: today's daily games and the puzzle of the week */
export function board(voterIn: unknown, now = new Date()) {
  const voter = cleanVoter(voterIn);
  if (!voter) return { me: null, people: [] as Person[] };
  const today = toDateStr(now), week = weekOf(today);
  const mine = codeFor(voter);
  const ids = [voter, ...(db.prepare("SELECT friend FROM friends WHERE voter = ? ORDER BY at").all(voter) as { friend: string }[]).map((r) => r.friend)];
  const people: Person[] = ids.map((v) => {
    const c = codeFor(v);
    const rows = db.prepare("SELECT game, MIN(ms) AS ms FROM daily_scores WHERE voter = ? AND date = ? GROUP BY game").all(v, today) as { game: string; ms: number }[];
    const w = db.prepare("SELECT ms FROM weekly_scores WHERE voter = ? AND week = ?").get(v, week) as { ms: number } | undefined;
    return { code: c?.code ?? "", name: c?.name ?? (v === voter ? "You" : "A friend"), me: v === voter, played: rows.length, times: Object.fromEntries(rows.map((r) => [r.game, r.ms])), weekly: w?.ms ?? null };
  });
  // This week's league, from Monday to today (each person's best per puzzle per day, at the usual level)
  const rows = ids.flatMap((v) => db.prepare("SELECT voter, game, date, MIN(ms) AS ms FROM daily_scores WHERE voter = ? AND date >= ? AND date <= ? GROUP BY game, date").all(v, week, today) as Row[]);
  const standings = league(ids, rows).map((s) => { const p = people[ids.indexOf(s.voter)]; return { name: p.name, me: p.me, points: s.points, solved: s.solved, bests: s.bests }; });
  return { me: mine, people, games: DAILY_GAMES.map((g) => ({ id: g.id, title: g.title, emoji: g.emoji })), today, week, league: standings };
}
