// "A year with us": on the anniversary of a guest's account, their year in coffee and a treat
import "server-only";
import { db, getSetting, makeCode } from "./db";
import { sendEmail } from "./email";
import { unsubUrl } from "./newsletter";
import { rupees, type QuoteLine } from "./pricing";
import { toDateStr } from "./cafe";

export const ANNIVERSARY = { minOrders: 3, off: 20, validDays: 21 };
export const anniversaryOn = () => getSetting("anniversary") !== "off";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const SITE = () => process.env.SITE_URL || "http://localhost:3000";

type C = { id: number; email: string; name: string | null; phone: string | null; created_at: string };

/** Their year: visits, favourite, time of day, and total (from the last 12 months of orders) */
export function yearInCoffee(c: C) {
  const orders = db.prepare("SELECT lines, total, created_at FROM orders WHERE (customer_id = ? OR lower(email) = lower(?)) AND created_at >= datetime('now','localtime','-365 days') AND status != 'cancelled'").all(c.id, c.email) as { lines: string; total: number; created_at: string }[];
  const counts = new Map<string, number>();
  let cups = 0;
  const hours = new Map<number, number>();
  for (const o of orders) {
    for (const l of JSON.parse(o.lines) as QuoteLine[]) {
      counts.set(l.name, (counts.get(l.name) ?? 0) + l.qty);
      if (["coffee", "tea", "cold"].includes(l.cat ?? "")) cups += l.qty;
    }
    const h = Number(o.created_at.slice(11, 13));
    hours.set(h, (hours.get(h) ?? 0) + 1);
  }
  const fav = [...counts].sort((a, b) => b[1] - a[1])[0] ?? null;
  const peak = [...hours].sort((a, b) => b[1] - a[1])[0]?.[0];
  const when = peak === undefined ? null : peak < 11 ? "an early bird" : peak < 15 ? "a lunchtime regular" : peak < 18 ? "an afternoon sipper" : "a night owl";
  return { visits: orders.length, cups, favourite: fav ? { name: fav[0], times: fav[1] } : null, when, spent: Math.round(orders.reduce((s, o) => s + o.total, 0)) };
}

/** Accounts made on today's date in an earlier year, with enough orders, not emailed this year */
export function dueToday(now = new Date()) {
  const md = toDateStr(now).slice(5);
  const year = now.getFullYear();
  return (db.prepare(
    `SELECT id, email, name, phone, created_at FROM customers
     WHERE substr(created_at, 6, 5) = ? AND CAST(substr(created_at, 1, 4) AS INTEGER) < ?
       AND id NOT IN (SELECT customer_id FROM anniversaries WHERE year = ?)
       AND lower(email) NOT IN (SELECT email FROM no_marketing)`,
  ).all(md, year, year) as C[]).filter((c) => yearInCoffee(c).visits >= ANNIVERSARY.minOrders);
}

export async function sendAnniversary(c: C, now = new Date()) {
  const y = yearInCoffee(c);
  const years = now.getFullYear() - Number(c.created_at.slice(0, 4));
  const code = makeCode("YEAR", 5);
  const expires = toDateStr(new Date(now.getTime() + ANNIVERSARY.validDays * 86_400_000));
  db.prepare("INSERT INTO promos (code, kind, value, max_uses, once_per_guest, expires, note) VALUES (?, 'percent', ?, 1, 1, ?, ?)").run(code, ANNIVERSARY.off, expires, `Anniversary: ${c.email}`);
  db.prepare("INSERT INTO anniversaries (customer_id, year, code) VALUES (?, ?, ?)").run(c.id, now.getFullYear(), code);
  const first = (c.name || "friend").split(" ")[0];
  const stat = (n: string | number, label: string) => `<td style="text-align:center;padding:10px;background:#fadbe3;border-radius:14px"><div style="font-family:Georgia,serif;font-size:28px">${n}</div><div style="font-size:12px;color:#8a6a5c">${label}</div></td>`;
  await sendEmail(
    c.email,
    `Happy ${years === 1 ? "first" : `${years}-year`} Moss & Moon anniversary, ${first} 🌸`,
    `<p>${years === 1 ? "A whole year" : `${years} years`} ago today you joined Moss &amp; Moon. Here's your year in coffee:</p>
     <table style="width:100%;border-collapse:separate;border-spacing:8px"><tr>${stat(y.visits, "visits")}${stat(y.cups, "drinks")}${stat(rupees(y.spent), "of treats")}</tr></table>
     ${y.favourite ? `<p>Your favourite: <b>${esc(y.favourite.name)}</b>, ${y.favourite.times} times.${y.when ? ` You're ${y.when} ☕` : ""}</p>` : ""}
     <p>To say thank you, here's <b>${ANNIVERSARY.off}% off</b> your next order (for the next three weeks):</p>
     <p style="font-family:monospace;font-size:22px;letter-spacing:3px;background:#fadbe3;display:inline-block;padding:8px 16px;border-radius:10px">${esc(code)}</p>
     <p><a href="${SITE()}/#menu">See you soon</a></p>
     <p style="margin-top:22px;color:#8a6a5c;font-size:12px">Don't want emails like this? <a href="${unsubUrl(c.email)}" style="color:#8a6a5c">Unsubscribe</a></p>`,
    [],
    { headers: { "List-Unsubscribe": `<${unsubUrl(c.email)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } },
  );
  return code;
}

/** Called every hour: sends today's, in the daytime */
export async function anniversaryTick(now = new Date()) {
  if (!anniversaryOn() || now.getHours() < 10 || now.getHours() >= 18) return;
  for (const c of dueToday(now).slice(0, 30)) await sendAnniversary(c, now);
}
