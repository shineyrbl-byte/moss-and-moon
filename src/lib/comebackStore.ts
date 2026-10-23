// Bring it back: the vote. One vote a month per person (signed in, or a random id kept in the browser).
import "server-only";
import { db, setSetting } from "./db";
import { toDateStr } from "./cafe";
import { getMenu, inSeason } from "./menuStore";
import { monthOf, shiftMonth } from "./comeback";
import { comebackFor, voteTally } from "./comebackPick";
import type { MenuItem } from "./menu";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const voterFor = (customerId: number | null, v: unknown) => (customerId ? `c${customerId}` : cleanVoter(v));

/** Items guests can vote for: hidden or out of season, not shop items, dog treats, secret or one-day specials */
export function candidates(month: string): MenuItem[] {
  const today = toDateStr(new Date());
  const back = comebackFor(month);
  return getMenu({ includeHidden: true }).filter((m) =>
    (m.hidden || !inSeason(m, today)) && m.id !== back && m.cat !== "shop" && !m.pup && !m.secret && !m.fullMoon && !m.season && !m.id.startsWith("special-"));
}

export function comebackStatus(customerId: number | null, v: unknown, now = new Date()) {
  const month = monthOf(toDateStr(now));
  const voter = voterFor(customerId, v);
  const tally = new Map(voteTally(month).map((t) => [t.item_id, t.votes]));
  const list = candidates(month).map((m) => ({ id: m.id, name: m.name, img: m.img, cat: m.cat, desc: m.desc, votes: tally.get(m.id) ?? 0 }));
  const mine = voter ? (db.prepare("SELECT item_id FROM comeback_votes WHERE month = ? AND voter = ?").get(month, voter) as { item_id: string } | undefined)?.item_id ?? null : null;
  const backId = comebackFor(month);
  const back = backId ? getMenu({ includeHidden: true }).find((m) => m.id === backId) : undefined;
  return { month, next: shiftMonth(month, 1), candidates: list, mine, total: [...tally.values()].reduce((s, n) => s + n, 0), back: back ? { id: back.id, name: back.name, img: back.img } : null };
}

export function voteComeback(customerId: number | null, b: Record<string, unknown>, now = new Date()) {
  const voter = voterFor(customerId, b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const month = monthOf(toDateStr(now));
  if (!candidates(month).some((m) => m.id === b.itemId)) return { error: "That one isn't up for a vote." };
  // You can change your mind until the month ends
  db.prepare("INSERT INTO comeback_votes (month, voter, customer_id, item_id) VALUES (?, ?, ?, ?) ON CONFLICT(month, voter) DO UPDATE SET item_id = excluded.item_id, created_at = datetime('now','localtime')").run(month, voter, customerId, b.itemId as string);
  return comebackStatus(customerId, b.voter, now);
}

/** Staff: choose next month's comeback by hand ("auto" = the vote decides, "none" = nothing comes back) */
export function setComeback(month: string, pick: unknown) {
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Bad month." };
  if (pick === "auto") db.prepare("DELETE FROM settings WHERE key = ?").run(`comeback:${month}`);
  else if (pick === "none") setSetting(`comeback:${month}`, "none");
  else if (typeof pick === "string" && getMenu({ includeHidden: true }).some((m) => m.id === pick)) setSetting(`comeback:${month}`, pick);
  else return { error: "Pick an item." };
  return { ok: true, pick: comebackFor(month) };
}
