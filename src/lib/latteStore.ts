// Latte art of the week: baristas post their best pour, guests vote once a week, the winner goes on the board.
import "server-only";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { weekOf } from "./polls";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
type Art = { id: number; staff_id: number; staff_name: string; img: string; caption: string; votes: number };
const thisWeek = (now = new Date()) => weekOf(toDateStr(now));
const lastWeekOf = (week: string) => new Date(Date.parse(`${week}T12:00:00Z`) - 7 * 86400_000).toISOString().slice(0, 10);

const entries = (week: string) => db.prepare(`SELECT a.id, a.staff_id, a.staff_name, a.img, a.caption, (SELECT COUNT(*) FROM latte_votes v WHERE v.art_id = a.id) AS votes
  FROM latte_art a WHERE a.week = ? ORDER BY votes DESC, a.id`).all(week) as Art[];
/** A week's winner: most votes (at least one), earliest post wins a tie */
export const winnerOf = (week: string) => entries(week).find((a) => a.votes > 0) ?? null;

export function latteWeek(voter?: unknown, now = new Date()) {
  const week = thisWeek(now);
  const v = cleanVoter(voter);
  const mine = v ? (db.prepare("SELECT art_id FROM latte_votes WHERE week = ? AND voter = ?").get(week, v) as { art_id: number } | undefined)?.art_id ?? null : null;
  return { week, entries: entries(week), mine, lastWinner: winnerOf(lastWeekOf(week)) };
}

/** For the TV board: last week's winner, or this week's leader if last week had none */
export const latteForBoard = (now = new Date()) => { const w = thisWeek(now); const last = winnerOf(lastWeekOf(w)); return last ? { ...last, final: true } : (() => { const lead = winnerOf(w); return lead ? { ...lead, final: false } : null; })(); };

/** How many weeks each barista has won (for the team page) */
export function latteWins(now = new Date()): Map<number, { wins: number; img: string }> {
  const out = new Map<number, { wins: number; img: string }>();
  const current = thisWeek(now);
  const weeks = (db.prepare("SELECT DISTINCT week FROM latte_art WHERE week < ? ORDER BY week").all(current) as { week: string }[]).map((r) => r.week);
  for (const w of weeks) {
    const win = winnerOf(w);
    if (win) out.set(win.staff_id, { wins: (out.get(win.staff_id)?.wins ?? 0) + 1, img: win.img });
  }
  return out;
}

export function addArt(staff: { id: number; name: string }, img: string, caption: unknown, now = new Date()) {
  const week = thisWeek(now);
  if ((db.prepare("SELECT COUNT(*) AS n FROM latte_art WHERE week = ? AND staff_id = ?").get(week, staff.id) as { n: number }).n >= 3) return { error: "Three entries a week each. Remove one to post another." };
  db.prepare("INSERT INTO latte_art (staff_id, staff_name, img, caption, week) VALUES (?, ?, ?, ?, ?)").run(staff.id, staff.name.trim().split(/\s+/)[0] || "Barista", img, cleanText(caption, 60).replace(/[<>]/g, ""), week);
  return { ok: true as const };
}

export function voteArt(b: Record<string, unknown>, now = new Date()) {
  const v = cleanVoter(b.voter);
  if (!v) return { error: "Something went wrong. Refresh and try again." };
  const week = thisWeek(now);
  const id = Math.floor(Number(b.id));
  if (!db.prepare("SELECT 1 FROM latte_art WHERE id = ? AND week = ?").get(id, week)) return { error: "Voting for that one has closed." };
  db.prepare("INSERT INTO latte_votes (week, voter, art_id) VALUES (?, ?, ?) ON CONFLICT(week, voter) DO UPDATE SET art_id = excluded.art_id").run(week, v, id);
  return latteWeek(v, now);
}

/** Staff take down their own; owners any */
export function removeArt(id: number, staff: { id: number; role: string }) {
  const row = db.prepare("SELECT staff_id FROM latte_art WHERE id = ?").get(id) as { staff_id: number } | undefined;
  if (!row || (staff.role !== "owner" && row.staff_id !== staff.id)) return false;
  db.prepare("DELETE FROM latte_votes WHERE art_id = ?").run(id);
  return db.prepare("DELETE FROM latte_art WHERE id = ?").run(id).changes > 0;
}
