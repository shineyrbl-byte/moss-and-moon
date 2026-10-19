// Demo reset: clear test activity and fill the café with a month of believable sample data.
// Keeps the menu, settings, staff, accounts and events. A backup is made first.
import "server-only";
import { db, makeCode } from "./db";
import { makeBackup } from "./backup";
import { getMenu } from "./menuStore";
import { TYPICAL_DAY, hoursOn, toDateStr } from "./cafe";
import { defaultOptions, quote, type QuoteLine } from "./pricing";
import { withCosts } from "./profit";
import { menuLookup } from "./menuStore";

/** Activity tables cleared by a reset (accounts, menu, staff and settings are kept) */
const CLEAR = ["orders", "order_payments", "bookings", "waitlist", "loyalty", "reviews", "waste", "cashups", "missed_sales", "item_ratings", "stock_alerts", "support_messages", "support_chats", "cake_orders", "later_orders", "catering", "table_calls", "visits", "page_views", "handover_notes", "checklist_ticks", "winbacks"];

const NAMES = ["Ananya", "Kabir", "Meera", "Rohan", "Isha", "Arjun", "Diya", "Vihaan", "Sara", "Aditya", "Tara", "Neel", "Riya", "Zoya", "Kiran", "Aarav", "Maya", "Dev", "Nisha", "Omar", "Leela", "Yash", "Pooja", "Siddharth"];
const REVIEWS: [number, string][] = [
  [5, "The rose pistachio latte is unreal. Prettiest café in Panjim 🌸"], [5, "Came for the croissant, stayed four hours. The window seat is perfect."],
  [4, "Matcha is properly whisked. Gets busy on Saturdays though!"], [5, "Bebinca like my grandmother's. I'll be back every week."],
  [5, "Ordered ahead and it was ready the second I walked in."], [4, "Lovely cold brew, a bit pricey but worth it."],
  [5, "Staff remembered my order the second time ✿"], [3, "Nice place, but my toastie took a while on a busy morning."],
];
const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rand(a.length)];

export function demoReset(days = 30) {
  const backup = makeBackup("before-demo-reset");
  for (const t of CLEAR) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  db.prepare("DELETE FROM push_subs WHERE order_code != 'OWNER'").run();

  const menu = getMenu().filter((m) => m.cat !== "shop" && !m.groups?.length);
  const drinks = menu.filter((m) => ["coffee", "tea", "cold"].includes(m.cat));
  const food = menu.filter((m) => ["food", "bakes"].includes(m.cat));
  // Popular items come up more often
  const weighted = (list: typeof menu) => list.flatMap((m) => Array(m.badge === "bestseller" ? 5 : m.staffPick ? 3 : 1).fill(m));
  const wd = weighted(drinks), wf = weighted(food);
  const find = menuLookup();
  const phones = NAMES.map((_, i) => `98${String(10000000 + i * 137).slice(0, 8)}`);
  const insert = db.prepare(`INSERT INTO orders (code, name, phone, pickup, note, lines, subtotal, discount, total, pay_method, pay_status, status, table_no, tip, created_at, collected_at, branch)
    VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, 'paid', 'collected', ?, ?, ?, ?, 'main')`);
  const stamp = db.prepare("INSERT INTO loyalty (phone, name, stamps, rewards_used) VALUES (?, ?, 1, 0) ON CONFLICT(phone) DO UPDATE SET stamps = stamps + 1");
  let count = 0;
  const now = new Date();
  for (let d = days; d >= 1; d--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, 12);
    const h = hoursOn(day);
    if (!h) continue;
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    for (let hour = h[0]; hour < h[1]; hour++) {
      const n = Math.round((TYPICAL_DAY[hour] ?? 0.3) * (weekend ? 9 : 6) * (0.6 + Math.random() * 0.8));
      for (let k = 0; k < n; k++) {
        const who = rand(NAMES.length);
        const raw = [{ itemId: pick(wd).id, qty: 1 }, ...(Math.random() < 0.55 ? [{ itemId: pick(wf).id, qty: 1 }] : []), ...(Math.random() < 0.15 ? [{ itemId: pick(wd).id, qty: 1 }] : [])]
          .map((l) => ({ ...l, opts: defaultOptions(find(l.itemId)!) }));
        const q = quote(raw, find);
        if (!q.lines.length) continue;
        const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, rand(60));
        const ts = `${toDateStr(at)} ${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}:00`;
        const table = Math.random() < 0.3 ? 1 + rand(8) : null;
        const tip = Math.random() < 0.25 ? Math.round(q.total * 0.1) : 0;
        insert.run(makeCode("MM", 6), NAMES[who], phones[who], table ? "table" : "asap", JSON.stringify(withCosts(q.lines as QuoteLine[], find)), q.subtotal, q.subtotal - q.total, q.total, Math.random() < 0.6 ? "online" : "counter", table, tip, ts, ts);
        stamp.run(phones[who], NAMES[who]);
        count++;
      }
    }
  }
  const rev = db.prepare("INSERT INTO reviews (name, rating, text, created_at) VALUES (?, ?, ?, datetime('now','localtime', ?))");
  REVIEWS.forEach(([r, t], i) => rev.run(NAMES[i], r, t, `-${i * 3 + 1} days`));
  const book = db.prepare("INSERT INTO bookings (code, name, phone, date, time, guests, note) VALUES (?, ?, ?, ?, ?, ?, '')");
  for (let i = 1; i <= 8; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 + rand(6), 12);
    const h = hoursOn(day);
    if (h) book.run(makeCode("TB", 6), pick(NAMES), pick(phones), toDateStr(day), `${String(h[0] + 1 + rand(Math.max(1, h[1] - h[0] - 2))).padStart(2, "0")}:${pick(["00", "30"])}`, 2 + rand(4));
  }
  return { orders: count, backup: backup.name };
}
