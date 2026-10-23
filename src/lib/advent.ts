// December advent calendar: a door a day, 1–24 December, each hiding a one-day promo code.
// Codes are real promos (so checkout already understands them) and stay hidden until their day.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";

type Treat = { kind: "percent" | "amount"; value: number; min: number; title: string; pair: string };
export const ADVENT_TREATS: Treat[] = [
  { kind: "amount", value: 50, min: 250, title: "₹50 off to start the month", pair: "Gingerbread Latte" },
  { kind: "percent", value: 15, min: 0, title: "15% off everything", pair: "Hot Chocolate & Marshmallows" },
  { kind: "amount", value: 40, min: 200, title: "₹40 off a cosy afternoon", pair: "Cinnamon Roll" },
  { kind: "percent", value: 10, min: 0, title: "10% off, just because", pair: "Rose Masala Chai" },
  { kind: "amount", value: 60, min: 350, title: "₹60 off brunch", pair: "Akuri on Toast" },
  { kind: "percent", value: 20, min: 500, title: "20% off when you bring friends", pair: "Coffee Tasting Flight" },
  { kind: "amount", value: 30, min: 150, title: "₹30 off any coffee", pair: "Flat White" },
  { kind: "percent", value: 15, min: 300, title: "15% off bakes and a coffee", pair: "Bebinca" },
  { kind: "amount", value: 50, min: 300, title: "₹50 off a mid-week treat", pair: "Biscoff Cheesecake Jar" },
  { kind: "percent", value: 12, min: 0, title: "12% off for the 10th", pair: "Dirty Chai Latte" },
  { kind: "amount", value: 70, min: 400, title: "₹70 off lunch for two", pair: "Mezze Bowl" },
  { kind: "percent", value: 15, min: 0, title: "15% off, halfway to Christmas Eve", pair: "Christmas Fruit & Nut Bark" },
  { kind: "amount", value: 40, min: 200, title: "₹40 off a weekend sip", pair: "Saffron Pista Latte" },
  { kind: "percent", value: 20, min: 600, title: "20% off a big order", pair: "Build a Gift Hamper" },
  { kind: "amount", value: 50, min: 250, title: "₹50 off something sweet", pair: "Pink Velvet Cake" },
  { kind: "percent", value: 10, min: 0, title: "10% off for the early birds", pair: "Butter Croissant" },
  { kind: "amount", value: 60, min: 350, title: "₹60 off a long chat", pair: "Oolong Pot for Two" },
  { kind: "percent", value: 15, min: 0, title: "15% off a week before Christmas", pair: "Black Forest Cake" },
  { kind: "amount", value: 40, min: 200, title: "₹40 off a cold one", pair: "Slow Cold Brew" },
  { kind: "percent", value: 18, min: 400, title: "18% off gifts to take home", pair: "Café Candle · Coffee & Fig" },
  { kind: "amount", value: 50, min: 250, title: "₹50 off the shortest day", pair: "Turmeric Honey Latte" },
  { kind: "percent", value: 15, min: 0, title: "15% off, three days to go", pair: "Serradura" },
  { kind: "amount", value: 80, min: 500, title: "₹80 off the big Christmas order", pair: "Gingerbread Latte" },
  { kind: "percent", value: 25, min: 300, title: "25% off on Christmas Eve 🎄", pair: "Hot Chocolate & Marshmallows" },
];

const code = (year: number, day: number) => `ADVENT${String(year).slice(2)}${String(day).padStart(2, "0")}`;
const dateOf = (year: number, day: number) => `${year}-12-${String(day).padStart(2, "0")}`;

/** Make this year's 24 codes (once; editing a code in Promos is kept) */
export function ensureAdvent(year: number) {
  const add = db.prepare("INSERT OR IGNORE INTO promos (code, kind, value, min_order, once_per_guest, starts, expires, note) VALUES (?, ?, ?, ?, 1, ?, ?, ?)");
  ADVENT_TREATS.forEach((t, i) => add.run(code(year, i + 1), t.kind, t.value, t.min, dateOf(year, i + 1), dateOf(year, i + 1), `Advent calendar, door ${i + 1}`));
}

/** The calendar for a date. Doors open on their day; `preview` (owner) opens them all. */
export function adventFor(now = new Date(), preview = false) {
  const year = now.getFullYear();
  ensureAdvent(year);
  const today = toDateStr(now);
  const doors = ADVENT_TREATS.map((t, i) => {
    const day = i + 1, date = dateOf(year, day);
    const open = preview || today >= date;
    const live = today === date;
    return { day, date, open, live, past: today > date, ...(open ? { code: code(year, day), title: t.title, pair: t.pair, min: t.min } : {}) };
  });
  const started = today >= dateOf(year, 1);
  const finished = today > dateOf(year, 24);
  return { year, today, started, finished, preview, doors };
}
