// Sends emails to guests, from "Moss & Moon":
//  - through Gmail when GMAIL_USER + GMAIL_APP_PASSWORD are set (free, reaches any address)
//  - through Resend when RESEND_API_KEY is set (with your own domain it reaches anyone;
//    without one, Resend only delivers to the address you signed up with)
// Without either, emails are only saved to the "outbox" table so you can preview
// them in the staff dashboard (Emails tab). Nothing breaks either way.
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import dns from "node:dns/promises";
import { connectedAddress, gmailApiReady, sendRaw } from "./gmailApi";
import { db } from "./db";
import { rupees, type QuoteLine } from "./pricing";
import { reportError } from "./errors";
import { icsText } from "./ics";

const SITE = () => process.env.SITE_URL || "http://localhost:3000";
const FROM = () => process.env.EMAIL_FROM || "Moss & Moon <onboarding@resend.dev>";
const NAME = () => process.env.EMAIL_NAME || "Moss & Moon";

/**
 * Which service sends: Resend with your own domain first, then the connected Gmail (over
 * Gmail's web API, which works on every host), then Gmail's mail server (needs the usual
 * email ports, which Railway's Hobby plan blocks), then Resend's test sender.
 */
export function emailProvider(): "resend" | "gmail-api" | "gmail" | null {
  const resend = !!process.env.RESEND_API_KEY;
  const smtp = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  if (resend && !FROM().includes("resend.dev")) return "resend"; // a verified domain reaches everyone
  if (gmailApiReady()) return "gmail-api";
  if (smtp) return "gmail";
  return resend ? "resend" : null;
}
export const sendingAddress = () => (emailProvider() === "gmail-api" ? connectedAddress() : emailProvider() === "gmail" ? process.env.GMAIL_USER ?? null : null);

/** The finished email as raw bytes (for Gmail's API) */
async function buildRaw(msg: { from: { name: string; address: string }; to: string; subject: string; html: string; attachments: { filename: string; content: Buffer }[]; headers?: Record<string, string> }) {
  const t = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "windows" });
  const info = await t.sendMail(msg);
  return info.message as Buffer;
}
export const emailMode = () => (emailProvider() ? "live" : "preview");

let mailer: { t: Transporter; ip: string; at: number } | null = null;
/**
 * Gmail's mail server, always over IPv4: Railway can't reach IPv6 addresses, and Gmail's name
 * often looks up to one first ("connect ENETUNREACH 2607:…"). We look up the IPv4 address
 * ourselves and keep checking Gmail's certificate against smtp.gmail.com.
 */
async function gmail() {
  // (The automated tests swap in a pretend mail server that just records the message)
  if (process.env.SMTP_TEST_JSON === "1") return (mailer ??= { t: nodemailer.createTransport({ jsonTransport: true }), ip: "", at: Date.now() }).t;
  if (mailer && Date.now() - mailer.at < 10 * 60_000) return mailer.t;
  const [ip] = await dns.resolve4("smtp.gmail.com");
  mailer = {
    ip,
    at: Date.now(),
    t: nodemailer.createTransport({
      host: ip,
      port: 465,
      secure: true,
      tls: { servername: "smtp.gmail.com" },
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "") },
      connectionTimeout: 15_000,
    }),
  };
  return mailer.t;
}

export type Attachment = { filename: string; content: Uint8Array };

export async function sendEmail(to: string, subject: string, body: string, attachments: Attachment[] = [], opts: { skipErrorReport?: boolean; headers?: Record<string, string> } = {}): Promise<boolean> {
  if (!to) return false;
  const html = layout(subject, body);
  const row = db.prepare("INSERT INTO outbox (to_email, subject, html, status) VALUES (?, ?, ?, ?)").run(to, subject, html, emailMode() === "live" ? "sending" : "preview only");
  if (emailMode() !== "live") return true; // preview mode: saved in the outbox
  const outbox = Number(row.lastInsertRowid);
  if (emailProvider() === "gmail-api") {
    try {
      const raw = await buildRaw({
        from: { name: NAME(), address: connectedAddress()! },
        to,
        subject,
        html,
        attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content) })),
        headers: opts.headers,
      });
      await sendRaw(raw);
      db.prepare("UPDATE outbox SET status = 'sent', error = NULL WHERE id = ?").run(outbox);
      return true;
    } catch (e) {
      const err = String(e instanceof Error ? e.message : e).slice(0, 300);
      db.prepare("UPDATE outbox SET status = 'failed', error = ? WHERE id = ?").run(err, outbox);
      if (!opts.skipErrorReport) reportError("email", `Email didn't send (Gmail): ${err}`, `to: ${to}\nsubject: ${subject}`);
    }
    return false;
  }
  if (emailProvider() === "gmail") {
    try {
      await (await gmail()).sendMail({
        from: { name: NAME(), address: process.env.GMAIL_USER! },
        to,
        subject,
        html,
        attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content) })),
        headers: opts.headers,
      });
      db.prepare("UPDATE outbox SET status = 'sent', error = NULL WHERE id = ?").run(outbox);
      return true;
    } catch (e) {
      mailer = null; // look the address up again next time
      const err = String(e instanceof Error ? e.message : e).slice(0, 300);
      db.prepare("UPDATE outbox SET status = 'failed', error = ? WHERE id = ?").run(err, outbox);
      if (!opts.skipErrorReport) reportError("email", `Email didn't send (Gmail): ${err}`, `to: ${to}\nsubject: ${subject}`);
    }
    return false;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM(), to, subject, html,
        ...(attachments.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) } : {}),
        ...(opts.headers ? { headers: opts.headers } : {}),
      }),
    });
    const ok = r.ok;
    const err = ok ? null : (await r.text()).slice(0, 300);
    db.prepare("UPDATE outbox SET status = ?, error = ? WHERE id = ?").run(ok ? "sent" : "failed", err, Number(row.lastInsertRowid));
    if (!ok && !opts.skipErrorReport) reportError("email", `Email didn't send: ${err}`, `to: ${to}\nsubject: ${subject}`);
    return ok;
  } catch (e) {
    db.prepare("UPDATE outbox SET status = 'failed', error = ? WHERE id = ?").run(String(e).slice(0, 300), Number(row.lastInsertRowid));
    if (!opts.skipErrorReport) reportError("email", `Email didn't send: ${String(e)}`, `subject: ${subject}`);
    return false;
  }
}

/** Send without making the customer wait for it */
export const sendLater = (to: string, subject: string, body: string, attachments?: Attachment[]) => void sendEmail(to, subject, body, attachments).catch(() => {});

// ---------- templates ----------
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The branded email wrapper (exported for previews in the admin page) */
export function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5ece4;font-family:Helvetica,Arial,sans-serif;color:#3b2720">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;font-family:Georgia,serif;font-size:28px;margin-bottom:20px">Moss <i style="color:#c25b78">&amp;</i> Moon</div>
    <div style="background:#fffaf6;border-radius:20px;padding:28px;border:1px solid #ead9cc">
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 14px">${esc(title)}</h1>
      ${body}
    </div>
    <p style="text-align:center;color:#8a6a5c;font-size:12px;margin-top:18px">14 Willow Lane · made with oat milk &amp; love</p>
  </div></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:22px 0 4px"><a href="${href}" style="background:#5a3a2c;color:#fffaf6;padding:12px 22px;border-radius:999px;text-decoration:none;display:inline-block">${esc(label)}</a></p>`;
const codeBox = (code: string) =>
  `<p style="font-family:monospace;font-size:22px;letter-spacing:3px;background:#fadbe3;display:inline-block;padding:8px 16px;border-radius:10px;margin:8px 0">${esc(code)}</p>`;

export function orderPlacedEmail(o: { code: string; name: string; lines: QuoteLine[]; total: number; pickup: string; paid: boolean; ready?: string; table?: number | null; delivery?: string | null }) {
  const rows = o.lines.map((l) => `<tr><td style="padding:6px 0">${l.qty} × ${esc(l.name)}${l.note ? `<br><small style="color:#8a6a5c">${esc(l.note)}</small>` : ""}</td><td style="text-align:right">${rupees(l.total)}</td></tr>`).join("");
  const when = o.ready ?? (o.pickup === "asap" ? "as soon as possible" : o.pickup);
  const where = o.delivery
    ? `On its way to <b>${esc(o.delivery)}</b> by <b>${esc(when)}</b>.`
    : o.table
      ? `We'll bring it to <b>table ${o.table}</b> at <b>${esc(when)}</b>.`
      : `Ready to pick up at <b>${esc(when)}</b>.`;
  return [
    `Order confirmed, ${o.name} ☕ ${o.delivery ? "Arriving" : "Ready"} ${o.ready ? `at ${o.ready.replace(/^about /, "~")}` : "soon"}`,
    `<p>We've got your order and it's in the queue. ${where}</p>
     <p style="color:#8a6a5c;font-size:13px;margin-top:-4px">We'll email you again the moment it's ready.</p>
     ${codeBox(o.code)}
     <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px">${rows}
     <tr><td style="padding-top:10px;border-top:1px dashed #ead9cc"><b>${o.paid ? "Paid" : "Pay at pickup"}</b></td><td style="text-align:right;padding-top:10px;border-top:1px dashed #ead9cc"><b>${rupees(o.total)}</b></td></tr></table>
     ${button(`${SITE()}/order/${o.code}`, "Track your order")}`,
  ] as const;
}

export function orderReadyEmail(o: { code: string; name: string; table_no?: number | null; delivery_address?: string | null }): readonly [string, string] {
  if (o.delivery_address)
    return [`Your order is on its way, ${o.name} 🛵`, `<p>It's left the café and should be with you in about 20 minutes. Keep your phone close!</p>${codeBox(o.code)}${button(`${SITE()}/order/${o.code}`, "Track it")}`] as const;
  if (o.table_no)
    return [`Your order is ready, ${o.name} 🌸`, `<p>We're bringing it to <b>table ${o.table_no}</b> right now.</p>${codeBox(o.code)}`] as const;
  return [`Your order is ready, ${o.name} 🌸`, `<p>Come grab it from the pink counter while it's fresh. Show this code:</p>${codeBox(o.code)}${button(`${SITE()}/order/${o.code}`, "View order")}`] as const;
}

export function pickupReminderEmail(o: { code: string; name: string; lines: QuoteLine[] }) {
  return [
    `Your ${o.lines[0]?.name ?? "order"} is waiting for you ☕`,
    `<p>Hi ${esc(o.name)}, your order has been ready for a little while and we'd love you to have it while it's at its best.</p>
     ${codeBox(o.code)}
     <p style="color:#8a6a5c;font-size:13px">Running late? No problem, we'll keep it safe at the pink counter. Iced drinks may need fresh ice; just ask.</p>
     ${button(`${SITE()}/order/${o.code}`, "View order")}`,
  ] as const;
}

export function bookingEmail(b: { code: string; name: string; date: string; time: string; guests: number; table?: number | null; preorder?: string[]; preorderTotal?: number; branch?: string; address?: string }) {
  const when = new Date(b.date + "T00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const pre = b.preorder?.length
    ? `<p style="margin:12px 0 4px"><b>Ready when you arrive:</b></p><ul style="margin:0;padding-left:20px">${b.preorder.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p style="color:#8a6a5c;font-size:13px;margin-top:4px">About ₹${(b.preorderTotal ?? 0).toLocaleString("en-IN")}, paid at the café. We start making it 15 minutes before your booking.</p>`
    : "";
  return [`Your table is booked, ${b.name} ✿ ${when}, ${b.time}`, `<p>${b.table ? `Table <b>${b.table}</b>` : "Table"} for <b>${b.guests}</b> on <b>${when}</b> at <b>${b.time}</b>${b.branch ? ` at <b>${esc(b.branch)}</b>${b.address ? ` (${esc(b.address)})` : ""}` : ""}.${b.table ? "" : " We'll keep the window seat warm if we can."}</p>${pre}${codeBox(b.code)}<p style="color:#8a6a5c;font-size:13px">Show this code when you arrive. The attached invite adds it to your calendar, and we'll send a reminder on the day. Need to change plans? Just call us.</p>`] as const;
}

export function bookingReminderEmail(b: { code: string; name: string; time: string; guests: number }) {
  return [
    `See you at ${b.time} today, ${b.name} 🌿`,
    `<p>Just a little reminder: your table for <b>${b.guests}</b> is booked for <b>${esc(b.time)}</b> today at 14 Willow Lane.</p>${codeBox(b.code)}
     <p style="color:#8a6a5c;font-size:13px">Can't make it? Please call so someone on the waitlist can have the table.</p>`,
  ] as const;
}

/** A calendar invite (.ics) for a booking, so it shows up in Google/Apple/Outlook calendars */
export function bookingInvite(b: { code: string; name: string; date: string; time: string; guests: number }) {
  const ics = icsText({ uid: b.code, title: `Table for ${b.guests} at Moss & Moon`, date: b.date, time: b.time, minutes: 90, details: `Booking ${b.code}. Show this code when you arrive.`, alarmMinutes: 60 });
  return { filename: `moss-and-moon-${b.code}.ics`, content: new TextEncoder().encode(ics) };
}

export function rsvpEmail(e: { title: string; date: string; time: string; name: string }) {
  const when = new Date(`${e.date}T${e.time}`).toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  return [`You're on the list ✿`, `<p>Hi ${esc(e.name)}, you've got a spot at <b>${esc(e.title)}</b> on <b>${when}</b>. See you there!</p>`] as const;
}

export function eventReminderEmail(e: { title: string; date: string; time: string; name: string; qty: number; code: string }) {
  const when = new Date(`${e.date}T${e.time}`).toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  return [`See you tomorrow at ${e.title} ✿`, `<p>Hi ${esc(e.name)}, just a reminder: <b>${esc(e.title)}</b> is tomorrow, <b>${when}</b>. You have ${e.qty === 1 ? "one place" : `${e.qty} places`}.</p>${codeBox(e.code)}<p style="color:#8a6a5c;font-size:13px">Show this code when you arrive.</p>`] as const;
}

export function welcomeEmail() {
  return [`Welcome to the Pink Post 💌`, `<p>One cosy email a month: new drinks, events and secret codes. Here's your first one, for 15% off orders over ₹500:</p>${codeBox("PINKMOON")}${button(`${SITE()}/#menu`, "See the menu")}`] as const;
}

export function giftCardEmail(gc: { code: string; amount: number; from_name: string; to_name: string; message: string | null }) {
  return [
    `${gc.from_name} sent you a gift card 🎁`,
    `<p>Hi ${esc(gc.to_name)}! ${esc(gc.from_name)} sent you <b>${rupees(gc.amount)}</b> to spend at Moss &amp; Moon.</p>
     ${gc.message ? `<p style="font-family:Georgia,serif;font-style:italic;font-size:18px;border-left:3px solid #e391a8;padding-left:12px">“${esc(gc.message)}”</p>` : ""}
     ${codeBox(gc.code)}<p style="color:#8a6a5c;font-size:13px">Enter this code at checkout. Any leftover balance stays on the card.</p>
     ${button(`${SITE()}/#menu`, "Treat yourself")}`,
  ] as const;
}

export function loginCodeEmail(code: string) {
  return [`Your Moss & Moon sign-in code: ${code}`, `<p>Here's your code to sign in. It works for 10 minutes.</p>${codeBox(code)}<p style="color:#8a6a5c;font-size:13px">Didn't ask for this? You can ignore this email.</p>`] as const;
}

export function referralRewardEmail() {
  return [`Your friend just had their first coffee 💝`, `<p>Someone you invited placed their first order, so we've added <b>₹100 credit</b> to your account. It comes off your next order automatically.</p>${button(`${SITE()}/#menu`, "Spend it")}`] as const;
}

export function waitlistEmail(w: { name: string; date: string; time: string }) {
  const when = new Date(w.date + "T00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  return [`A table just opened up, ${w.name} ✿`, `<p>Good news: a table freed up on <b>${when}</b> at <b>${esc(w.time)}</b>. It's first come, first served, so book it soon!</p>${button(`${SITE()}/#visit`, "Book it now")}`] as const;
}

export function ticketEmail(t: { code: string; name: string; qty: number; title: string; date: string; time: string; package?: string | null }) {
  const when = new Date(`${t.date}T${t.time}`).toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  return [
    `Your ticket${t.qty > 1 ? "s" : ""} for ${t.title} 🎟`,
    `<p>Hi ${esc(t.name)}! You're coming to <b>${esc(t.title)}</b> on <b>${when}</b>${t.qty > 1 ? ` with <b>${t.qty} tickets</b>` : ""}.</p>${t.package ? `<p>Your package: <b>${esc(t.package)}</b>. Show your ticket at the counter for it.</p>` : ""}
     ${codeBox(t.code)}
     <p style="color:#8a6a5c;font-size:13px">Show the QR code on your ticket page at the door.</p>
     ${button(`${SITE()}/ticket/${t.code}`, "Open my ticket")}`,
  ] as const;
}

export function refundEmail(r: { code: string; name: string; amount: number; reason: string }) {
  return [
    `Your refund of ${rupees(r.amount)} is on its way`,
    `<p>Hi ${esc(r.name)}, we've refunded <b>${rupees(r.amount)}</b> for order <b>${esc(r.code)}</b>.${r.reason ? ` (${esc(r.reason)})` : ""}</p>
     <p style="color:#8a6a5c;font-size:13px">It usually reaches your bank, card or UPI app in 5 to 7 working days. Sorry for the trouble, and we hope to see you again soon ✿</p>`,
  ] as const;
}

export function receiptEmail(o: { code: string; name: string }) {
  return [
    `Your Moss & Moon receipt (${o.code})`,
    `<p>Thanks for visiting, ${esc(o.name)}! Your receipt is attached as a PDF.</p>${button(`${SITE()}/?reorder=${o.code}`, "Order the same again")}
     <p style="margin:6px 0"><a href="${SITE()}/order/${o.code}" style="color:#8a6a5c">View this order</a></p>
     <p style="color:#8a6a5c;font-size:13px">Loved it? A quick review makes our day ✿</p>`,
  ] as const;
}

export function drinkGiftEmail(g: { code: string; item_name: string; from_name: string; to_name: string; message: string | null; expires: string }) {
  return [
    `${g.from_name} bought you a ${g.item_name} ☕`,
    `<p>Hi ${esc(g.to_name)}! <b>${esc(g.from_name)}</b> has bought you a <b>${esc(g.item_name)}</b> at Moss &amp; Moon.</p>
     ${g.message ? `<p style="font-family:Georgia,serif;font-style:italic;font-size:18px;border-left:3px solid #e391a8;padding-left:12px">“${esc(g.message)}”</p>` : ""}
     <p>Claim it from the link whenever you like (until ${esc(g.expires)}), or show the QR code at the counter.</p>
     ${button(`${SITE()}/d/${g.code}`, "Open my drink")}`,
  ] as const;
}

export function drinkGiftSentEmail(g: { code: string; item_name: string; to_name: string }) {
  return [
    `Your gift for ${g.to_name} is ready to send 🎁`,
    `<p>You bought ${esc(g.to_name)} a <b>${esc(g.item_name)}</b>. If you haven't sent them the link yet, here it is:</p>
     ${button(`${SITE()}/d/${g.code}`, "The gift link")}<p style="color:#8a6a5c;font-size:13px">It's valid for 90 days.</p>`,
  ] as const;
}

export function passEmail(p: { ends: string }) {
  const until = new Date(p.ends + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long" });
  return [`Your Coffee Pass is active ☕`, `<p>One drink a day is on us until <b>${until}</b>. Just sign in when you order, and it comes off automatically.</p>${button(`${SITE()}/#menu`, "Order today's drink")}`] as const;
}


// ---------- catering ----------
type CateringMail = { code: string; name: string; event_date: string; event_time: string; guests: number; amount?: number | null; quote_note?: string | null };
const cateringWhen = (c: CateringMail) => `${new Date(c.event_date + "T12:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} at ${c.event_time}`;

export function cateringRequestEmail(c: CateringMail) {
  return [`We got your catering request, ${c.name} ✿`, `<p>Thank you! We'll look at your request for <b>${c.guests} guests</b> on <b>${esc(cateringWhen(c))}</b> and send a quote within a day.</p>${codeBox(c.code)}${button(`${SITE()}/catering/${c.code}`, "See your request")}`] as const;
}
export function cateringQuoteEmail(c: CateringMail) {
  return [`Your catering quote: ${rupees(c.amount ?? 0)}`, `<p>Hi ${esc(c.name)}, here's our quote for <b>${c.guests} guests</b> on <b>${esc(cateringWhen(c))}</b>:</p><p style="font-size:26px;font-family:Georgia,serif;margin:8px 0">${rupees(c.amount ?? 0)}</p>${c.quote_note ? `<p style="white-space:pre-line">${esc(c.quote_note)}</p>` : ""}${button(`${SITE()}/catering/${c.code}`, "Accept and pay")}<p style="color:#8a6a5c;font-size:13px">You can pay online now, or on the day. Questions? Just reply to this email.</p>`] as const;
}
export function cateringConfirmedEmail(c: CateringMail & { paid: boolean }) {
  return [`Catering confirmed for ${cateringWhen(c)} 🌸`, `<p>All set, ${esc(c.name)}! We'll have everything ready for your <b>${c.guests} guests</b> on <b>${esc(cateringWhen(c))}</b>.</p><p>${c.paid ? `<b>${rupees(c.amount ?? 0)} paid</b>. Thank you!` : `<b>${rupees(c.amount ?? 0)}</b> to pay on the day.`}</p>${codeBox(c.code)}${button(`${SITE()}/catering/${c.code}`, "View booking")}`] as const;
}
