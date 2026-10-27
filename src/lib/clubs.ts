// Café clubs: start a club or join one with its code. Everyone's daily puzzles count towards the club's week, and the
// clubs go on a weekly board (by puzzles per member, so a small club can still win).
import "server-only";
import { randomInt } from "node:crypto";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { weekOf } from "./polls";

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const MAX_MEMBERS = 30;
const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const cleanCode = (c: unknown) => (typeof c === "string" ? c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) : "");
const cleanName = (n: unknown, len: number) => cleanText(n, len).replace(/[<>]/g, "");

export function createClub(voterIn: unknown, clubName: unknown, playerName: unknown) {
  const voter = cleanVoter(voterIn), name = cleanName(clubName, 30);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  if (name.length < 2) return { error: "Give your club a name." };
  for (let k = 0; k < 30; k++) {
    const code = [...Array(6)].map(() => ALPHA[randomInt(ALPHA.length)]).join("");
    if (db.prepare("INSERT OR IGNORE INTO clubs (code, name) VALUES (?, ?)").run(code, name).changes) return joinClub(voter, code, playerName);
  }
  return { error: "Couldn't start a club just now. Try again." };
}
export function joinClub(voterIn: unknown, codeIn: unknown, playerName: unknown) {
  const voter = cleanVoter(voterIn), code = cleanCode(codeIn);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  if (!db.prepare("SELECT 1 FROM clubs WHERE code = ?").get(code)) return { error: "We couldn't find a club with that code." };
  const n = (db.prepare("SELECT COUNT(*) AS n FROM club_members WHERE club = ? AND voter != ?").get(code, voter) as { n: number }).n;
  if (n >= MAX_MEMBERS) return { error: `That club's full (${MAX_MEMBERS} members).` };
  // One club at a time: joining a new one leaves the old
  db.prepare(`INSERT INTO club_members (voter, club, name) VALUES (?, ?, ?) ON CONFLICT(voter) DO UPDATE SET club = excluded.club, name = excluded.name, joined_at = datetime('now')`).run(voter, code, cleanName(playerName, 20) || "Guest");
  return clubView(voter);
}
export function leaveClub(voterIn: unknown) {
  const voter = cleanVoter(voterIn);
  if (voter) db.prepare("DELETE FROM club_members WHERE voter = ?").run(voter);
  return clubView(voter);
}
export function clubView(voterIn: unknown, now = new Date()) {
  const voter = cleanVoter(voterIn), today = toDateStr(now), week = weekOf(today);
  const count = (v: string) => (db.prepare("SELECT COUNT(*) AS n FROM daily_scores WHERE voter = ? AND date >= ? AND date <= ?").get(v, week, today) as { n: number }).n;
  const mine = voter ? (db.prepare("SELECT club FROM club_members WHERE voter = ?").get(voter) as { club: string } | undefined)?.club ?? null : null;
  const clubs = (db.prepare("SELECT c.code, c.name FROM clubs c WHERE EXISTS (SELECT 1 FROM club_members m WHERE m.club = c.code)").all() as { code: string; name: string }[]).map((c) => {
    const members = db.prepare("SELECT voter, name FROM club_members WHERE club = ? ORDER BY joined_at").all(c.code) as { voter: string; name: string }[];
    const solved = members.map((m) => ({ name: m.name, me: m.voter === voter, solved: count(m.voter) }));
    const total = solved.reduce((n, m) => n + m.solved, 0);
    return { code: c.code, name: c.name, members: solved, total, perMember: members.length ? Math.round((total / members.length) * 10) / 10 : 0 };
  });
  const board = [...clubs].sort((a, b) => b.perMember - a.perMember || b.total - a.total).slice(0, 15).map((c) => ({ name: c.name, members: c.members.length, total: c.total, perMember: c.perMember, mine: c.code === mine }));
  const my = clubs.find((c) => c.code === mine) ?? null;
  return { week, mine: my ? { code: my.code, name: my.name, members: [...my.members].sort((a, b) => b.solved - a.solved), total: my.total, rank: board.findIndex((c) => c.mine) + 1 || null } : null, board };
}
