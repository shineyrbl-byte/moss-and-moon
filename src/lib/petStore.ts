// Adopt a friend: owners list shelter animals; guests see who's looking for a home.
import "server-only";
import { db, cleanText } from "./db";
import { cleanLink, petKind } from "./pets";

export type Pet = { id: number; name: string; kind: string; age: string; about: string; good_with: string; shelter: string; link: string; img: string; status: string; adopted_at: string | null };
const clean = (v: unknown, n: number) => cleanText(v, n).replace(/[<>]/g, "");
const COLS = "id, name, kind, age, about, good_with, shelter, link, img, status, adopted_at";

export const petsAvailable = () => db.prepare(`SELECT ${COLS} FROM adopt_pets WHERE status = 'available' ORDER BY id DESC`).all() as Pet[];
export const petsHomed = () => db.prepare(`SELECT ${COLS} FROM adopt_pets WHERE status = 'adopted' ORDER BY adopted_at DESC LIMIT 12`).all() as Pet[];

export function addPet(b: Record<string, unknown>, img: string) {
  const name = clean(b.name, 40);
  if (!name) return { error: "What's their name?" };
  db.prepare("INSERT INTO adopt_pets (name, kind, age, about, good_with, shelter, link, img) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(name, petKind(b.kind), clean(b.age, 30), clean(b.about, 400), clean(b.good_with, 80), clean(b.shelter, 60), cleanLink(b.link), img);
  return { ok: true as const };
}
/** Found a home (or back to looking) */
export const setAdopted = (id: number, adopted: boolean) => db.prepare(`UPDATE adopt_pets SET status = ?, adopted_at = ${adopted ? "datetime('now','localtime')" : "NULL"} WHERE id = ?`).run(adopted ? "adopted" : "available", id).changes > 0;
export const removePet = (id: number) => db.prepare("DELETE FROM adopt_pets WHERE id = ?").run(id).changes > 0;
