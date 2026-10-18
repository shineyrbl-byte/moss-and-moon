// Use-by dates: batches of milk, cream, bakes and so on, oldest first
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";

export type Batch = { id: number; name: string; amount: string | null; use_by: string; status: string; staff_name: string | null; created_at: string };

const daysUntil = (d: string) => Math.round((new Date(d + "T12:00").getTime() - new Date(toDateStr(new Date()) + "T12:00").getTime()) / 86_400_000);

export function openBatches() {
  return (db.prepare("SELECT * FROM batches WHERE status = 'open' ORDER BY use_by, id").all() as Batch[]).map((b) => {
    const left = daysUntil(b.use_by);
    return { ...b, daysLeft: left, state: left < 0 ? "expired" : left <= 1 ? "soon" : "ok" };
  });
}

/** Last 30 days: how many batches were thrown away before use */
export function batchStats() {
  return db.prepare("SELECT COALESCE(SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END), 0) AS used, COALESCE(SUM(CASE WHEN status = 'thrown' THEN 1 ELSE 0 END), 0) AS thrown FROM batches WHERE closed_at >= datetime('now','localtime','-30 days')").get() as { used: number; thrown: number };
}

/** For the nightly email: what's past its date, and what has to go tomorrow */
export function batchAlerts() {
  const list = openBatches();
  return { expired: list.filter((b) => b.daysLeft < 0), tomorrow: list.filter((b) => b.daysLeft >= 0 && b.daysLeft <= 1) };
}
