// The all-rounder board: who finished the most daily games this week. You join it with a name; nobody's on it otherwise.
import "server-only";
import { votersFor } from "./syncStore";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { weekOf } from "./polls";
import { playedMap } from "./gamesStore";
import { fiveDays } from "./todaysFive";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
type Row = { voter: string; customer_id: number | null; name: string };

/** Games finished this week: one per game per day */
export function weekCount(played: Record<string, string[]>, week: string) {
  return Object.values(played).reduce((n, days) => n + days.filter((d) => weekOf(d) === week).length, 0);
}

export function allRounderBoard(customerId: number | null, voter: unknown, now = new Date()) {
  const week = weekOf(toDateStr(now)), v = cleanVoter(voter);
  const rows = db.prepare("SELECT voter, customer_id, name FROM allrounder").all() as Row[];
  const scored = rows.map((r) => ({ voter: r.voter, name: r.name, games: weekCount(playedMap(r.customer_id, r.voter), week) }))
    .filter((r) => r.games > 0).sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
  const mine = v ? (rows.find((r) => r.voter === v) ?? null) : null;
  return {
    week,
    top: scored.slice(0, 10).map(({ name, games }) => ({ name, games })),
    joined: mine ? mine.name : null,
    // Your own count, whether or not you've joined
    mine: v || customerId ? weekCount(playedMap(customerId, v), week) : 0,
    rank: mine ? scored.findIndex((r) => r.voter === v) + 1 || null : null,
  };
}

/** { voter, name } to join (or rename), { voter, leave: true } to come off the board */
export function joinAllRounder(customerId: number | null, b: Record<string, unknown>, now = new Date()) {
  const v = cleanVoter(b.voter);
  if (!v) return { error: "Something went wrong. Refresh and try again." };
  if (b.leave === true) db.prepare("DELETE FROM allrounder WHERE voter = ?").run(v);
  else {
    const name = cleanText(b.name, 20).replace(/[<>]/g, "");
    if (!name) return { error: "Pick a name for the board." };
    db.prepare(`INSERT INTO allrounder (voter, customer_id, name) VALUES (?, ?, ?)
      ON CONFLICT(voter) DO UPDATE SET name = excluded.name, customer_id = COALESCE(excluded.customer_id, allrounder.customer_id)`).run(v, customerId, name);
  }
  return allRounderBoard(customerId, v, now);
}

/** What the trophy shelf needs from the server */
export function trophyData(customerId: number | null, voter: unknown) {
  const v = cleanVoter(voter);
  const played = playedMap(customerId, v);
  const arcade: Record<string, number | null> = {};
  for (const g of ["stacker", "typing", "snake", "higherlower", "merge", "dice", "echo", "breaker", "pastry", "dash"]) {
    const vs = [...new Set([v, ...votersFor(customerId)].filter(Boolean))] as string[];
    const best = vs.map((x) => (db.prepare("SELECT MAX(score) AS s FROM arcade_scores WHERE game = ? AND voter = ?").get(g, x) as { s: number | null }).s).filter((x): x is number => x !== null);
    arcade[g] = best.length ? Math.max(...best) : null;
  }
  return { played, five: fiveDays(played), arcade };
}
