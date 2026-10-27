// Which saved game progress follows your account, and how two copies of it are merged. Pure, so the server and tests share it.
import { ARCHIVE_GAMES } from "./archive.ts";

export type Entry = { v: string; t: number }; // the saved value and when it was last changed (ms)
export type Blob = Record<string, Entry>;
export const MAX_BYTES = 400_000;

const EXACT = new Set([
  "mm-game-name", "mm-trophy-flags", "mm-trophies-seen", "mm-howto-seen", "mm-game-settings", "mm-fav-games", "mm-flood-symbols", "mm-echo-sound", "mm-table-auto",
  "mm-reversi", "mm-saucers", "mm-mancala", "mm-draughts", "mm-dots", "mm-gomoku", "mm-morris", "mm-hearts", "mm-chess", "mm-backgammon", "mm-patience", "mm-freecell-stats",
  "mm-tray", "mm-tray-v2", "mm-jam", "mm-dice-game", "mm-merge", "mm-sweeper",
]);
const DAILY = new Set<string>([...ARCHIVE_GAMES.map((g) => g.key), "mm-wordsearch"]);
/** Is this a key that should follow you between devices? */
export function synced(key: string) {
  if (!key.startsWith("mm-") || key.length > 80) return false;
  if (EXACT.has(key) || key.endsWith("-best")) return true;
  // Weekend hunt keys, season-pack progress (one per season and year) and your seats in slow games
  if (/^mm-hunt-\d{4}-\d\d-\d\d$/.test(key) || /^mm-season-\d{4}-(diwali|christmas|monsoon)$/.test(key) || key === "mm-slow-games") return true;
  const base = key.replace(/@\d{4}-\d\d-\d\d$/, "");
  return DAILY.has(base) || [...DAILY].some((d) => base.startsWith(`${d}-`));
}

const parse = (s: string): unknown => { try { return JSON.parse(s); } catch { return s; } };
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
/** Merge two plain objects: numbers keep the bigger one (wins, bests), nested objects merge, anything else takes the newer side */
function deep(a: Record<string, unknown>, b: Record<string, unknown>, newer: "a" | "b"): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, bv] of Object.entries(b)) {
    const av = a[k];
    if (typeof av === "number" && typeof bv === "number") out[k] = Math.max(av, bv);
    else if (isObj(av) && isObj(bv)) out[k] = deep(av, bv, newer);
    else if (av === undefined || newer === "b") out[k] = bv;
  }
  return out;
}

/** Merge what the server has (a) with what a device sends (b) for one key */
export function mergeEntry(key: string, a: Entry | undefined, b: Entry | undefined): Entry | undefined {
  if (!a) return b;
  if (!b) return a;
  const t = Math.max(a.t, b.t), newer = b.t > a.t ? "b" : "a";
  const av = parse(a.v), bv = parse(b.v);
  // Lists (trophy moments, favourites, cards seen): keep everything from both
  if (Array.isArray(av) && Array.isArray(bv)) return { v: JSON.stringify([...av, ...bv.filter((x) => !av.some((y) => JSON.stringify(y) === JSON.stringify(x)))]), t };
  // A season pack: each picture keeps the faster time, and the most words found
  if (key.startsWith("mm-season-") && isObj(av) && isObj(bv)) {
    const ta = Array.isArray(av.times) ? av.times : [], tb = Array.isArray(bv.times) ? bv.times : [];
    const times = [0, 1, 2].map((k) => { const x = ta[k], y = tb[k]; return typeof x === "number" && typeof y === "number" ? Math.min(x, y) : typeof x === "number" ? x : typeof y === "number" ? y : null; });
    return { v: JSON.stringify({ times, saved: !!av.saved || !!bv.saved, found: Math.max(Number(av.found) || 0, Number(bv.found) || 0) }), t };
  }
  // Best scores: the higher one
  if (key.endsWith("-best") && Number.isFinite(Number(a.v)) && Number.isFinite(Number(b.v))) return { v: String(Math.max(Number(a.v), Number(b.v))), t };
  if (isObj(av) && isObj(bv)) {
    // A day's puzzle: the later day, then a finished game over an unfinished one, then the newer save
    if (typeof av.date === "string" && typeof bv.date === "string") {
      if (av.date !== bv.date) return av.date > bv.date ? { ...a, t } : { ...b, t };
      const ad = av.doneMs != null, bd = bv.doneMs != null;
      if (ad !== bd) return ad ? { ...a, t } : { ...b, t };
      return newer === "b" ? { ...b, t } : { ...a, t };
    }
    // Records like { stats: { easy: { won, lost } } }: the bigger count of each
    return { v: JSON.stringify(deep(av, bv, newer)), t };
  }
  return newer === "b" ? b : a;
}
/** Merge two whole blobs */
export function mergeBlobs(a: Blob, b: Blob): Blob {
  const out: Blob = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!synced(k)) continue;
    const m = mergeEntry(k, a[k], b[k]);
    if (m && typeof m.v === "string") out[k] = m;
  }
  // Past days in the archive only matter for a week; don't keep them for ever
  const cutoff = Date.now() - 10 * 86_400_000;
  for (const k of Object.keys(out)) { const d = k.match(/@(\d{4}-\d\d-\d\d)$/)?.[1]; if (d && Date.parse(d) < cutoff) delete out[k]; }
  return out;
}
/** Only well-formed entries for keys that sync */
export function clean(x: unknown): Blob {
  const out: Blob = {};
  if (!isObj(x)) return out;
  for (const [k, e] of Object.entries(x)) if (synced(k) && isObj(e) && typeof e.v === "string" && e.v.length < 60_000 && Number.isFinite(e.t)) out[k] = { v: e.v, t: Number(e.t) };
  return out;
}
