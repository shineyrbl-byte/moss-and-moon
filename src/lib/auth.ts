// Staff sign-in with roles.
// - The OWNER signs in with the shared passcode (ADMIN_PASSCODE, default "moonlight").
// - The owner can add staff accounts (username + password) as "owner" or "barista".
// Baristas can run the counter (orders, bookings, tables, stock switches) but not see
// money reports, emails or edit the menu.
import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { db, getSetting, setSetting } from "./db";

export const ADMIN_COOKIE = "mm_admin";
export type Role = "owner" | "barista";
export type Staff = { id: number; name: string; role: Role };

const passcode = () => process.env.ADMIN_PASSCODE || "moonlight";
const SESSION_HOURS = 12;

/** Secret for signing staff cookies. Changing ADMIN_PASSCODE signs everyone out. */
function secret() {
  let s = getSetting("staff_secret");
  if (!s) {
    s = crypto.randomBytes(32).toString("hex");
    setSetting("staff_secret", s);
  }
  return crypto.createHash("sha256").update(`${s}:${passcode()}`).digest();
}

const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

function makeToken(s: Staff) {
  const payload = `${s.id}.${s.role}.${Date.now() + SESSION_HOURS * 3600_000}`;
  return `${payload}.${sign(payload)}`;
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ---------- passwords ----------
export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
}
function checkPassword(pw: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return !!salt && !!hash && safeEqual(crypto.scryptSync(pw, salt, 64).toString("hex"), hash);
}

/** Check a login. Empty username or "owner" = the shared owner passcode. */
export function checkLogin(username: string, password: string): Staff | null {
  const u = username.trim().toLowerCase();
  if (!u || u === "owner") return safeEqual(password, passcode()) ? { id: 0, name: "Owner", role: "owner" } : null;
  const row = db.prepare("SELECT id, name, role, password_hash FROM staff WHERE username = ? AND active = 1").get(u) as
    | { id: number; name: string; role: Role; password_hash: string }
    | undefined;
  return row && checkPassword(password, row.password_hash) ? { id: row.id, name: row.name, role: row.role } : null;
}

export async function startStaffSession(s: Staff) {
  const jar = await cookies();
  // Strict: the staff cookie is never sent when another site links or posts here
  jar.set(ADMIN_COOKIE, makeToken(s), { httpOnly: true, sameSite: "strict", path: "/", maxAge: SESSION_HOURS * 3600, secure: process.env.NODE_ENV === "production" && !!process.env.SITE_URL?.startsWith("https") });
}

/** The signed-in staff member, or null */
export async function currentStaff(): Promise<Staff | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value ?? "";
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, role, exp, sig] = parts;
  if (!safeEqual(sig, sign(`${id}.${role}.${exp}`)) || Number(exp) < Date.now()) return null;
  if (id === "0") return { id: 0, name: "Owner", role: "owner" };
  // Staff accounts can be switched off at any time
  const row = db.prepare("SELECT id, name, role FROM staff WHERE id = ? AND active = 1").get(Number(id)) as Staff | undefined;
  return row ?? null;
}

/** Any staff member (owner or barista) */
export async function isAdmin() {
  return !!(await currentStaff());
}

/** Owner only: money, reports, emails, menu editing, team */
export async function isOwner() {
  return (await currentStaff())?.role === "owner";
}

export const unauthorized = () => Response.json({ error: "Please log in as staff." }, { status: 401 });
export const ownersOnly = () => Response.json({ error: "Only the owner can do that." }, { status: 403 });

/** For owner-only routes: "please log in" if signed out, "owners only" for baristas, null if OK */
export async function ownerGate(): Promise<Response | null> {
  const s = await currentStaff();
  if (!s) return unauthorized();
  return s.role === "owner" ? null : ownersOnly();
}

