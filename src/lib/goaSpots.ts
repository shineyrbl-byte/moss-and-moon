// Where in Goa? A daily photo quiz the owner fills: a photo of a place, its name, and three wrong answers. One a day,
// going round the owner's list. The answer is only checked on the server, so it never reaches the page early.
import "server-only";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { seededRand, shuffled } from "./gameOrders";

type Row = { id: number; photo: string; answer: string; wrong: string; note: string };
const dayOf = (date: string) => Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86400_000);
export const allSpots = () => db.prepare("SELECT id, photo, answer, wrong, note FROM goa_spots ORDER BY id").all() as Row[];
export function addSpot(f: Record<string, unknown>, photo: string) {
  const answer = cleanText(f.answer, 60), wrong = [f.wrong1, f.wrong2, f.wrong3].map((w) => cleanText(w, 60)).filter(Boolean);
  if (!answer) return { error: "Say where it is." };
  if (wrong.length < 3 || new Set([answer.toLowerCase(), ...wrong.map((w) => w.toLowerCase())]).size < 4) return { error: "Give three different wrong answers." };
  db.prepare("INSERT INTO goa_spots (photo, answer, wrong, note) VALUES (?, ?, ?, ?)").run(photo, answer, JSON.stringify(wrong), cleanText(f.note, 200));
  return { ok: true, spots: allSpots() };
}
export const removeSpot = (id: number) => db.prepare("DELETE FROM goa_spots WHERE id = ?").run(id).changes > 0;
/** Today's spot, without the answer */
export function todaysSpot(now = new Date()) {
  const date = toDateStr(now), list = allSpots();
  if (!list.length) return { date, spot: null };
  const s = list[((dayOf(date) % list.length) + list.length) % list.length];
  return { date, spot: { id: s.id, photo: s.photo, options: shuffled([s.answer, ...(JSON.parse(s.wrong) as string[])], seededRand(`goa:${date}`)) } };
}
export function checkGuess(id: unknown, guess: unknown) {
  const s = db.prepare("SELECT answer, note FROM goa_spots WHERE id = ?").get(Number(id)) as { answer: string; note: string } | undefined;
  if (!s) return { error: "That photo's gone." };
  return { right: String(guess) === s.answer, answer: s.answer, note: s.note };
}
