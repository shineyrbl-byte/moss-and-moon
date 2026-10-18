// Two-step login for owner accounts: stored per staff id (0 = the passcode owner)
import "server-only";
import crypto from "node:crypto";
import { db, getSetting, setSetting } from "./db";
import { newSecret, otpauthUrl, recoveryCodes, verify } from "./totp";

type Saved = { secret: string; recovery: string[]; since: string; lastStep?: number };
const key = (id: number) => `totp_${id}`;
const pendingKey = (id: number) => `totp_pending_${id}`;
const hash = (c: string) => crypto.createHash("sha256").update(c.trim().toLowerCase()).digest("hex");

const read = (id: number): Saved | null => {
  try { return JSON.parse(getSetting(key(id)) ?? "null"); } catch { return null; }
};

export const twoStepOn = (id: number) => !!read(id);

export function startSetup(id: number, label: string) {
  const secret = newSecret();
  setSetting(pendingKey(id), secret);
  return { secret, url: otpauthUrl(label, secret) };
}

/** Confirm the first code; returns the backup codes to show once */
export function finishSetup(id: number, code: string) {
  const secret = getSetting(pendingKey(id));
  if (!secret) return null;
  const step = verify(secret, code);
  if (step === null) return null;
  const codes = recoveryCodes();
  setSetting(key(id), JSON.stringify({ secret, recovery: codes.map(hash), since: new Date().toISOString(), lastStep: step } satisfies Saved));
  db.prepare("DELETE FROM settings WHERE key = ?").run(pendingKey(id));
  return codes;
}

/** Check a 6-digit code or a backup code (backup codes work once). A code can't be reused. */
export function checkCode(id: number, code: string): "ok" | "bad" {
  const s = read(id);
  if (!s) return "ok";
  const step = verify(s.secret, code);
  if (step !== null) {
    if (s.lastStep !== undefined && step <= s.lastStep) return "bad"; // already used
    setSetting(key(id), JSON.stringify({ ...s, lastStep: step }));
    return "ok";
  }
  const h = hash(code);
  if (s.recovery.includes(h)) {
    setSetting(key(id), JSON.stringify({ ...s, recovery: s.recovery.filter((x) => x !== h) }));
    return "ok";
  }
  return "bad";
}

export const backupLeft = (id: number) => read(id)?.recovery.length ?? 0;
export const turnOff = (id: number) => db.prepare("DELETE FROM settings WHERE key = ?").run(key(id));
