// Where are you visiting from? One tap a day per guest, counted by state or country.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { placeFor } from "./places";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);

export function originStats(voter?: unknown, now = new Date()) {
  const date = toDateStr(now), month = date.slice(0, 7);
  const top = db.prepare("SELECT place, kind, COUNT(*) AS n FROM visit_origins WHERE substr(date, 1, 7) = ? GROUP BY place ORDER BY n DESC, place LIMIT 10").all(month) as { place: string; kind: string; n: number }[];
  const sum = db.prepare("SELECT COUNT(*) AS people, COUNT(DISTINCT CASE WHEN kind = 'state' THEN place END) AS states, COUNT(DISTINCT CASE WHEN kind = 'country' THEN place END) AS countries FROM visit_origins WHERE substr(date, 1, 7) = ?").get(month) as { people: number; states: number; countries: number };
  const ever = db.prepare("SELECT COUNT(DISTINCT place) AS places, COUNT(*) AS people FROM visit_origins").get() as { places: number; people: number };
  const v = cleanVoter(voter);
  const mine = v ? (db.prepare("SELECT place FROM visit_origins WHERE date = ? AND voter = ?").get(date, v) as { place: string } | undefined)?.place ?? null : null;
  return { month, top, ...sum, ever, mine };
}

/** { place, voter }: once a day (you can change it) */
export function addOrigin(b: Record<string, unknown>, now = new Date()) {
  const v = cleanVoter(b.voter);
  if (!v) return { error: "Something went wrong. Refresh and try again." };
  const p = placeFor(b.place);
  if (!p) return { error: "Pick a state or country from the list." };
  db.prepare("INSERT INTO visit_origins (date, voter, place, kind) VALUES (?, ?, ?, ?) ON CONFLICT(date, voter) DO UPDATE SET place = excluded.place, kind = excluded.kind").run(toDateStr(now), v, p.name, p.kind);
  return originStats(v, now);
}
