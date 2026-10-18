// When will an order be ready? Used in the confirmation email.
import "server-only";
import { db } from "./db";

const fmt = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?([ap])m/i, "$1m").toLowerCase();

export function readyEstimate(o: { code: string; pickup: string; table_no?: number | null; delivery_address?: string | null }) {
  // A chosen pickup time is the promise
  const m = /^(\d{2}):(\d{2})$/.exec(o.pickup);
  if (m) {
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return { at: d, label: fmt(d), kind: "pickup" as const };
  }
  // Otherwise: about 5 minutes, plus 3 for every order ahead (and the ride for deliveries)
  const ahead = (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('received','brewing') AND id < (SELECT id FROM orders WHERE code = ?)").get(o.code) as { n: number }).n;
  const mins = 5 + ahead * 3 + (o.delivery_address ? 20 : 0);
  const d = new Date(Date.now() + mins * 60_000);
  return { at: d, label: `about ${fmt(d)}`, minutes: mins, kind: o.delivery_address ? ("delivery" as const) : o.table_no ? ("table" as const) : ("pickup" as const) };
}
