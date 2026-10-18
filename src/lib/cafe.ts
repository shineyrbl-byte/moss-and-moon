// Opening hours, table booking slots, loyalty rules and events.

/** [open hour, close hour], or null for a day the café is closed */
export type DayHours = [number, number] | null;
export type Closure = { date: string; note: string };
/** Opening hours and holidays. Owners edit these in Admin → Overview; the server keeps
 * the current settings on globalThis and sends them to the browser with every page. */
export type CafeConfig = { hours: Record<number, DayHours>; closures: Closure[]; happyHour?: unknown; branches?: Branch[]; lastHour?: unknown; links?: CafeLinks };
/** Where to send guests: the Google review page, and a WhatsApp number (10 digits, India) */
export type CafeLinks = { googleReview: string; whatsapp: string };
export const cafeLinks = (): CafeLinks => cafeConfig().links ?? { googleReview: "", whatsapp: "" };
export const whatsappUrl = (text = "") => { const n = cafeLinks().whatsapp; return n ? `https://wa.me/91${n}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null; };

/** A café location. The main one ("main") uses the café's hours; others can have their own. */
export type Branch = { id: string; name: string; address: string; hours: Record<number, DayHours> | null; active: boolean };
export const MAIN_BRANCH: Branch = { id: "main", name: "Willow Lane", address: "14 Willow Lane", hours: null, active: true };

export const DEFAULT_HOURS: Record<number, DayHours> = { 0: [9, 18], 1: [7, 20], 2: [7, 20], 3: [7, 20], 4: [7, 20], 5: [7, 20], 6: [8, 22] };
export const DEFAULT_CONFIG: CafeConfig = { hours: DEFAULT_HOURS, closures: [] };

export const cafeConfig = (): CafeConfig => (globalThis as { __mmConfig?: CafeConfig }).__mmConfig ?? DEFAULT_CONFIG;
export const applyConfig = (c: CafeConfig) => void ((globalThis as { __mmConfig?: CafeConfig }).__mmConfig = c);

// ----- last-hour deals: leftover bakes cheaper just before closing -----
type Cat = "coffee" | "tea" | "cold" | "food" | "bakes" | "shop";
export type LastHour = { on: boolean; off: number; minutes: number; cats: Cat[] };
export const DEFAULT_LAST_HOUR: LastHour = { on: true, off: 0.3, minutes: 60, cats: ["bakes"] };
export const lastHour = (): LastHour => ((cafeConfig().lastHour as LastHour | undefined) ?? DEFAULT_LAST_HOUR);
/** The deal if it's on right now: the last hour (or however long the owner set) before this branch closes */
export function isLastHour(now = new Date(), branch?: string | null) {
  const l = lastHour();
  if (!l.on || (typeof process !== "undefined" && process.env?.HAPPY_HOUR === "off")) return false;
  const h = hoursOn(now, branch);
  if (!h) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= h[1] * 60 - l.minutes && mins < h[1] * 60;
}
const LH_WORDS: Record<string, string> = { coffee: "coffee", tea: "tea", cold: "cold drinks", food: "food", bakes: "bakes" };
export const lastHourLabel = (l = lastHour()) => `Last-hour deal · ${Math.round(l.off * 100)}% off ${l.cats.map((c) => LH_WORDS[c] ?? c).join(" & ")} before we close`;

/** Every branch, main first */
export const allBranches = (): Branch[] => {
  const list = cafeConfig().branches ?? [];
  const main = list.find((b) => b.id === "main");
  return [{ ...MAIN_BRANCH, ...main, id: "main", hours: null, active: true }, ...list.filter((b) => b.id !== "main")];
};
export const activeBranches = () => allBranches().filter((b) => b.active);
/** A branch by id; unknown or closed-down ids fall back to the main café */
export const findBranch = (id?: string | null) => activeBranches().find((b) => b.id === id) ?? allBranches()[0];

/** The usual hours on a weekday (0 = Sunday), ignoring holidays */
export const weeklyHours = (day: number, branch?: string | null): DayHours => {
  const b = branch && branch !== "main" ? findBranch(branch) : null;
  return (b?.hours ? b.hours[day] : cafeConfig().hours[day]) ?? null;
};
export const closureOn = (d: Date) => cafeConfig().closures.find((c) => c.date === toDateStr(d)) ?? null;
/** Hours on a particular date: null if it's a closed weekday or a holiday (holidays apply to every branch) */
export const hoursOn = (d: Date, branch?: string | null): DayHours => (closureOn(d) ? null : weeklyHours(d.getDay(), branch));

export const hourText = (x: number) => (x === 0 || x === 24 ? "12am" : x === 12 ? "12pm" : x > 12 ? `${x - 12}pm` : `${x}am`);
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon – Fri 7am – 8pm" style rows, grouping days in a row with the same hours (Monday first) */
export function hoursLabel(branch?: string | null) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const rows: { days: string; time: string; from: number; to: number }[] = [];
  for (const d of order) {
    const h = weeklyHours(d, branch);
    const time = h ? `${hourText(h[0])} – ${hourText(h[1])}` : "Closed";
    const last = rows[rows.length - 1];
    if (last && last.time === time) last.to = d;
    else rows.push({ days: "", time, from: d, to: d });
  }
  return rows.map((r) => ({ days: r.from === r.to ? DAY_NAMES[r.from] : `${SHORT[r.from]} – ${SHORT[r.to]}`, time: r.time, today: false, from: r.from, to: r.to }));
}

export const TABLES_PER_SLOT = 6;
/** Groups this big pay a small deposit online, which comes off their bill */
export const DEPOSIT = { minGuests: 6, perGuest: 100, holdMinutes: 30 };
/** Tables with a QR code for ordering from your seat (1 to TABLE_COUNT) */
export const TABLE_COUNT = 12;
export const STAMPS_FOR_REWARD = 10;

export const ORDER_STEPS = ["received", "brewing", "ready", "collected"] as const;
export type OrderStatus = (typeof ORDER_STEPS)[number];

// Demo barista timings (see lib/orderFlow.ts)
/** Minutes after the order starts at which it reaches each status */
export const DEMO_TIMES: Record<Exclude<OrderStatus, "received">, number> = { brewing: 1, ready: 3, collected: 15 };
const DELIVERY_EXTRA = 10; // a delivery spends longer "on its way"

/** Where an order should be now, given minutes since it started */
export function demoStatus(minutes: number, delivery: boolean): OrderStatus {
  if (minutes >= DEMO_TIMES.collected + (delivery ? DELIVERY_EXTRA : 0)) return "collected";
  if (minutes >= DEMO_TIMES.ready) return "ready";
  if (minutes >= DEMO_TIMES.brewing) return "brewing";
  return "received";
}


const pad = (n: number) => String(n).padStart(2, "0");
export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseDate(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Bookable times for a date: every 30 min, last booking 1 hour before close. */
export function slotsFor(dateStr: string, branch?: string | null): string[] {
  const d = parseDate(dateStr);
  if (!d) return [];
  const h = hoursOn(d, branch);
  if (!h) return [];
  const [open, close] = h;
  const out: string[] = [];
  for (let t = open * 60; t <= (close - 1) * 60; t += 30) out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  // Hide times that have already passed today
  if (dateStr === toDateStr(new Date())) {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    return out.filter((s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3)) > mins);
  }
  return out;
}

export function openStatus(now = new Date(), branch?: string | null) {
  const closure = closureOn(now);
  const today = hoursOn(now, branch);
  const nextOpen = () => {
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
      const h = hoursOn(d, branch);
      if (h) return i === 1 ? `tomorrow at ${hourText(h[0])}` : `${DAY_NAMES[d.getDay()]} at ${hourText(h[0])}`;
    }
    return "soon";
  };
  if (!today) return { open: false, text: closure ? `Closed today${closure.note ? ` · ${closure.note}` : ""} · back ${nextOpen()}` : `Closed today · open ${nextOpen()}` };
  const [open, close] = today;
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= open && h < close) return { open: true, text: `Open now · until ${hourText(close)}` };
  return { open: false, text: h < open ? `Closed · opens at ${hourText(open)}` : `Closed · open ${nextOpen()}` };
}

/** price 0 = free (just RSVP); otherwise guests buy a ticket */
export type CafeEvent = { id: string; title: string; date: string; time: string; desc: string; img: string; capacity: number; price: number; /** events made together as a repeating series */ series?: string };

/** The starting events (owners add and edit events in Admin → Events) */
export const SEED_EVENTS: CafeEvent[] = [
  { id: "latte-art", title: "Latte Art for Beginners", date: "2026-10-24", time: "11:00", desc: "Pour your first heart (and maybe a tulip). Milk, cups and laughs included.", img: "1495474472287-4d71bcdd2085", capacity: 12, price: 499 },
  { id: "open-mic", title: "Moonlit Open Mic", date: "2026-10-31", time: "19:00", desc: "Poetry, guitars and pumpkin spice by candlelight. Sign up to perform at the counter.", img: "1501339847302-ac426a4a7cbb", capacity: 40, price: 0 },
  { id: "vinyl-sunday", title: "Vinyl & Pastry Sunday", date: "2026-11-08", time: "10:00", desc: "Bring a record, get a free pastry. We'll play every one.", img: "1445116572660-236099ec97a0", capacity: 30, price: 0 },
  { id: "matcha-tasting", title: "Matcha Tasting Flight", date: "2026-11-14", time: "16:00", desc: "Taste four grades of matcha side by side and learn to whisk.", img: "1536256263959-770b48d82b0a", capacity: 10, price: 699 },
];

export const GALLERY = [
  { img: "1600093463592-8e36ae95ef56", caption: "the greenhouse corner" },
  { img: "1501339847302-ac426a4a7cbb", caption: "neon & night shifts" },
  { img: "1569864358642-9d1684040f43", caption: "macaron mornings" },
  { img: "1445116572660-236099ec97a0", caption: "window seat, 4pm" },
  { img: "1507133750040-4a8f57021571", caption: "two lattes, one table" },
  { img: "1493857671505-72967e2e2760", caption: "bikes parked outside" },
  { img: "1509042239860-f550ce710b93", caption: "plants & pours" },
  { img: "1559925393-8be0ec4767c8", caption: "the terrace" },
];

// ---------- "How busy is it?" ----------
export type BusyLevel = "quiet" | "cosy" | "packed";

/** A typical café day (0–1 per hour), used until there's enough order history */
export const TYPICAL_DAY: Record<number, number> = {
  7: 0.35, 8: 0.7, 9: 0.8, 10: 0.55, 11: 0.45, 12: 0.6, 13: 0.65, 14: 0.4, 15: 0.35, 16: 0.55, 17: 0.6, 18: 0.5, 19: 0.45, 20: 0.4, 21: 0.3,
};

export const busyLevel = (score: number): BusyLevel => (score < 0.34 ? "quiet" : score < 0.67 ? "cosy" : "packed");

export const BUSY_LABEL: Record<BusyLevel, { icon: string; text: string }> = {
  quiet: { icon: "🌿", text: "Quiet" },
  cosy: { icon: "☕", text: "Cosy" },
  packed: { icon: "🔥", text: "Packed" },
};

export const hourLabel = (h: number) => (h === 0 ? "12am" : h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`);

/**
 * Expected busyness for each open hour today (0–1).
 * history: average orders per hour on this weekday (null when there isn't enough history yet).
 */
export function forecastDay(day: number, history: Record<number, number> | null, bookedGuests: Record<number, number> = {}, hours: DayHours = weeklyHours(day)) {
  if (!hours) return [];
  const [open, close] = hours;
  const peak = history ? Math.max(1, ...Object.values(history)) : 1;
  const out: { hour: number; score: number }[] = [];
  for (let h = open; h < close; h++) {
    const base = history ? (history[h] ?? 0) / peak : (TYPICAL_DAY[h] ?? 0.3);
    const seats = Math.min(1, (bookedGuests[h] ?? 0) / (TABLES_PER_SLOT * 4));
    out.push({ hour: h, score: Math.min(1, Math.round((base * 0.75 + seats * 0.25) * 100) / 100) });
  }
  return out;
}

/** The quietest hour still to come today */
export function quietestHour(forecast: { hour: number; score: number }[], now = new Date()) {
  const ahead = forecast.filter((f) => f.hour > now.getHours());
  if (!ahead.length) return null;
  return ahead.reduce((best, f) => (f.score < best.score ? f : best)).hour;
}
