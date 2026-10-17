import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/auth";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Staff: upload a menu photo. Saved next to the database (on the persistent disk).
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Please choose a photo." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "Please use a JPG, PNG or WebP photo." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: "That photo is over 5 MB — try a smaller one." }, { status: 400 });

  const dir = path.join(dataDir(), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${crypto.randomBytes(8).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return Response.json({ url: `/api/uploads/${name}` });
}
