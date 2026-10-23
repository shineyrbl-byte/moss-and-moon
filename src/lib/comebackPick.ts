// Which item is back this month by guest vote. Kept apart from comebackStore so menuStore can use it.
import "server-only";
import { db, getSetting } from "./db";
import { COMEBACK_MIN, shiftMonth } from "./comeback";

export const voteTally = (month: string) =>
  db.prepare("SELECT item_id, COUNT(*) AS votes FROM comeback_votes WHERE month = ? GROUP BY item_id ORDER BY votes DESC, MIN(created_at), item_id").all(month) as { item_id: string; votes: number }[];

/** Last month's winner (with enough votes), unless staff picked something else or "none" for this month */
export function comebackFor(month: string): string | null {
  const o = getSetting(`comeback:${month}`);
  if (o !== undefined) return o === "none" ? null : o;
  const top = voteTally(shiftMonth(month, -1))[0];
  return top && top.votes >= COMEBACK_MIN ? top.item_id : null;
}
