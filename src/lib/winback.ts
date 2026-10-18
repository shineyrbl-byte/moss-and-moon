// "We miss you": regulars who haven't been in for a while get a friendly email with a one-off code
import "server-only";
import { db, getSetting, makeCode } from "./db";
import { sendEmail } from "./email";
import { unsubUrl } from "./newsletter";
import { toDateStr } from "./cafe";

export const WINBACK = { afterDays: 30, maxDays: 120, minOrders: 2, off: 15, validDays: 14, everyDays: 90, perRun: 20 };
export const winbackOn = () => getSetting("winback") !== "off";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const SITE = () => process.env.SITE_URL || "http://localhost:3000";

/** Regulars (2+ orders) whose last visit was 30–120 days ago and who haven't had one of these lately */
export function winbackCandidates(limit = WINBACK.perRun) {
  return db.prepare(
    `SELECT lower(o.email) AS email, MAX(o.name) AS name, COUNT(*) AS orders, MAX(o.created_at) AS last
     FROM orders o
     WHERE o.email IS NOT NULL AND o.email != '' AND o.status != 'cancelled'
     GROUP BY lower(o.email)
     HAVING COUNT(*) >= ? AND MAX(o.created_at) <= datetime('now','localtime', ?) AND MAX(o.created_at) >= datetime('now','localtime', ?)
       AND lower(o.email) NOT IN (SELECT email FROM no_marketing)
       AND lower(o.email) NOT IN (SELECT email FROM subscribers WHERE unsubscribed_at IS NOT NULL)
       AND lower(o.email) NOT IN (SELECT email FROM winbacks WHERE sent_at >= datetime('now','localtime', ?))
     ORDER BY last DESC LIMIT ?`,
  ).all(WINBACK.minOrders, `-${WINBACK.afterDays} days`, `-${WINBACK.maxDays} days`, `-${WINBACK.everyDays} days`, limit) as { email: string; name: string; orders: number; last: string }[];
}

export async function sendWinback(g: { email: string; name: string }) {
  const code = makeCode("MISS", 5);
  const expires = toDateStr(new Date(Date.now() + WINBACK.validDays * 86_400_000));
  db.prepare("INSERT INTO promos (code, kind, value, max_uses, once_per_guest, expires, note) VALUES (?, 'percent', ?, 1, 1, ?, ?)").run(code, WINBACK.off, expires, `We miss you: ${g.email}`);
  db.prepare("INSERT INTO winbacks (email, code) VALUES (?, ?)").run(g.email, code);
  const first = (g.name || "there").split(" ")[0];
  await sendEmail(
    g.email,
    `We miss you, ${first} ☕`,
    `<p>It's been a little while! Your usual spot by the window is still here, and so are we.</p>
     <p>Here's <b>${WINBACK.off}% off</b> your next order, any time in the next two weeks:</p>
     <p style="font-family:monospace;font-size:22px;letter-spacing:3px;background:#fadbe3;display:inline-block;padding:8px 16px;border-radius:10px">${esc(code)}</p>
     <p><a href="${SITE()}/#menu">See what's new on the menu</a></p>
     <p style="margin-top:22px;color:#8a6a5c;font-size:12px">Don't want emails like this? <a href="${unsubUrl(g.email)}" style="color:#8a6a5c">Unsubscribe</a></p>`,
    [],
    { headers: { "List-Unsubscribe": `<${unsubUrl(g.email)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } },
  );
}

/** Called every hour: sends a few, in the daytime */
export async function winbackTick(now = new Date()) {
  if (!winbackOn() || now.getHours() < 10 || now.getHours() >= 18) return;
  for (const g of winbackCandidates()) await sendWinback(g);
}

/** For the owner: how it's going over the last 90 days */
export function winbackStats() {
  const r = db.prepare(
    `SELECT COUNT(*) AS sent, COALESCE(SUM(CASE WHEN p.uses > 0 THEN 1 ELSE 0 END), 0) AS back
     FROM winbacks w LEFT JOIN promos p ON p.code = w.code WHERE w.sent_at >= datetime('now','localtime','-90 days')`,
  ).get() as { sent: number; back: number };
  return { on: winbackOn(), ...r, waiting: winbackCandidates(200).length, rules: WINBACK };
}
