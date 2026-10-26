// One-off trophy moments (like beating par in Flood), kept in this browser. Client only.
export const FLAGS_KEY = "mm-trophy-flags";
export function readFlags(): string[] {
  try { const v = JSON.parse(localStorage.getItem(FLAGS_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
export function addFlag(f: string) {
  try { const v = readFlags(); if (!v.includes(f)) localStorage.setItem(FLAGS_KEY, JSON.stringify([...v, f])); } catch {}
}
/** Past days finished from the puzzle archive (they're saved under "key@day") */
function archiveDone() {
  try { return Object.keys(localStorage).filter((k) => /@\d{4}-\d\d-\d\d$/.test(k)).filter((k) => { try { return JSON.parse(localStorage.getItem(k) ?? "null")?.doneMs != null; } catch { return false; } }).length; } catch { return 0; }
}
/** Everything the trophy shelf needs from this browser */
export function localTrophyStats() {
  const get = (k: string) => { try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; } };
  return {
    reversi: get("mm-reversi")?.stats, saucers: get("mm-saucers")?.stats, mancala: get("mm-mancala")?.stats, draughts: get("mm-draughts")?.stats, dots: get("mm-dots")?.stats, gomoku: get("mm-gomoku")?.stats, morris: get("mm-morris")?.stats, archive: archiveDone(),
    tray: Object.keys(get("mm-tray")?.best ?? {}).length, jam: Object.keys(get("mm-jam")?.best ?? {}).length,
    patience: get("mm-patience") ?? undefined, flags: readFlags(),
  };
}
