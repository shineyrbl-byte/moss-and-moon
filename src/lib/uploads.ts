// Uploaded photos (menu photos, review photos). They're kept inside the database, so they
// travel with backups and work on hosts without a disk (Vercel). Photos saved by older
// versions as files next to the database are still read from there.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir, db } from "./db";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const NAME = /^\/api\/uploads\/([a-f0-9]{16}\.(jpg|png|webp))$/;

let ready = false;
function table() {
  if (!ready) {
    db.exec("CREATE TABLE IF NOT EXISTS uploads (name TEXT PRIMARY KEY, data BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')))");
    ready = true;
  }
}

/** Check the file really is an image by its first bytes, not just its name */
function looksLikeImage(b: Buffer, ext: string) {
  if (ext === "jpg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (ext === "png") return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === "webp") return b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP";
  return false;
}

export async function savePhoto(file: unknown, maxMB: number): Promise<{ url: string } | { error: string }> {
  if (!(file instanceof File)) return { error: "Please choose a photo." };
  const ext = TYPES[file.type];
  if (!ext) return { error: "Please use a JPG, PNG or WebP photo." };
  if (file.size > maxMB * 1024 * 1024) return { error: `That photo is over ${maxMB} MB. Try a smaller one.` };
  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buf, ext)) return { error: "That file doesn't look like a photo." };
  const name = `${crypto.randomBytes(8).toString("hex")}.${ext}`;
  table();
  db.prepare("INSERT INTO uploads (name, data) VALUES (?, ?)").run(name, buf);
  return { url: `/api/uploads/${name}` };
}

/** The bytes of an uploaded photo by file name (like "ab12….jpg"), or null */
export function readPhoto(name: string): Buffer | null {
  if (!/^[a-f0-9]{16}\.(jpg|png|webp)$/.test(name)) return null;
  table();
  const row = db.prepare("SELECT data FROM uploads WHERE name = ?").get(name) as { data: Buffer | Uint8Array } | undefined;
  if (row) return Buffer.from(row.data);
  const file = path.join(dataDir(), "uploads", name);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

/** Is this one of our uploaded photo paths (and does it exist)? */
export function isOurPhoto(url: unknown) {
  const m = NAME.exec(String(url ?? ""));
  if (!m) return false;
  table();
  return !!db.prepare("SELECT 1 FROM uploads WHERE name = ?").get(m[1]) || fs.existsSync(path.join(dataDir(), "uploads", m[1]));
}

export function deletePhoto(url: unknown) {
  const m = NAME.exec(String(url ?? ""));
  if (!m) return;
  table();
  db.prepare("DELETE FROM uploads WHERE name = ?").run(m[1]);
  fs.rmSync(path.join(dataDir(), "uploads", m[1]), { force: true });
}
