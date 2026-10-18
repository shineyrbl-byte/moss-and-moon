// Sending through Gmail's own API (plain HTTPS), for hosts like Railway's Hobby plan that
// block the usual email ports. The owner connects the café Gmail once in Admin; we keep
// a refresh token (encrypted) and send as that account, so Google signs every email.
import "server-only";
import crypto from "node:crypto";
import { db, getSetting, setSetting } from "./db";

// (Tests point these at a fake Google)
const AUTH_URL = () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = () => `${process.env.GOOGLE_OAUTH_BASE || "https://oauth2.googleapis.com"}/token`;
const SEND_URL = () => `${process.env.GMAIL_API_BASE || "https://gmail.googleapis.com"}/gmail/v1/users/me/messages/send`;
const USERINFO_URL = () => process.env.GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
// "openid email" only tells us which address it is; reading mail would need far more, and we never ask for it
const SCOPES = `openid email ${GMAIL_SCOPE}`;

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const site = () => (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const redirectUri = () => `${site()}/api/admin/gmail/callback`;

// The token is encrypted with a key made from the client secret, so a leaked backup alone can't send mail
const key = () => crypto.createHash("sha256").update(`gmail-token:${process.env.GOOGLE_CLIENT_SECRET ?? ""}`).digest();
function seal(text: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
function open(sealed: string) {
  const [iv, tag, enc] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export function connectedAddress() {
  if (!googleConfigured()) return null;
  return getSetting("gmail_api_address") || null;
}
export const gmailApiReady = () => !!connectedAddress() && !!getSetting("gmail_api_token");

export function authUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // always hand back a refresh token
    state,
  });
  return `${AUTH_URL()}?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const r = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
  });
  const d = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; id_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!r.ok || !d.access_token) throw new Error(d.error_description || d.error || `Google said ${r.status}`);
  return d;
}

let access: { token: string; until: number } | null = null;

/** Finish connecting: swap the one-time code for tokens, and find out which Gmail it is */
export async function connect(code: string) {
  const d = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!d.refresh_token) throw new Error("Google didn't give a long-lived permission. Remove the app from your Google account's third-party access and connect again.");
  if (d.scope && !d.scope.split(" ").includes(GMAIL_SCOPE)) throw new Error("Please tick “Send email on your behalf” on Google's screen, then connect again.");
  const email = emailFromIdToken(d.id_token) ?? (await emailFromUserinfo(d.access_token!));
  if (!email) throw new Error("Couldn't read the Gmail address. Please connect again and allow Google to share your email address.");
  setSetting("gmail_api_token", seal(d.refresh_token));
  setSetting("gmail_api_address", email);
  access = { token: d.access_token!, until: Date.now() + ((d.expires_in ?? 3600) - 120) * 1000 };
  return email;
}

/** The id_token came straight from Google's token endpoint over https, so its email can be read directly */
function emailFromIdToken(idToken?: string) {
  try {
    const payload = JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString());
    return payload.email && payload.email_verified !== false ? String(payload.email) : null;
  } catch {
    return null;
  }
}
async function emailFromUserinfo(token: string) {
  const u = await fetch(USERINFO_URL(), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({}));
  return (u as { email?: string }).email ?? null;
}

export function disconnect() {
  db.prepare("DELETE FROM settings WHERE key IN ('gmail_api_token', 'gmail_api_address')").run();
  access = null;
}

async function accessToken() {
  if (access && Date.now() < access.until) return access.token;
  const sealed = getSetting("gmail_api_token");
  if (!sealed) throw new Error("Gmail isn't connected.");
  const d = await tokenRequest({ refresh_token: open(sealed), grant_type: "refresh_token" });
  access = { token: d.access_token!, until: Date.now() + ((d.expires_in ?? 3600) - 120) * 1000 };
  return access.token;
}

/** Send a complete email (raw MIME bytes) as the connected Gmail */
export async function sendRaw(raw: Buffer) {
  const send = async () =>
    fetch(SEND_URL(), {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: raw.toString("base64url") }),
      signal: AbortSignal.timeout(20_000),
    });
  let r = await send();
  if (r.status === 401) {
    access = null; // token expired early: get a fresh one and try once more
    r = await send();
  }
  if (!r.ok) throw new Error(`Gmail said ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
