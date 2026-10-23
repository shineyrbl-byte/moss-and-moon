// The photo wall: guests share a photo, staff approve it, then it shows in "Life at Moss & Moon".
import "server-only";
import { db, cleanText } from "./db";
import { deletePhoto, isOurPhoto } from "./uploads";

export type GuestPhoto = { id: number; url: string; caption: string; name: string; status: "pending" | "approved"; created_at: string };

export function addGuestPhoto(url: string, b: Record<string, unknown>) {
  if (!isOurPhoto(url)) return { error: "That photo didn't upload properly." };
  const name = cleanText(b.name, 30).replace(/[<>]/g, "") || "A guest";
  const caption = cleanText(b.caption, 120).replace(/[<>]/g, "");
  if ((db.prepare("SELECT COUNT(*) AS n FROM guest_photos WHERE status = 'pending'").get() as { n: number }).n >= 200) return { error: "We've got a lot of photos to look at right now. Try again tomorrow ✿" };
  const r = db.prepare("INSERT INTO guest_photos (url, caption, name) VALUES (?, ?, ?)").run(url, caption, name);
  return { ok: true as const, id: Number(r.lastInsertRowid) };
}

export const approvedPhotos = (limit = 24) => db.prepare("SELECT id, url, caption, name, status, created_at FROM guest_photos WHERE status = 'approved' ORDER BY id DESC LIMIT ?").all(limit) as GuestPhoto[];
export const allPhotos = () => db.prepare("SELECT id, url, caption, name, status, created_at FROM guest_photos ORDER BY status = 'pending' DESC, id DESC LIMIT 100").all() as GuestPhoto[];

/** Staff: approve one, or remove it (the file is deleted too) */
export function reviewPhoto(id: number, approve: boolean) {
  const p = db.prepare("SELECT url FROM guest_photos WHERE id = ?").get(id) as { url: string } | undefined;
  if (!p) return false;
  if (approve) db.prepare("UPDATE guest_photos SET status = 'approved' WHERE id = ?").run(id);
  else { db.prepare("DELETE FROM guest_photos WHERE id = ?").run(id); deletePhoto(p.url); }
  return true;
}
