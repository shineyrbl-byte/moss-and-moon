// Staff rota helpers (safe to use in the browser and in tests)
// (kept free of other imports so the tests can load it directly)
const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type Shift = { id: number; staff_id: number; name: string; day: string; start: string; end: string; note: string | null };

export const SHIFT_PRESETS = [
  { label: "Morning", start: "07:00", end: "13:00" },
  { label: "Afternoon", start: "13:00", end: "19:00" },
  { label: "Evening", start: "16:00", end: "22:00" },
] as const;

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const isTime = (t: unknown): t is string => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const shiftHours = (start: string, end: string) => Math.round(((mins(end) - mins(start)) / 60) * 10) / 10;
export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => mins(a.start) < mins(b.end) && mins(b.start) < mins(a.end);

/** Monday of the week containing this date */
export function weekStart(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return toDateStr(x);
}

export function weekDays(monday: string) {
  const d = new Date(monday + "T12:00");
  return Array.from({ length: 7 }, (_, i) => toDateStr(new Date(d.getTime() + i * 86_400_000)));
}

export const fmtTime = (t: string) => {
  const h = Number(t.slice(0, 2));
  const m = t.slice(3, 5);
  const ap = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === "00" ? `${h12}${ap}` : `${h12}:${m}${ap}`;
};
