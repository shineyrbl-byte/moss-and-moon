// Digital postcards from the café: pick a design, write a note, share the link.
// A paid, unclaimed gifted drink can ride along. Nothing is emailed, so it can't be used to spam.
import "server-only";
import crypto from "node:crypto";
import { db, cleanText } from "./db";

export const DESIGNS = ["rose", "moon", "monsoon", "sunny"] as const;
export type Design = (typeof DESIGNS)[number];
const BAD = /\b(fuck|shit|bitch|cunt|porn|nazi|chutiya|madarchod|bhenchod|gandu)\b/i;

export function makePostcard(b: Record<string, unknown>) {
  const design = DESIGNS.includes(b.design as Design) ? (b.design as Design) : "rose";
  const from = cleanText(b.from, 30).replace(/[<>]/g, "");
  const to = cleanText(b.to, 30).replace(/[<>]/g, "");
  const message = cleanText(b.message, 280).replace(/[<>]/g, "");
  if (!from || !to) return { error: "Add who it's to and who it's from." };
  if (message.length < 3) return { error: "Write a little note first." };
  if ([from, to, message].some((x) => BAD.test(x))) return { error: "Let's keep it kind ✿" };
  let gift: string | null = null;
  if (b.gift) {
    const g = String(b.gift).trim().replace(/^.*\/d\//, "").replace(/[?#].*$/, "").toUpperCase();
    const row = db.prepare("SELECT code, paid, redeemed_at FROM drink_gifts WHERE upper(code) = ?").get(g) as { code: string; paid: number; redeemed_at: string | null } | undefined;
    if (!row || !row.paid) return { error: "We couldn't find a paid gifted drink with that code." };
    if (row.redeemed_at) return { error: "That gifted drink has already been claimed." };
    gift = row.code;
  }
  const code = crypto.randomBytes(6).toString("base64url");
  db.prepare("INSERT INTO postcards (code, design, from_name, to_name, message, gift_code) VALUES (?, ?, ?, ?, ?, ?)").run(code, design, from, to, message, gift);
  return { ok: true as const, code };
}

export function getPostcard(code: string) {
  const p = db.prepare("SELECT code, design, from_name, to_name, message, gift_code, created_at FROM postcards WHERE code = ?").get(code) as { code: string; design: Design; from_name: string; to_name: string; message: string; gift_code: string | null; created_at: string } | undefined;
  if (!p) return null;
  const gift = p.gift_code ? (db.prepare("SELECT code, item_name, redeemed_at FROM drink_gifts WHERE code = ?").get(p.gift_code) as { code: string; item_name: string; redeemed_at: string | null } | undefined) : undefined;
  return { code: p.code, design: p.design, from: p.from_name, to: p.to_name, message: p.message, date: p.created_at.slice(0, 10), gift: gift ? { code: gift.code, item: gift.item_name, claimed: !!gift.redeemed_at } : null };
}
