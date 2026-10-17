// Guest accounts: sign in with a 6-digit code sent by email (no passwords).
import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db, makeCode } from "./db";
import { emailMode, loginCodeEmail, sendEmail } from "./email";

export const SESSION_COOKIE = "mm_session";
const CODE_TTL = 10 * 60_000;
const SESSION_TTL = 60 * 24 * 60 * 60_000; // 60 days

export type Customer = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  birthday: string | null; // "MM-DD"
  favs: string[];
  referral_code: string;
  referred_by: number | null;
  credit: number;
  birthday_treat_year: number | null;
  created_at: string;
};

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function rowToCustomer(r: Record<string, unknown>): Customer {
  return { ...(r as unknown as Customer), favs: JSON.parse(String(r.favs ?? "[]")) };
}

/** Send (or, in email preview mode, show) a sign-in code. */
export async function requestCode(email: string): Promise<{ ok: true; demoCode?: string } | { error: string }> {
  const now = Date.now();
  const row = db.prepare("SELECT sent_count, window_start FROM login_codes WHERE email = ?").get(email) as { sent_count: number; window_start: number } | undefined;
  const inWindow = row && now - row.window_start < 60 * 60_000;
  if (inWindow && row.sent_count >= 5) return { error: "That's a lot of codes! Please wait a bit and try again." };

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  db.prepare(
    `INSERT INTO login_codes (email, code_hash, expires_at, attempts, sent_count, window_start) VALUES (?, ?, ?, 0, 1, ?)
     ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
       sent_count = CASE WHEN ? THEN sent_count + 1 ELSE 1 END,
       window_start = CASE WHEN ? THEN window_start ELSE excluded.window_start END`
  ).run(email, sha(`${email}:${code}`), now + CODE_TTL, now, inWindow ? 1 : 0, inWindow ? 1 : 0);

  await sendEmail(email, ...loginCodeEmail(code));
  // No email service connected yet: show the code on screen so the flow still works
  return emailMode() === "live" ? { ok: true } : { ok: true, demoCode: code };
}

/** Check a code. Creates the account on first sign-in. */
export function verifyCode(email: string, code: string): Customer | { error: string } {
  const row = db.prepare("SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?").get(email) as
    | { code_hash: string; expires_at: number; attempts: number }
    | undefined;
  if (!row || row.expires_at < Date.now()) return { error: "That code has expired — ask for a new one." };
  if (row.attempts >= 5) return { error: "Too many tries. Please ask for a new code." };
  const a = Buffer.from(row.code_hash);
  const b = Buffer.from(sha(`${email}:${String(code).trim()}`));
  if (!(a.length === b.length && crypto.timingSafeEqual(a, b))) {
    db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?").run(email);
    return { error: "That code isn't right. Check your email and try again." };
  }
  db.prepare("DELETE FROM login_codes WHERE email = ?").run(email);

  let c = db.prepare("SELECT * FROM customers WHERE email = ?").get(email) as Record<string, unknown> | undefined;
  if (!c) {
    const base = email.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "FRIEND";
    let ref = "";
    for (let i = 0; i < 5; i++) {
      ref = makeCode(base, 3).replace("-", "");
      if (!db.prepare("SELECT 1 FROM customers WHERE referral_code = ?").get(ref)) break;
    }
    db.prepare("INSERT INTO customers (email, referral_code) VALUES (?, ?)").run(email, ref);
    c = db.prepare("SELECT * FROM customers WHERE email = ?").get(email) as Record<string, unknown>;
  }
  return rowToCustomer(c);
}

export async function startSession(customerId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES (?, ?, ?)").run(sha(token), customerId, Date.now() + SESSION_TTL);
  db.prepare("DELETE FROM customer_sessions WHERE expires_at < ?").run(Date.now());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_TTL / 1000, secure: process.env.NODE_ENV === "production" && !!process.env.SITE_URL?.startsWith("https") });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db.prepare("DELETE FROM customer_sessions WHERE token_hash = ?").run(sha(token));
  jar.delete(SESSION_COOKIE);
}

/** The signed-in guest, or null */
export async function currentCustomer(): Promise<Customer | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare("SELECT c.* FROM customer_sessions s JOIN customers c ON c.id = s.customer_id WHERE s.token_hash = ? AND s.expires_at > ?")
    .get(sha(token), Date.now()) as Record<string, unknown> | undefined;
  return row ? rowToCustomer(row) : null;
}
