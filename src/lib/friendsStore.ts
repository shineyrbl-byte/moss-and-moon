// Friends: everyone gets a short friend code; add a friend's code to see their times next to yours. One way, like following.
import "server-only";
import { headToHead, league, type Record3, type Row } from "./league";
import { anyTimeGame, cleanProfile, trophyById, type Profile } from "./profiles";
import { randomInt } from "node:crypto";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { weekOf } from "./polls";
import { DAILY_GAMES } from "./gamesStore";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I/L to mix up
export const MAX_FRIENDS = 40;
export const cleanCode = (c: unknown) => (typeof c === "string" ? c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) : "");

type CodeRow = { code: string; name: string; avatar: string; fav: string; showcase: string };
function codeFor(voter: string) {
  return (db.prepare("SELECT code, name, avatar, fav, showcase FROM friend_codes WHERE voter = ?").get(voter) as CodeRow | undefined) ?? null;
}
const profileOf = (c: CodeRow | null): Profile => { try { return cleanProfile({ avatar: c?.avatar, fav: c?.fav, showcase: JSON.parse(c?.showcase ?? "[]") }); } catch { return { avatar: "", fav: "", showcase: [] }; } };
const daysAgo = (today: string, n: number) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const rowsSince = (v: string, from: string) => db.prepare("SELECT voter, game, date, MIN(ms) AS ms FROM daily_scores WHERE voter = ? AND date >= ? GROUP BY game, date").all(v, from) as Row[];
const gameInfo = (id: string) => { const g = DAILY_GAMES.find((x) => x.id === id) ?? anyTimeGame(id); return g ? { id, title: g.title, emoji: g.emoji, href: g.href } : null; };
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
/** Your picture, favourite game and showcase trophies (you need a friend code first) */
export function setProfile(voterIn: unknown, b: Record<string, unknown>) {
  const voter = cleanVoter(voterIn);
  if (!voter || !codeFor(voter)) return { error: "Get your friend code first." };
  const p = cleanProfile(b);
  db.prepare("UPDATE friend_codes SET avatar = ?, fav = ?, showcase = ? WHERE voter = ?").run(p.avatar, p.fav, JSON.stringify(p.showcase), voter);
  return board(voter);
}
/** Someone's profile, by friend code, with your record against them over the last 90 days */
export function profile(codeIn: unknown, viewerIn: unknown, now = new Date()) {
  const code = cleanCode(codeIn), viewer = cleanVoter(viewerIn);
  const row = db.prepare("SELECT voter FROM friend_codes WHERE code = ?").get(code) as { voter: string } | undefined;
  if (!row) return { error: "We couldn't find that code." };
  const c = codeFor(row.voter)!, p = profileOf(c), today = toDateStr(now);
  const all = db.prepare("SELECT date, COUNT(DISTINCT game) AS n FROM daily_scores WHERE voter = ? GROUP BY date").all(row.voter) as { date: string; n: number }[];
  const me = viewer === row.voter;
  const h2h = viewer && !me ? headToHead(rowsSince(viewer, daysAgo(today, 90)), rowsSince(row.voter, daysAgo(today, 90))) : null;
  const titled = h2h ? Object.entries(h2h.byGame).map(([g, r]) => ({ ...(gameInfo(g) ?? { id: g, title: g, emoji: "🧩", href: "/games" }), ...r })).sort((a, b) => b.won + b.lost + b.drawn - (a.won + a.lost + a.drawn)) : [];
  const isFriend = !!viewer && !!db.prepare("SELECT 1 FROM friends WHERE voter = ? AND friend = ?").get(viewer, row.voter);
  return {
    code: c.code, name: c.name, me, isFriend, avatar: p.avatar, fav: p.fav ? gameInfo(p.fav) : null,
    showcase: p.showcase.map(trophyById).filter(Boolean).map((t) => ({ id: t!.id, emoji: t!.emoji, name: t!.name, how: t!.how })),
    days: all.length, puzzles: all.reduce((n, d) => n + d.n, 0), first: all.map((d) => d.date).sort()[0] ?? null,
    h2h: h2h ? { won: h2h.won, lost: h2h.lost, drawn: h2h.drawn, games: titled } : null,
  };
}
export function removeFriend(voterIn: unknown, codeIn: unknown) {
  const voter = cleanVoter(voterIn), code = cleanCode(codeIn);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const row = db.prepare("SELECT voter FROM friend_codes WHERE code = ?").get(code) as { voter: string } | undefined;
  if (row) db.prepare("DELETE FROM friends WHERE voter = ? AND friend = ?").run(voter, row.voter);
  return board(voter);
}
export type Person = { code: string; name: string; avatar: string; me: boolean; played: number; times: Record<string, number>; weekly: number | null; h2h: Record3 | null };
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
    const h = v === voter ? null : headToHead(rowsSince(voter, daysAgo(today, 90)), rowsSince(v, daysAgo(today, 90)));
    return { code: c?.code ?? "", name: c?.name ?? (v === voter ? "You" : "A friend"), avatar: profileOf(c).avatar, me: v === voter, played: rows.length, times: Object.fromEntries(rows.map((r) => [r.game, r.ms])), weekly: w?.ms ?? null, h2h: h && { won: h.won, lost: h.lost, drawn: h.drawn } };
  });
  // What friends have been playing: their saves from the last three days, newest first
  const friendIds = ids.slice(1);
  const feed = friendIds.length ? (db.prepare(`SELECT voter, game, date, MIN(ms) AS ms, MAX(rowid) AS k FROM daily_scores WHERE voter IN (${friendIds.map(() => "?").join(",")}) AND date >= ? GROUP BY voter, game, date ORDER BY date DESC, k DESC LIMIT 30`).all(...friendIds, daysAgo(today, 2)) as (Row & { k: number })[])
    .map((r) => { const p = people[ids.indexOf(r.voter)], g = gameInfo(r.game); return g && { name: p.name, code: p.code, avatar: p.avatar, game: g, date: r.date, ms: r.ms }; }).filter(Boolean) : [];
  // This week's league, from Monday to today (each person's best per puzzle per day, at the usual level)
  const rows = ids.flatMap((v) => db.prepare("SELECT voter, game, date, MIN(ms) AS ms FROM daily_scores WHERE voter = ? AND date >= ? AND date <= ? GROUP BY game, date").all(v, week, today) as Row[]);
  const standings = league(ids, rows).map((s) => { const p = people[ids.indexOf(s.voter)]; return { name: p.name, me: p.me, points: s.points, solved: s.solved, bests: s.bests }; });
  return { me: mine && { code: mine.code, name: mine.name, ...profileOf(mine) }, people, feed, games: DAILY_GAMES.map((g) => ({ id: g.id, title: g.title, emoji: g.emoji })), today, week, league: standings };
}
