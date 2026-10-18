// The "Pink Post": write a newsletter in Admin, send a test to yourself, then send it to
// every subscriber, a few at a time in the background. Every email has a one-click unsubscribe.
import "server-only";
import crypto from "node:crypto";
import { db, getSetting, setSetting } from "./db";
import { sendEmail } from "./email";
import { renderMarkdown } from "./markdown";
import { askJSON, type JsonSchema } from "./ai";
import { listEvents } from "./eventsStore";
import { getMenu } from "./menuStore";
import { currentSeason } from "./seasonStore";
import { rupees } from "./pricing";

const SITE = () => (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const PER_TICK = 15; // emails per run (every 20 s), gentle on Gmail's daily limit

function secret() {
  let s = getSetting("unsub_secret");
  if (!s) {
    s = crypto.randomBytes(24).toString("hex");
    setSetting("unsub_secret", s);
  }
  return s;
}
export const unsubToken = (email: string) => crypto.createHmac("sha256", secret()).update(email.toLowerCase()).digest("hex").slice(0, 32);
export const unsubUrl = (email: string) => `${SITE()}/api/newsletter/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
export function unsubscribe(email: string, token: string) {
  const a = Buffer.from(unsubToken(email));
  const b = Buffer.from(String(token));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  db.prepare("UPDATE subscribers SET unsubscribed_at = COALESCE(unsubscribed_at, datetime('now','localtime')) WHERE email = ?").run(email.toLowerCase());
  return true;
}

export const activeSubscribers = () => (db.prepare("SELECT email FROM subscribers WHERE unsubscribed_at IS NULL ORDER BY created_at").all() as { email: string }[]).map((r) => r.email);

/** The newsletter body as email HTML, with the unsubscribe line for this reader */
export function newsletterHtml(body: string, email: string) {
  return `${renderMarkdown(body, { email: true })}
    <p style="margin-top:26px;color:#8a6a5c;font-size:12px">You're getting the Pink Post because you signed up at Moss &amp; Moon. <a href="${unsubUrl(email)}" style="color:#8a6a5c">Unsubscribe</a></p>`;
}

async function sendOne(subject: string, body: string, email: string) {
  return sendEmail(email, subject, newsletterHtml(body, email), [], {
    headers: { "List-Unsubscribe": `<${unsubUrl(email)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
}

export const sendTest = (n: { subject: string; body: string }, to: string) => sendOne(`[Test] ${n.subject}`, n.body, to);

/** Queue a newsletter for every current subscriber */
export function queue(id: number) {
  const subs = activeSubscribers();
  const add = db.prepare("INSERT OR IGNORE INTO newsletter_sends (newsletter_id, email) VALUES (?, ?)");
  for (const e of subs) add.run(id, e);
  db.prepare("UPDATE newsletters SET status = 'sending', recipients = ? WHERE id = ?").run(subs.length, id);
  return subs.length;
}

/** Background job: send the next few queued emails */
export async function newsletterTick() {
  const n = db.prepare("SELECT id, subject, body FROM newsletters WHERE status = 'sending' ORDER BY id LIMIT 1").get() as { id: number; subject: string; body: string } | undefined;
  if (!n) return;
  const batch = db.prepare("SELECT email FROM newsletter_sends WHERE newsletter_id = ? AND status = 'queued' LIMIT ?").all(n.id, PER_TICK) as { email: string }[];
  for (const { email } of batch) {
    // Someone may have unsubscribed after it was queued
    const still = db.prepare("SELECT 1 FROM subscribers WHERE email = ? AND unsubscribed_at IS NULL").get(email);
    const ok = still ? await sendOne(n.subject, n.body, email) : false;
    db.prepare("UPDATE newsletter_sends SET status = ? WHERE newsletter_id = ? AND email = ?").run(still ? (ok ? "sent" : "failed") : "skipped", n.id, email);
    db.prepare(`UPDATE newsletters SET ${ok ? "sent_count" : "failed_count"} = ${ok ? "sent_count" : "failed_count"} + 1 WHERE id = ?`).run(n.id);
  }
  const left = (db.prepare("SELECT COUNT(*) AS n FROM newsletter_sends WHERE newsletter_id = ? AND status = 'queued'").get(n.id) as { n: number }).n;
  if (!left) db.prepare("UPDATE newsletters SET status = 'sent', sent_at = datetime('now','localtime') WHERE id = ?").run(n.id);
}

/** A first draft from an idea, using what's new at the café (AI if set up, else a simple template) */
export async function draft(idea: string) {
  const menu = getMenu();
  const events = listEvents({ upcoming: true }).slice(0, 4);
  const news = menu.filter((m) => m.badge === "new" || m.season).slice(0, 4);
  const season = currentSeason();
  const facts = {
    idea,
    season,
    newOnTheMenu: news.map((m) => `${m.name}: ${m.desc} (${rupees(m.price)})`),
    upcomingEvents: events.map((e) => `${e.title} on ${e.date} at ${e.time}${e.price ? `, ${rupees(e.price)}` : ", free"}: ${e.desc}`),
    menuLink: `${SITE()}/#menu`,
    eventsLink: `${SITE()}/#events`,
  };
  const schema: JsonSchema = {
    type: "object",
    properties: {
      subject: { type: "string", description: "Warm, short subject line (under 60 characters)" },
      body: { type: "string", description: "The newsletter in simple marks: '## ' headings, **bold**, [links](url), '- ' lists, blank lines between paragraphs. 120–220 words." },
    },
    required: ["subject", "body"],
  };
  const ai = await askJSON<{ subject: string; body: string }>(
    "You write the monthly email newsletter for Moss & Moon, a cosy café with plants, pink lattes and warm bakes. Friendly, playful and brief, a little ✿ or ☕ is fine. Only mention things from the facts given. End with a gentle invitation to visit or order.",
    JSON.stringify(facts, null, 1),
    schema
  );
  if (ai) return { ...ai.data, by: ai.provider };
  const lines = [
    `Hello lovely ✿`,
    idea ? idea : "Here's what's brewing at Moss & Moon this month.",
    ...(news.length ? ["## New on the menu", news.map((m) => `- **${m.name}**: ${m.desc}`).join("\n")] : []),
    ...(events.length ? ["## Coming up", events.map((e) => `- **${e.title}**, ${new Date(e.date + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "long" })}${e.price ? ` (${rupees(e.price)})` : " (free)"}`).join("\n"), `[See all events](${SITE()}/#events)`] : []),
    `Pop in, or [order ahead](${SITE()}/#menu) and we'll have it ready ☕`,
    "With love,\nThe Moss & Moon team",
  ];
  return { subject: news[0] ? `New at Moss & Moon: ${news[0].name} ✿` : "This month at Moss & Moon ✿", body: lines.join("\n\n"), by: "simple" };
}
