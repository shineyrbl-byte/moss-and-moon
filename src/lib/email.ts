// Sends emails through Resend (https://resend.com) when RESEND_API_KEY is set.
// Without a key, emails are only saved to the "outbox" table so you can
// preview them in the staff dashboard (Emails tab). Nothing breaks either way.
import "server-only";
import { db } from "./db";
import { rupees, type QuoteLine } from "./pricing";

const SITE = () => process.env.SITE_URL || "http://localhost:3000";
const FROM = () => process.env.EMAIL_FROM || "Moss & Moon <onboarding@resend.dev>";

export const emailMode = () => (process.env.RESEND_API_KEY ? "live" : "preview");

export type Attachment = { filename: string; content: Uint8Array };

export async function sendEmail(to: string, subject: string, body: string, attachments: Attachment[] = []) {
  if (!to) return;
  const html = layout(subject, body);
  const row = db.prepare("INSERT INTO outbox (to_email, subject, html, status) VALUES (?, ?, ?, ?)").run(to, subject, html, emailMode() === "live" ? "sending" : "preview only");
  if (emailMode() !== "live") return;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM(), to, subject, html,
        ...(attachments.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) } : {}),
      }),
    });
    const ok = r.ok;
    const err = ok ? null : (await r.text()).slice(0, 300);
    db.prepare("UPDATE outbox SET status = ?, error = ? WHERE id = ?").run(ok ? "sent" : "failed", err, Number(row.lastInsertRowid));
  } catch (e) {
    db.prepare("UPDATE outbox SET status = 'failed', error = ? WHERE id = ?").run(String(e).slice(0, 300), Number(row.lastInsertRowid));
  }
}

/** Send without making the customer wait for it */
export const sendLater = (to: string, subject: string, body: string, attachments?: Attachment[]) => void sendEmail(to, subject, body, attachments).catch(() => {});

// ---------- templates ----------
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function layout(title: string, body: string) {
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

export function orderPlacedEmail(o: { code: string; name: string; lines: QuoteLine[]; total: number; pickup: string; paid: boolean }) {
  const rows = o.lines.map((l) => `<tr><td style="padding:6px 0">${l.qty} × ${esc(l.name)}${l.note ? `<br><small style="color:#8a6a5c">${esc(l.note)}</small>` : ""}</td><td style="text-align:right">${rupees(l.total)}</td></tr>`).join("");
  return [
    `Thanks for your order, ${o.name}!`,
    `<p>We've got it and it's in the queue. Pickup: <b>${o.pickup === "asap" ? "as soon as possible" : esc(o.pickup)}</b>.</p>
     ${codeBox(o.code)}
     <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px">${rows}
     <tr><td style="padding-top:10px;border-top:1px dashed #ead9cc"><b>${o.paid ? "Paid" : "Pay at pickup"}</b></td><td style="text-align:right;padding-top:10px;border-top:1px dashed #ead9cc"><b>${rupees(o.total)}</b></td></tr></table>
     ${button(`${SITE()}/order/${o.code}`, "Track your order")}`,
  ] as const;
}

export function orderReadyEmail(o: { code: string; name: string }) {
  return [`Your order is ready, ${o.name} 🌸`, `<p>Come grab it from the pink counter. Show this code:</p>${codeBox(o.code)}${button(`${SITE()}/order/${o.code}`, "View order")}`] as const;
}

export function bookingEmail(b: { code: string; name: string; date: string; time: string; guests: number }) {
  const when = new Date(b.date + "T00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  return [`Your table is booked, ${b.name}`, `<p>Table for <b>${b.guests}</b> on <b>${when}</b> at <b>${b.time}</b>. We'll keep the window seat warm if we can.</p>${codeBox(b.code)}<p style="color:#8a6a5c;font-size:13px">Show this code when you arrive. Need to change plans? Just call us.</p>`] as const;
}

export function rsvpEmail(e: { title: string; date: string; time: string; name: string }) {
  const when = new Date(`${e.date}T${e.time}`).toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  return [`You're on the list ✿`, `<p>Hi ${esc(e.name)}, you've got a spot at <b>${esc(e.title)}</b> on <b>${when}</b>. See you there!</p>`] as const;
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

export function ticketEmail(t: { code: string; name: string; qty: number; title: string; date: string; time: string }) {
  const when = new Date(`${t.date}T${t.time}`).toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  return [
    `Your ticket${t.qty > 1 ? "s" : ""} for ${t.title} 🎟`,
    `<p>Hi ${esc(t.name)}! You're coming to <b>${esc(t.title)}</b> on <b>${when}</b>${t.qty > 1 ? ` with <b>${t.qty} tickets</b>` : ""}.</p>
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
    `<p>Thanks for visiting, ${esc(o.name)}! Your receipt is attached as a PDF.</p>${button(`${SITE()}/order/${o.code}`, "View your order")}
     <p style="color:#8a6a5c;font-size:13px">Loved it? A quick review makes our day ✿</p>`,
  ] as const;
}

export function passEmail(p: { ends: string }) {
  const until = new Date(p.ends + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long" });
  return [`Your Coffee Pass is active ☕`, `<p>One drink a day is on us until <b>${until}</b>. Just sign in when you order, and it comes off automatically.</p>${button(`${SITE()}/#menu`, "Order today's drink")}`] as const;
}

