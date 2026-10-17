// Saving uploaded photos (menu photos, review photos) next to the database.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir } from "./db";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

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
  const dir = path.join(dataDir(), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${crypto.randomBytes(8).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  return { url: `/api/uploads/${name}` };
}

/** Is this one of our uploaded photo paths (and does it exist)? */
export function isOurPhoto(url: unknown) {
  const m = /^\/api\/uploads\/([a-f0-9]{16}\.(jpg|png|webp))$/.exec(String(url ?? ""));
  return !!m && fs.existsSync(path.join(dataDir(), "uploads", m[1]));
}

export function deletePhoto(url: unknown) {
  const m = /^\/api\/uploads\/([a-f0-9]{16}\.(jpg|png|webp))$/.exec(String(url ?? ""));
  if (m) fs.rmSync(path.join(dataDir(), "uploads", m[1]), { force: true });
}
