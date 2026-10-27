// Latte art of the week: baristas post their best pour, guests vote once a week, the winner goes on the board.
import "server-only";
import { db, cleanText } from "./db";
import { deletePhoto } from "./uploads";
import { toDateStr } from "./cafe";
import { weekOf } from "./polls";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
type Art = { id: number; staff_id: number; staff_name: string; img: string; caption: string; votes: number; guest: number };
const thisWeek = (now = new Date()) => weekOf(toDateStr(now));
const lastWeekOf = (week: string) => new Date(Date.parse(`${week}T12:00:00Z`) - 7 * 86400_000).toISOString().slice(0, 10);

const entries = (week: string) => db.prepare(`SELECT a.id, a.staff_id, a.staff_name, a.img, a.caption, a.guest, (SELECT COUNT(*) FROM latte_votes v WHERE v.art_id = a.id) AS votes
  FROM latte_art a WHERE a.week = ? AND a.status = 'live' ORDER BY votes DESC, a.id`).all(week) as Art[];
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
    if (win && !win.guest) out.set(win.staff_id, { wins: (out.get(win.staff_id)?.wins ?? 0) + 1, img: win.img });
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
  if (!db.prepare("SELECT 1 FROM latte_art WHERE id = ? AND week = ? AND status = 'live'").get(id, week)) return { error: "Voting for that one has closed." };
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

const MAX_PENDING = 30;
/** A guest's own pour: it waits for staff, then joins that week's vote marked as a guest's */
export function addGuestArt(img: string, b: Record<string, unknown>) {
  const name = cleanText(b.name, 20).replace(/[<>]/g, "");
  if (!name) return { error: "Add your first name so we can credit you." };
  if ((db.prepare("SELECT COUNT(*) AS n FROM latte_art WHERE status = 'pending'").get() as { n: number }).n >= MAX_PENDING) return { error: "Lots of pours are waiting already. Try again in a day or two ☕" };
  db.prepare("INSERT INTO latte_art (staff_id, staff_name, img, caption, week, status, guest) VALUES (0, ?, ?, ?, '', 'pending', 1)").run(name, img, cleanText(b.caption, 60).replace(/[<>]/g, ""));
  return { ok: true as const };
}
/** Staff: guests' pours waiting for a look */
export const pendingArt = () => db.prepare("SELECT id, staff_name AS name, img, caption, created_at FROM latte_art WHERE status = 'pending' ORDER BY id").all() as { id: number; name: string; img: string; caption: string; created_at: string }[];
/** Staff: approve (it joins this week's vote) or turn it down (the photo is deleted) */
export function reviewArt(id: number, approve: boolean, now = new Date()) {
  const row = db.prepare("SELECT img FROM latte_art WHERE id = ? AND status = 'pending'").get(id) as { img: string } | undefined;
  if (!row) return false;
  if (approve) db.prepare("UPDATE latte_art SET status = 'live', week = ? WHERE id = ?").run(thisWeek(now), id);
  else { db.prepare("DELETE FROM latte_art WHERE id = ?").run(id); deletePhoto(row.img); }
  return true;
}
