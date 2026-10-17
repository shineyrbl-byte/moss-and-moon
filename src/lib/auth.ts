// Very small admin login: one shared passcode, stored as a cookie.
// Set ADMIN_PASSCODE in .env.local to change it (default: "moonlight").
import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";

export const ADMIN_COOKIE = "mm_admin";
const passcode = () => process.env.ADMIN_PASSCODE || "moonlight";

export const adminToken = () => crypto.createHash("sha256").update(`moss-and-moon:${passcode()}`).digest("hex");

export function checkPasscode(input: string) {
  const a = Buffer.from(String(input));
  const b = Buffer.from(passcode());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function isAdmin() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === adminToken();
}

export const unauthorized = () => Response.json({ error: "Please log in as staff." }, { status: 401 });
