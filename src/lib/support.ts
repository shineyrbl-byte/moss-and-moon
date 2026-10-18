// "Talk to a person": guests chat with whoever is on shift, from the barista chat
import "server-only";
import crypto from "node:crypto";
import { db, makeCode } from "./db";
import { publish } from "./live";
import { sendEmail } from "./email";

export type SupportMessage = { id: number; sender: "guest" | "staff" | "system"; staff_name: string | null; text: string; created_at: string };
export type SupportChat = { code: string; token: string; name: string; email: string | null; status: "open" | "closed"; context: string | null; guest_seen_at: string | null; staff_seen_id: number; emailed_id: number; created_at: string; last_at: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const getChat = (code: string) => (db.prepare("SELECT * FROM support_chats WHERE code = ?").get(code.toUpperCase()) as SupportChat | undefined) ?? null;
export const chatToken = (code: string) => getChat(code)?.token ?? null;
/** Constant-time check of the guest's secret for their chat */
export function guestOwns(c: SupportChat | null, token: unknown): boolean {
  if (!c || typeof token !== "string" || token.length !== c.token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(c.token));
}

export const messages = (code: string, after = 0) =>
  db.prepare("SELECT id, sender, staff_name, text, created_at FROM support_messages WHERE chat_code = ? AND id > ? ORDER BY id LIMIT 300").all(code, after) as SupportMessage[];

export function addMessage(code: string, sender: SupportMessage["sender"], text: string, staffName: string | null = null) {
  const r = db.prepare("INSERT INTO support_messages (chat_code, sender, staff_name, text) VALUES (?, ?, ?, ?)").run(code, sender, staffName, text);
  db.prepare("UPDATE support_chats SET last_at = datetime('now','localtime'), status = CASE WHEN ? = 'guest' THEN 'open' ELSE status END WHERE code = ?").run(sender, code);
  publish({ type: "support", code });
  return Number(r.lastInsertRowid);
}

export function startChat(name: string, email: string | null, context: string | null, first: string) {
  const code = makeCode("HC", 6);
  const token = crypto.randomBytes(18).toString("base64url");
  db.prepare("INSERT INTO support_chats (code, token, name, email, context) VALUES (?, ?, ?, ?, ?)").run(code, token, name, email, context);
  addMessage(code, "guest", first);
  return { code, token };
}

/** Staff list: open chats first, with how many guest messages nobody on staff has read */
export function inbox() {
  return db.prepare(
    `SELECT c.code, c.name, c.email, c.status, c.last_at, c.created_at,
       (SELECT COUNT(*) FROM support_messages m WHERE m.chat_code = c.code AND m.sender = 'guest' AND m.id > c.staff_seen_id) AS unread,
       (SELECT text FROM support_messages m WHERE m.chat_code = c.code ORDER BY id DESC LIMIT 1) AS last_text
     FROM support_chats c WHERE c.status = 'open' OR c.last_at >= datetime('now','localtime','-1 day')
     ORDER BY c.status = 'open' DESC, c.last_at DESC LIMIT 50`,
  ).all() as { code: string; name: string; email: string | null; status: string; last_at: string; unread: number; last_text: string }[];
}

/** A staff reply when the guest has closed the page: email it to them (at most one email per 10 minutes) */
export async function emailIfAway(c: SupportChat, text: string, staffName: string, messageId: number, site: string) {
  if (!c.email) return;
  const seen = c.guest_seen_at ? new Date(c.guest_seen_at.replace(" ", "T")).getTime() : 0;
  if (Date.now() - seen < 60_000) return; // they're still looking at the chat
  const last = db.prepare("SELECT created_at FROM support_messages WHERE id = ?").get(c.emailed_id) as { created_at: string } | undefined;
  if (last && Date.now() - new Date(last.created_at.replace(" ", "T")).getTime() < 10 * 60_000) return;
  db.prepare("UPDATE support_chats SET emailed_id = ? WHERE code = ?").run(messageId, c.code);
  await sendEmail(c.email, `${staffName} from Moss & Moon replied`, `<p>Hi ${esc(c.name)}, you have a reply:</p><blockquote style="border-left:3px solid #e391a8;margin:10px 0;padding:4px 12px">${esc(text)}</blockquote><p><a href="${site}/?chat=${c.code}">Open the chat</a> or just reply to this email.</p>`);
}
