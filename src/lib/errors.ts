// Error alerts: problems on the site are logged (grouped, with a count) and the
// owner gets an email the first time each one happens, at most once an hour.
import "server-only";
import crypto from "node:crypto";
import { db, getSetting, setSetting } from "./db";
import { ownerEmail, ownerPref } from "./owner";
import { toDateStr } from "./cafe";

const MAX_ALERTS_PER_DAY = 10;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Same problem = same place + same message (numbers and codes ignored) */
const signature = (source: string, message: string) =>
  crypto.createHash("sha1").update(source + "|" + message.replace(/[0-9a-f]{8,}|\d+/gi, "#").slice(0, 200)).digest("hex");

export function reportError(source: "server" | "browser" | "job" | "email" | "payments", message: string, detail = "") {
  try {
    const msg = (message || "Unknown error").slice(0, 300);
    const sig = signature(source, msg);
    db.prepare(
      `INSERT INTO error_log (signature, source, message, detail) VALUES (?, ?, ?, ?)
       ON CONFLICT(signature) DO UPDATE SET count = count + 1, last_at = datetime('now','localtime'), detail = excluded.detail`
    ).run(sig, source, msg, detail.slice(0, 2000));
    void maybeAlert(sig);
  } catch (e) {
    console.error("Couldn't log error", e); // never let error reporting break the site
  }
}

async function maybeAlert(sig: string) {
  if (!ownerPref("error_alerts") || !ownerEmail()) return;
  const row = db.prepare("SELECT source, message, detail, count, alerted_at FROM error_log WHERE signature = ?").get(sig) as
    | { source: string; message: string; detail: string; count: number; alerted_at: string | null }
    | undefined;
  if (!row) return;
  const recent = row.alerted_at && Date.now() - new Date(row.alerted_at.replace(" ", "T")).getTime() < 3_600_000;
  if (recent) return;
  const key = `alerts_${toDateStr(new Date())}`;
  const sent = Number(getSetting(key) ?? 0);
  if (sent >= MAX_ALERTS_PER_DAY) return;
  setSetting(key, String(sent + 1));
  db.prepare("UPDATE error_log SET alerted_at = datetime('now','localtime') WHERE signature = ?").run(sig);
  // Import here to avoid a loop (email.ts reports its own failures)
  const { sendEmail } = await import("./email");
  await sendEmail(
    ownerEmail(),
    `⚠️ Something went wrong on Moss & Moon (${row.source})`,
    `<p>The site hit a problem${row.count > 1 ? ` (${row.count} times so far)` : ""}:</p>
     <p style="font-family:monospace;background:#f6eee7;padding:10px;border-radius:8px;white-space:pre-wrap">${esc(row.message)}</p>
     ${row.detail ? `<p style="font-family:monospace;font-size:11px;color:#8a6a5c;white-space:pre-wrap">${esc(row.detail.slice(0, 900))}</p>` : ""}
     <p style="color:#8a6a5c;font-size:13px">You'll get at most one email per problem per hour. See every problem in Admin → Health.</p>`,
    [],
    { skipErrorReport: true }
  );
}

export function recentErrors() {
  return db.prepare("SELECT id, source, message, detail, count, first_at, last_at FROM error_log ORDER BY last_at DESC LIMIT 50").all();
}
export const clearErrors = () => db.prepare("DELETE FROM error_log").run();
