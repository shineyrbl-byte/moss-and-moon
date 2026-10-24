// The artist wall: this month's artist and the pieces on our walls. Owners keep it up to date.
import "server-only";
import { db, cleanText, getSetting, setSetting } from "./db";

type Artist = { name: string; bio: string; link: string };
export type Artwork = { id: number; title: string; medium: string; size: string; price: number | null; img: string; sold: number };
const clean = (v: unknown, n: number) => cleanText(v, n).replace(/[<>]/g, "");

export function artistOfMonth(): Artist | null {
  try { const a = JSON.parse(getSetting("artist_month") ?? "null") as Artist | null; return a?.name ? a : null; } catch { return null; }
}
export function saveArtist(b: Record<string, unknown>): Artist | null {
  const name = clean(b.name, 60);
  const link = typeof b.link === "string" && /^https:\/\/[^\s<>"]{3,200}$/.test(b.link.trim()) ? b.link.trim() : "";
  const a = name ? { name, bio: clean(b.bio, 500), link } : null;
  setSetting("artist_month", a ? JSON.stringify(a) : "");
  return a;
}
export const artworks = () => db.prepare("SELECT id, title, medium, size, price, img, sold FROM artworks ORDER BY sold, id DESC").all() as Artwork[];

export function addArtwork(b: Record<string, unknown>, img: string) {
  const title = clean(b.title, 80);
  if (!title) return { error: "Give the piece a title (\"Untitled\" is fine)." };
  const price = Number(b.price) > 0 && Number(b.price) < 10_000_000 ? Math.round(Number(b.price)) : null;
  db.prepare("INSERT INTO artworks (title, medium, size, price, img) VALUES (?, ?, ?, ?, ?)").run(title, clean(b.medium, 60), clean(b.size, 40), price, img);
  return { ok: true as const };
}
export const setSold = (id: number, sold: boolean) => db.prepare("UPDATE artworks SET sold = ? WHERE id = ?").run(sold ? 1 : 0, id).changes > 0;
export const removeArtwork = (id: number) => db.prepare("DELETE FROM artworks WHERE id = ?").run(id).changes > 0;
