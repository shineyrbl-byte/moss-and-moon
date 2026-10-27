// Games the owner has hidden from the games lists (the pages still work by direct link, and nothing is deleted).
import "server-only";
import { getSetting, setSetting } from "./db";
import { toDateStr } from "./cafe";
import type { Hidden } from "./todaysFive";

const KEY = "hidden_games";
const valid = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9-]{2,30}$/.test(id);

/** { game id: the day it was hidden } */
export function hiddenGames(): Hidden {
  try { const v = JSON.parse(getSetting(KEY) ?? "{}"); return v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k, d]) => valid(k) && typeof d === "string")) as Hidden : {}; } catch { return {}; }
}
export type HideEvent = { id: string; hide: boolean; at: string };
/** The last 50 times a game was hidden or shown again, newest first */
export function hideLog(): HideEvent[] {
  try { const v = JSON.parse(getSetting("hidden_log") ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
/** Hide or show one game. Hidden from today on, so past days and streaks stay as they were. Each change is logged. */
export function setHidden(id: unknown, hide: boolean, now = new Date()) {
  if (!valid(id)) return { error: "Pick a game." };
  const h = hiddenGames(), was = !!h[id];
  if (hide) h[id] ??= toDateStr(now); else delete h[id];
  setSetting(KEY, JSON.stringify(h));
  if (was !== hide) setSetting("hidden_log", JSON.stringify([{ id, hide, at: now.toISOString() }, ...hideLog()].slice(0, 50)));
  return { hidden: h };
}
