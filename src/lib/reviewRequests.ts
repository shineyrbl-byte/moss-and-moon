// "How was it?" emails: a couple of hours after an order is collected, guests who
// left an email get one friendly ask for a review (at most once every 2 weeks).
import "server-only";
import { db } from "./db";
import { sendEmail } from "./email";
import { demoBaristaOn } from "./orderFlow";
import type { QuoteLine } from "./pricing";

const SITE = () => process.env.SITE_URL || "http://localhost:3000";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function reviewAskEmail(o: { code: string; name: string; lines: QuoteLine[] }) {
  const first = o.lines[0]?.name ?? "visit";
  const stars = [5, 4, 3, 2, 1]
    .map((n) => `<a href="${SITE()}/review/${o.code}?stars=${n}" style="font-size:30px;text-decoration:none;color:#e0a43a;padding:0 3px" title="${n} stars">${"★".repeat(n)}</a>`)
    .join("<br>");
  return [
    `How was your ${first}? ☕`,
    `<p>Hi ${esc(o.name)}! Thanks for coming in today. How was it? Tap the stars to tell us:</p>
     <p style="line-height:1.4">${stars}</p>
     <p style="color:#8a6a5c;font-size:13px">It takes ten seconds and really helps a small café. Not a great visit? Tell us too, we read every one.</p>`,
  ] as const;
}

/** Called every minute: ask about orders collected 2+ hours ago (daytime only).
 * While the demo barista runs the café (a demo or test), it asks after 20 minutes instead. */
export async function reviewTick(now = new Date()) {
  if (now.getHours() < 9 || now.getHours() >= 21) return;
  const wait = demoBaristaOn() ? 20 : 120;
  const due = db
    .prepare(
      `SELECT code, name, email, lines FROM orders
       WHERE status = 'collected' AND review_asked = 0 AND email IS NOT NULL
         AND COALESCE(collected_at, created_at) <= datetime('now','localtime','-${wait} minutes')
         AND created_at >= datetime('now','localtime','-2 days')
       ORDER BY id LIMIT 20`
    )
    .all() as { code: string; name: string; email: string; lines: string }[];
  for (const o of due) {
    // Once every 14 days per email, and never if they already reviewed this order
    const recent = db
      .prepare("SELECT 1 FROM orders WHERE email = ? AND review_asked = 1 AND created_at >= datetime('now','localtime','-14 days')")
      .get(o.email);
    const reviewed = db.prepare("SELECT 1 FROM reviews WHERE order_code = ?").get(o.code);
    if (recent || reviewed) {
      db.prepare("UPDATE orders SET review_asked = 2 WHERE code = ?").run(o.code);
      continue;
    }
    db.prepare("UPDATE orders SET review_asked = 1 WHERE code = ?").run(o.code);
    await sendEmail(o.email, ...reviewAskEmail({ ...o, lines: JSON.parse(o.lines) }));
  }
}
