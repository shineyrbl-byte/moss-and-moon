// Opening hours, table booking slots, loyalty rules and events.

/** [open hour, close hour] for each weekday, 0 = Sunday */
export const HOURS: Record<number, [number, number]> = {
  0: [9, 18],
  1: [7, 20],
  2: [7, 20],
  3: [7, 20],
  4: [7, 20],
  5: [7, 20],
  6: [8, 22],
};

export const HOURS_LABEL = [
  { days: "Mon – Fri", time: "7am – 8pm" },
  { days: "Saturday", time: "8am – 10pm" },
  { days: "Sunday", time: "9am – 6pm" },
];

export const TABLES_PER_SLOT = 6;
/** Tables with a QR code for ordering from your seat (1 to TABLE_COUNT) */
export const TABLE_COUNT = 12;
export const STAMPS_FOR_REWARD = 10;

export const ORDER_STEPS = ["received", "brewing", "ready", "collected"] as const;
export type OrderStatus = (typeof ORDER_STEPS)[number];

const pad = (n: number) => String(n).padStart(2, "0");
export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseDate(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Bookable times for a date: every 30 min, last booking 1 hour before close. */
export function slotsFor(dateStr: string): string[] {
  const d = parseDate(dateStr);
  if (!d) return [];
  const [open, close] = HOURS[d.getDay()];
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

export function openStatus(now = new Date()) {
  const [open, close] = HOURS[now.getDay()];
  const h = now.getHours() + now.getMinutes() / 60;
  const fmt = (x: number) => (x === 12 ? "12pm" : x > 12 ? `${x - 12}pm` : `${x}am`);
  if (h >= open && h < close) return { open: true, text: `Open now · until ${fmt(close)}` };
  return { open: false, text: h < open ? `Closed · opens at ${fmt(open)}` : "Closed · see you tomorrow" };
}

export type CafeEvent = { id: string; title: string; date: string; time: string; desc: string; img: string; capacity: number };

export const EVENTS: CafeEvent[] = [
  { id: "latte-art", title: "Latte Art for Beginners", date: "2026-10-24", time: "11:00", desc: "Pour your first heart (and maybe a tulip). Milk, cups and laughs included.", img: "1495474472287-4d71bcdd2085", capacity: 12 },
  { id: "open-mic", title: "Moonlit Open Mic", date: "2026-10-31", time: "19:00", desc: "Poetry, guitars and pumpkin spice by candlelight. Sign up to perform at the counter.", img: "1501339847302-ac426a4a7cbb", capacity: 40 },
  { id: "vinyl-sunday", title: "Vinyl & Pastry Sunday", date: "2026-11-08", time: "10:00", desc: "Bring a record, get a free pastry. We'll play every one.", img: "1445116572660-236099ec97a0", capacity: 30 },
  { id: "matcha-tasting", title: "Matcha Tasting Flight", date: "2026-11-14", time: "16:00", desc: "Taste four grades of matcha side by side and learn to whisk.", img: "1536256263959-770b48d82b0a", capacity: 10 },
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
