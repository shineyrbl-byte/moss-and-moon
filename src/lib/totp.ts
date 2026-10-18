// Time-based one-time codes (RFC 6238), the 6-digit codes from Google Authenticator,
// Microsoft Authenticator, Authy, 1Password… Only Node's built-in crypto is used.
import crypto from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newSecret = () => base32Encode(crypto.randomBytes(20));

/** The code for one 30-second step */
export function codeAt(secret: string, step: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

export const stepNow = (ms = Date.now()) => Math.floor(ms / 1000 / 30);

/** The matching step if the code is right (allowing one step either side for clock drift), else null */
export function verify(secret: string, code: string, ms = Date.now()): number | null {
  const c = String(code).replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = stepNow(ms);
  for (const s of [now, now - 1, now + 1]) {
    const expected = Buffer.from(codeAt(secret, s));
    if (crypto.timingSafeEqual(expected, Buffer.from(c))) return s;
  }
  return null;
}

export const otpauthUrl = (label: string, secret: string, issuer = "Moss & Moon") =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${label}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

/** 8 one-time backup codes like "k7m2-9qpx" */
export const recoveryCodes = () =>
  Array.from({ length: 8 }, () => {
    const s = base32Encode(crypto.randomBytes(5)).toLowerCase().slice(0, 8);
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
