// Around the corner: the owner's list of nearby places.
import "server-only";
import { db, cleanText } from "./db";
import { kindOf, type Spot } from "./nearby";

type Row = Omit<Spot, "dog"> & { dog: number };
export const listSpots = (): Spot[] => (db.prepare("SELECT * FROM nearby_spots ORDER BY sort, id").all() as Row[]).map((r) => ({ ...r, dog: !!r.dog }));

const cleanUrl = (u: unknown) => { const s = cleanText(u, 300); return /^https:\/\/[^\s]+$/.test(s) ? s : ""; };

export function saveSpot(b: Record<string, unknown>) {
  const name = cleanText(b.name, 60);
  if (!name) return { error: "Give it a name." };
  const walk = Math.max(1, Math.min(120, Math.round(Number(b.walk_min) || 5)));
  const v = [name, kindOf(b.kind), cleanText(b.blurb, 300), walk, b.dog ? 1 : 0, cleanUrl(b.map_url)] as const;
  const id = Number(b.id);
  if (id) {
    const r = db.prepare("UPDATE nearby_spots SET name = ?, kind = ?, blurb = ?, walk_min = ?, dog = ?, map_url = ? WHERE id = ?").run(...v, id);
    if (!r.changes) return { error: "That place is gone." };
  } else {
    if ((db.prepare("SELECT COUNT(*) AS n FROM nearby_spots").get() as { n: number }).n >= 40) return { error: "That's plenty of places. Remove one first." };
    const sort = (db.prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM nearby_spots").get() as { s: number }).s;
    db.prepare("INSERT INTO nearby_spots (name, kind, blurb, walk_min, dog, map_url, sort) VALUES (?, ?, ?, ?, ?, ?, ?)").run(...v, sort);
  }
  return { spots: listSpots() };
}
export function removeSpot(id: number) {
  db.prepare("DELETE FROM nearby_spots WHERE id = ?").run(id);
  return { spots: listSpots() };
}
