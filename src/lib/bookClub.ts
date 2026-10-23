// Book club: one book a month from the shelf, a meet-up (also shown in Events), and guests' thoughts.
import "server-only";
import { db, cleanText, getSetting, setSetting } from "./db";
import { toDateStr, parseDate } from "./cafe";
import { shelf } from "./library";
import { monthOf, shiftMonth } from "./comeback";
import { cleanEvent, deleteEvent, findEvent, saveEvent } from "./eventsStore";

type Pick = { bookId: string; date?: string; time?: string; eventId?: string };
const readPick = (month: string): Pick | null => { try { return JSON.parse(getSetting(`book_club:${month}`) ?? "null"); } catch { return null; } };
const books = () => shelf().filter((i) => i.kind === "book");

function describe(month: string) {
  const p = readPick(month);
  const b = p && books().find((x) => x.id === p.bookId);
  if (!p || !b) return null;
  return { month, bookId: b.id, title: b.title, author: b.detail, date: p.date ?? null, time: p.time ?? null, eventId: p.eventId && findEvent(p.eventId) ? p.eventId : null };
}

type Thought = { id: number; name: string; stars: number; text: string; created_at: string; status?: string; book_id?: string };
export function clubStatus(now = new Date()) {
  const month = monthOf(toDateStr(now));
  const pick = describe(month);
  const thoughts = pick ? db.prepare("SELECT id, name, stars, text, created_at FROM book_thoughts WHERE month = ? AND book_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 60").all(month, pick.bookId) as Thought[] : [];
  const avg = pick ? (db.prepare("SELECT AVG(stars) AS a, COUNT(*) AS n FROM book_thoughts WHERE month = ? AND book_id = ? AND status = 'approved'").get(month, pick.bookId) as { a: number | null; n: number }) : { a: null, n: 0 };
  const past = Array.from({ length: 6 }, (_, i) => describe(shiftMonth(month, -1 - i))).filter((x) => x !== null);
  return { month, pick, next: describe(shiftMonth(month, 1)), thoughts, stars: avg.a ? Math.round(avg.a * 10) / 10 : null, ratings: avg.n, past };
}

/** Owner: choose a month's book, and optionally a meet-up (made into a free event) */
export function setPick(b: Record<string, unknown>) {
  const month = String(b.month ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Bad month." };
  const book = books().find((x) => x.id === b.bookId);
  if (!book) return { error: "Pick a book from the shelf." };
  const old = readPick(month);
  const date = String(b.date ?? ""), time = String(b.time ?? "");
  let eventId = old?.eventId;
  if (date || time) {
    if (!parseDate(date) || date.slice(0, 7) !== month) return { error: "Pick a meet-up date in that month." };
    const e = cleanEvent({ title: `Book club: ${book.title}`.slice(0, 60), desc: `This month we're reading ${book.title}${book.detail ? ` by ${book.detail}` : ""}. Come and talk about it over coffee, finished or not. Borrow a copy from our shelf.`, date, time, capacity: 20, price: 0, img: "1507842217343-583bb7270b66" }, eventId && findEvent(eventId) ? eventId : undefined);
    if ("error" in e) return e;
    saveEvent(e);
    eventId = e.id;
  } else if (eventId) {
    const r = deleteEvent(eventId);
    if ("error" in r) return r;
    eventId = undefined;
  }
  setSetting(`book_club:${month}`, JSON.stringify({ bookId: book.id, ...(date ? { date, time } : {}), ...(eventId ? { eventId } : {}) }));
  return { ok: true, pick: describe(month) };
}

export function addThought(b: Record<string, unknown>, now = new Date()) {
  const month = monthOf(toDateStr(now));
  const pick = describe(month);
  if (!pick) return { error: "There's no book this month yet." };
  const stars = Math.floor(Number(b.stars));
  if (!(stars >= 1 && stars <= 5)) return { error: "Give it 1 to 5 stars." };
  const name = cleanText(b.name, 30).replace(/[<>]/g, "");
  if (!name) return { error: "Add your name (first name is fine)." };
  const text = cleanText(b.text, 400).replace(/[<>]/g, "");
  if ((db.prepare("SELECT COUNT(*) AS n FROM book_thoughts WHERE status = 'pending'").get() as { n: number }).n >= 200) return { error: "We've got lots to read right now. Try again tomorrow ✿" };
  db.prepare("INSERT INTO book_thoughts (month, book_id, name, stars, text) VALUES (?, ?, ?, ?, ?)").run(month, pick.bookId, name, stars, text);
  return { ok: true as const };
}

export const thoughtsForStaff = () => db.prepare("SELECT t.id, t.name, t.stars, t.text, t.created_at, t.status, t.book_id FROM book_thoughts t ORDER BY t.status = 'pending' DESC, t.id DESC LIMIT 100").all() as Thought[];
export function reviewThought(id: number, approve: boolean) {
  const r = approve ? db.prepare("UPDATE book_thoughts SET status = 'approved' WHERE id = ?").run(id) : db.prepare("DELETE FROM book_thoughts WHERE id = ?").run(id);
  return r.changes > 0;
}
export const shelfBooks = () => books().map((b) => ({ id: b.id, title: b.title, author: b.detail }));
