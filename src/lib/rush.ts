// Rush mode: when the counter is swamped, promise longer waits, or pause online orders for a bit
import "server-only";
import { db, getSetting, setSetting } from "./db";
import { publish } from "./live";

export type Rush = { mode: "off" | "busy" | "paused"; until: number | null; auto: boolean; by: string | null };
/** Extra minutes added to every ready time while it's busy */
export const RUSH_EXTRA = 10;
/** Auto mode: this many open orders counts as busy */
export const AUTO_BUSY_AT = 12;

const read = (): Rush => {
  try { return { mode: "off", until: null, auto: true, by: null, ...JSON.parse(getSetting("rush") ?? "{}") }; } catch { return { mode: "off", until: null, auto: true, by: null }; }
};
export const activeOrders = () => (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('received','brewing')").get() as { n: number }).n;

/** The rush state right now (a pause or busy spell with an end time runs out by itself) */
export function rushNow() {
  const r = read();
  const expired = r.until !== null && Date.now() > r.until;
  const manual = expired ? "off" : r.mode;
  const active = activeOrders();
  const autoBusy = r.auto && active >= AUTO_BUSY_AT;
  const mode: Rush["mode"] = manual === "paused" ? "paused" : manual === "busy" || autoBusy ? "busy" : "off";
  return { mode, until: expired ? null : r.until, auto: r.auto, autoBusy: autoBusy && manual === "off", by: expired ? null : r.by, active, extra: mode === "off" ? 0 : RUSH_EXTRA };
}

export function setRush(mode: Rush["mode"], minutes: number | null, by: string, auto?: boolean) {
  const r = read();
  const next: Rush = { mode, until: mode === "off" || !minutes ? null : Date.now() + minutes * 60_000, auto: auto ?? r.auto, by: mode === "off" ? null : by };
  setSetting("rush", JSON.stringify(next));
  publish({ type: "menu" }); // open pages refresh their banners
  return rushNow();
}
