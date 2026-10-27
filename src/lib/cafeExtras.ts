// Café extras the owner fills in: Goa events near the café, a "coming soon" countdown, and the weekly board-game night.
// Nothing here is made up: each one stays empty or off until the owner adds it in Admin.
import "server-only";
import { db, cleanText, getSetting, setSetting } from "./db";
import { toDateStr } from "./cafe";
import { shelf } from "./library";
import type webpush from "web-push";
import { pushTo } from "./push";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (v: unknown, n: number) => cleanText(v, n).replace(/[<>]/g, "");
const httpsOr = (v: unknown) => { const s = cleanText(v, 300).trim(); if (!s) return ""; try { return new URL(s).protocol === "https:" ? s : null; } catch { return null; } };
const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// ---- Goa events: what's on around Goa, for the "Around the corner" page ----
export type GoaEvent = { id: number; title: string; date: string; end_date: string; place: string; link: string; note: string };
/** Events that haven't finished yet, soonest first (or every one, for the owner) */
export function goaEvents(all = false, now = new Date()): GoaEvent[] {
  const today = toDateStr(now);
  return all ? db.prepare("SELECT * FROM goa_events ORDER BY date, id").all() as GoaEvent[]
    : db.prepare("SELECT * FROM goa_events WHERE MAX(date, end_date) >= ? ORDER BY date, id LIMIT 12").all(today) as GoaEvent[];
}
export function saveGoaEvent(b: Record<string, unknown>) {
  const title = clean(b.title, 80), date = String(b.date ?? ""), end = String(b.end_date ?? "");
  if (title.length < 2) return { error: "What's the event called?" };
  if (!DATE.test(date)) return { error: "Pick the date it starts." };
  if (end && (!DATE.test(end) || end < date)) return { error: "The end date should be on or after the start." };
  const link = httpsOr(b.link);
  if (link === null) return { error: "Links should start with https://" };
  db.prepare("INSERT INTO goa_events (title, date, end_date, place, link, note) VALUES (?, ?, ?, ?, ?, ?)").run(title, date, end, clean(b.place, 60), link, clean(b.note, 160));
  return { events: goaEvents(true) };
}
export const removeGoaEvent = (id: number) => { db.prepare("DELETE FROM goa_events WHERE id = ?").run(id); return { events: goaEvents(true) }; };

// ---- Coming soon: a countdown on the home page to something the owner is planning ----
export type ComingSoon = { title: string; date: string; blurb: string };
export function comingSoon(now = new Date()): (ComingSoon & { days: number }) | null {
  try {
    const c = JSON.parse(getSetting("coming_soon") ?? "null") as ComingSoon | null;
    if (!c || !DATE.test(c.date)) return null;
    const days = Math.round((Date.parse(`${c.date}T12:00:00Z`) - Date.parse(`${toDateStr(now)}T12:00:00Z`)) / 86400_000);
    return days >= 0 ? { ...c, days } : null; // it disappears once the day has passed
  } catch { return null; }
}
export function setComingSoon(b: Record<string, unknown>, now = new Date()) {
  if (b.clear) { setSetting("coming_soon", "null"); return { soon: null }; }
  const title = clean(b.title, 60), date = String(b.date ?? "");
  if (title.length < 2) return { error: "What's coming?" };
  if (!DATE.test(date) || date < toDateStr(now)) return { error: "Pick a day from today on." };
  setSetting("coming_soon", JSON.stringify({ title, date, blurb: clean(b.blurb, 160) }));
  return { soon: comingSoon(now) };
}

// ---- Board-game night: one evening a week, book seats and say which game you'd like ----
export type NightSettings = { on: boolean; day: number; time: string; seats: number; note: string };
const NIGHT_DEFAULT: NightSettings = { on: false, day: 4, time: "19:00", seats: 24, note: "" };
export function nightSettings(): NightSettings {
  try { return { ...NIGHT_DEFAULT, ...JSON.parse(getSetting("game_night") ?? "{}") }; } catch { return NIGHT_DEFAULT; }
}
export function setNightSettings(b: Record<string, unknown>) {
  const day = Math.floor(Number(b.day)), seats = Math.floor(Number(b.seats)), time = String(b.time ?? "");
  if (!(day >= 0 && day <= 6)) return { error: "Pick a day of the week." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "Pick a start time." };
  if (!(seats >= 2 && seats <= 80)) return { error: "Seats should be between 2 and 80." };
  setSetting("game_night", JSON.stringify({ on: b.on === true, day, time, seats, note: clean(b.note, 160) }));
  return { settings: nightSettings() };
}
/** The next four game nights from today */
export function nightDates(now = new Date(), s = nightSettings()) {
  let d = toDateStr(now);
  while (new Date(`${d}T12:00:00Z`).getUTCDay() !== s.day) d = addDays(d, 1);
  return [0, 1, 2, 3].map((k) => addDays(d, k * 7));
}
type NightRow = { id: number; date: string; name: string; party: number; game: string; voter: string };
/** For guests: seats left each night, the games people want, and your own booking */
export function gameNight(voterIn?: unknown, now = new Date()) {
  const s = nightSettings(), voter = cleanVoter(voterIn), games = shelf().filter((g) => g.kind === "game");
  if (!s.on) return { on: false as const };
  const nights = nightDates(now, s).map((date) => {
    const rows = db.prepare("SELECT * FROM game_night WHERE date = ?").all(date) as NightRow[];
    const want = new Map<string, number>();
    for (const r of rows) if (r.game) want.set(r.game, (want.get(r.game) ?? 0) + r.party);
    const mine = voter ? rows.find((r) => r.voter === voter) ?? null : null;
    return { date, left: Math.max(0, s.seats - rows.reduce((n, r) => n + r.party, 0)), wanted: [...want].map(([id, n]) => ({ id, title: games.find((g) => g.id === id)?.title ?? id, n })).sort((a, b) => b.n - a.n), mine: mine && { party: mine.party, game: mine.game, name: mine.name } };
  });
  const stamps = voter ? (db.prepare("SELECT COUNT(*) AS n FROM game_night WHERE voter = ? AND came = 1").get(voter) as { n: number }).n : 0;
  const alerts = voter ? !!db.prepare("SELECT 1 FROM game_night WHERE voter = ? AND date >= ? AND sub IS NOT NULL").get(voter, toDateStr(now)) : false;
  return { on: true as const, time: s.time, seats: s.seats, note: s.note, nights, stamps, alerts, games: games.map((g) => ({ id: g.id, title: g.title })) };
}
export function bookNight(b: Record<string, unknown>, now = new Date()) {
  const s = nightSettings(), voter = cleanVoter(b.voter);
  if (!s.on) return { error: "Game night isn't on right now." };
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const date = String(b.date ?? "");
  if (!nightDates(now, s).includes(date)) return { error: "Pick one of the next game nights." };
  if (b.cancel) { db.prepare("DELETE FROM game_night WHERE date = ? AND voter = ? AND came = 0").run(date, voter); return gameNight(voter, now); }
  const name = clean(b.name, 30), party = Math.floor(Number(b.party));
  if (!name) return { error: "Add a name for the booking." };
  if (!(party >= 1 && party <= 6)) return { error: "Up to six seats a booking." };
  const game = typeof b.game === "string" && shelf().some((g) => g.kind === "game" && g.id === b.game) ? b.game : "";
  const taken = (db.prepare("SELECT COALESCE(SUM(party), 0) AS n FROM game_night WHERE date = ? AND voter != ?").get(date, voter) as { n: number }).n;
  if (taken + party > s.seats) return { error: s.seats - taken > 0 ? `Only ${s.seats - taken} seat${s.seats - taken === 1 ? "" : "s"} left that night.` : "That night's full. Try the next one?" };
  const sub = (db.prepare("SELECT sub FROM game_night WHERE voter = ? AND date >= ? AND sub IS NOT NULL LIMIT 1").get(voter, toDateStr(now)) as { sub: string } | undefined)?.sub ?? null;
  db.prepare("INSERT INTO game_night (date, name, party, game, voter, sub) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(date, voter) DO UPDATE SET name = excluded.name, party = excluded.party, game = excluded.game").run(date, name, party, game, voter, sub);
  return gameNight(voter, now);
}
/** For the owner: who's coming each night, and the last four nights so you can tick off who came */
export function nightBookings(now = new Date()) {
  const rows = (date: string) => db.prepare("SELECT id, name, party, game, came FROM game_night WHERE date = ? ORDER BY id").all(date) as { id: number; name: string; party: number; game: string; came: number }[];
  const past = (db.prepare("SELECT DISTINCT date FROM game_night WHERE date < ? ORDER BY date DESC LIMIT 4").all(toDateStr(now)) as { date: string }[]).map((r) => ({ date: r.date, rows: rows(r.date) }));
  return { upcoming: nightDates(now).map((date) => ({ date, rows: rows(date) })), past };
}
/** Owner: tick off (or untick) a booking as having come, which gives the guest a game-night stamp */
export function markCame(id: unknown, came: boolean, now = new Date()) {
  const r = db.prepare("UPDATE game_night SET came = ? WHERE id = ? AND date <= ?").run(came ? 1 : 0, Math.floor(Number(id)), toDateStr(now));
  return r.changes ? { ok: true } : { error: "Only past or tonight's bookings can be ticked off." };
}
/** A guest asks for a reminder the day before each night they've booked (subscription: null turns it off) */
export function nightAlerts(b: Record<string, unknown>, now = new Date()) {
  const voter = cleanVoter(b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const sub = b.subscription as { endpoint?: unknown } | null;
  if (sub !== null && !(sub && typeof sub.endpoint === "string" && sub.endpoint.startsWith("https://"))) return { error: "Reminders aren't available on this browser." };
  db.prepare("UPDATE game_night SET sub = ? WHERE voter = ? AND date >= ?").run(sub ? JSON.stringify(sub).slice(0, 2000) : null, voter, toDateStr(now));
  return gameNight(voter, now);
}
/** Day-before reminders, sent from 10am the day before (run every few minutes) */
export async function nightReminderTick(now = new Date()) {
  if (now.getHours() < 10) return;
  const tomorrow = addDays(toDateStr(now), 1), s = nightSettings();
  const due = db.prepare("SELECT id, party, sub FROM game_night WHERE date = ? AND reminded = 0 AND sub IS NOT NULL").all(tomorrow) as { id: number; party: number; sub: string }[];
  for (const r of due) {
    db.prepare("UPDATE game_night SET reminded = 1 WHERE id = ?").run(r.id);
    let parsed: webpush.PushSubscription; try { parsed = JSON.parse(r.sub); } catch { continue; }
    const ok = await pushTo(parsed, { title: "Game night is tomorrow 🎲", body: `See you from ${s.time}. ${r.party === 1 ? "One seat" : `${r.party} seats`} booked.`, url: "/game-night" }, 12 * 3600);
    if (!ok) db.prepare("UPDATE game_night SET sub = NULL WHERE id = ?").run(r.id);
  }
}
