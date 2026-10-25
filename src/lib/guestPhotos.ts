// The photo wall: guests share a photo, staff approve it, then it shows in "Life at Moss & Moon".
import "server-only";
import { db, cleanText } from "./db";
import { deletePhoto, isOurPhoto } from "./uploads";
import { toDateStr } from "./cafe";
import { promptFor } from "./doodlePrompts";

export type GuestPhoto = { id: number; url: string; caption: string; name: string; status: "pending" | "approved"; kind: PhotoKind; created_at: string; prompt: string | null };
/** cafe = "Life at Moss & Moon" on the home page · pup = the regular pups wall on /pups */
export type PhotoKind = "cafe" | "pup" | "doodle";
export const photoKind = (v: unknown): PhotoKind => (v === "pup" || v === "doodle" ? v : "cafe");

export function addGuestPhoto(url: string, b: Record<string, unknown>) {
  if (!isOurPhoto(url)) return { error: "That photo didn't upload properly." };
  const name = cleanText(b.name, 30).replace(/[<>]/g, "") || "A guest";
  const caption = cleanText(b.caption, 120).replace(/[<>]/g, "");
  if ((db.prepare("SELECT COUNT(*) AS n FROM guest_photos WHERE status = 'pending'").get() as { n: number }).n >= 200) return { error: "We've got a lot of photos to look at right now. Try again tomorrow ✿" };
  // Doodles drawn for today's prompt are tagged with it (the server picks the prompt, not the page)
  const prompt = photoKind(b.kind) === "doodle" && b.prompt === "1" ? promptFor(toDateStr(new Date())) : null;
  const r = db.prepare("INSERT INTO guest_photos (url, caption, name, kind, prompt) VALUES (?, ?, ?, ?, ?)").run(url, caption, name, photoKind(b.kind), prompt);
  return { ok: true as const, id: Number(r.lastInsertRowid) };
}

export const approvedPhotos = (limit = 24, kind: PhotoKind = "cafe") => db.prepare("SELECT id, url, caption, name, status, kind, created_at, prompt FROM guest_photos WHERE status = 'approved' AND kind = ? ORDER BY id DESC LIMIT ?").all(kind, limit) as GuestPhoto[];
export const allPhotos = () => db.prepare("SELECT id, url, caption, name, status, kind, created_at, prompt FROM guest_photos ORDER BY status = 'pending' DESC, id DESC LIMIT 100").all() as GuestPhoto[];
/** Doodles drawn for one prompt */
export const promptDoodles = (prompt: string) => db.prepare("SELECT id, url, caption, name, status, kind, created_at, prompt FROM guest_photos WHERE status = 'approved' AND kind = 'doodle' AND prompt = ? ORDER BY id DESC LIMIT 48").all(prompt) as GuestPhoto[];
/** Past prompts that have doodles, newest first */
export const doodlePrompts = () => db.prepare("SELECT prompt, COUNT(*) AS n, MAX(id) AS last FROM guest_photos WHERE status = 'approved' AND kind = 'doodle' AND prompt IS NOT NULL GROUP BY prompt ORDER BY last DESC LIMIT 30").all() as { prompt: string; n: number }[];

/** Staff: approve one, or remove it (the file is deleted too) */
export function reviewPhoto(id: number, approve: boolean) {
  const p = db.prepare("SELECT url FROM guest_photos WHERE id = ?").get(id) as { url: string } | undefined;
  if (!p) return false;
  if (approve) db.prepare("UPDATE guest_photos SET status = 'approved' WHERE id = ?").run(id);
  else { db.prepare("DELETE FROM guest_photos WHERE id = ?").run(id); deletePhoto(p.url); }
  return true;
}
