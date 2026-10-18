// Clocking in and out, timesheets, and splitting tips by hours worked
import "server-only";
import { db } from "./db";
import { hoursOn, toDateStr } from "./cafe";
import { weekDays, shiftHours } from "./rota";

const now = () => new Date().toLocaleString("sv-SE").replace("T", " ").slice(0, 19); // local "YYYY-MM-DD HH:MM:SS"
const MAX_SHIFT_HOURS = 12;

export const openEntry = (staffId: number) =>
  db.prepare("SELECT id, clock_in FROM timesheets WHERE staff_id = ? AND clock_out IS NULL ORDER BY id DESC LIMIT 1").get(staffId) as { id: number; clock_in: string } | undefined;

export function clockIn(staffId: number) {
  if (openEntry(staffId)) return { error: "You're already clocked in." };
  db.prepare("INSERT INTO timesheets (staff_id, clock_in) VALUES (?, ?)").run(staffId, now());
  return { ok: true };
}

export function clockOut(staffId: number) {
  const e = openEntry(staffId);
  if (!e) return { error: "You're not clocked in." };
  db.prepare("UPDATE timesheets SET clock_out = ? WHERE id = ?").run(now(), e.id);
  return { ok: true };
}

const hoursBetween = (a: string, b: string) => Math.max(0, (new Date(b.replace(" ", "T")).getTime() - new Date(a.replace(" ", "T")).getTime()) / 3_600_000);

/** Forgot to clock out? Close it at closing time + 30 min (or after 12 hours), marked as automatic */
export function autoClockOut(at = new Date()) {
  for (const e of db.prepare("SELECT id, clock_in FROM timesheets WHERE clock_out IS NULL").all() as { id: number; clock_in: string }[]) {
    const start = new Date(e.clock_in.replace(" ", "T"));
    const close = hoursOn(start)?.[1] ?? 22;
    const end = new Date(start);
    end.setHours(close, 30, 0, 0);
    const cap = new Date(start.getTime() + MAX_SHIFT_HOURS * 3_600_000);
    const stop = end > start ? (end < cap ? end : cap) : cap;
    if (at > stop) db.prepare("UPDATE timesheets SET clock_out = ?, auto = 1 WHERE id = ?").run(stop.toLocaleString("sv-SE").replace("T", " ").slice(0, 19), e.id);
  }
}

/** One week (Monday first): hours worked and planned per person, tips earned, and each person's share */
export function weekReport(monday: string) {
  const days = weekDays(monday);
  const from = `${days[0]} 00:00:00`;
  const to = `${days[6]} 23:59:59`;
  const team = db.prepare("SELECT id, name FROM staff WHERE active = 1 ORDER BY name").all() as { id: number; name: string }[];
  const entries = db.prepare("SELECT t.id, t.staff_id, t.clock_in, t.clock_out, t.auto FROM timesheets t WHERE t.clock_in BETWEEN ? AND ? ORDER BY t.clock_in").all(from, to) as { id: number; staff_id: number; clock_in: string; clock_out: string | null; auto: number }[];
  const planned = db.prepare("SELECT staff_id, start, end FROM shifts WHERE day BETWEEN ? AND ?").all(days[0], days[6]) as { staff_id: number; start: string; end: string }[];
  const tips = (db.prepare("SELECT COALESCE(SUM(tip), 0) AS t FROM orders WHERE created_at BETWEEN ? AND ? AND pay_status IN ('paid','refunded')").get(from, to) as { t: number }).t;
  const stillOpen = now();
  const people = team.map((p) => {
    const mine = entries.filter((e) => e.staff_id === p.id);
    const worked = Math.round(mine.reduce((s, e) => s + hoursBetween(e.clock_in, e.clock_out ?? stillOpen), 0) * 100) / 100;
    const plan = planned.filter((s) => s.staff_id === p.id).reduce((s, x) => s + shiftHours(x.start, x.end), 0);
    return { id: p.id, name: p.name, worked, planned: plan, entries: mine };
  });
  const totalHours = people.reduce((s, p) => s + p.worked, 0);
  // Split by hours worked, in whole rupees; any leftover rupees go to whoever worked longest
  const shares = people.map((p) => ({ ...p, tip: totalHours ? Math.floor((tips * p.worked) / totalHours) : 0 }));
  const left = tips - shares.reduce((s, p) => s + p.tip, 0);
  if (left > 0 && totalHours) shares.sort((a, b) => b.worked - a.worked)[0].tip += left;
  return { week: monday, days, tips, totalHours: Math.round(totalHours * 100) / 100, people: shares.sort((a, b) => a.name.localeCompare(b.name)) };
}

export const today = () => toDateStr(new Date());
