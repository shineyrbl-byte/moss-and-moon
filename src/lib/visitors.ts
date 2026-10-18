// Visitor stats without trackers or cookies: each visitor is counted once a day using a
// hash of their IP + browser with a salt that changes daily, so nobody can be followed across days.
import "server-only";
import crypto from "node:crypto";
import { db, getSetting, setSetting } from "./db";
import { toDateStr } from "./cafe";

const BOTS = /bot|crawl|spider|slurp|preview|lighthouse|headless|curl|wget|python|monitor|uptime|facebookexternalhit|whatsapp/i;
const PRIVATE = /^\/(admin|staff|board|print|api|_next)/;

/** Group pages with codes in them (so every order page counts as one page) */
export function normalisePath(raw: string) {
  const p = (raw.split("?")[0].split("#")[0] || "/").slice(0, 120);
  return p
    .replace(/^\/order\/[^/]+$/, "/order/[code]")
    .replace(/^\/g\/(?!new$)[^/]+$/, "/g/[group]")
    .replace(/^\/d\/[^/]+$/, "/d/[gift]")
    .replace(/^\/ticket\/[^/]+$/, "/ticket/[code]")
    .replace(/^\/review\/[^/]+$/, "/review/[code]")
    .replace(/^\/t\/\d+$/, "/t/[table]");
}

export const deviceOf = (ua: string) => (/iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "phone" : "desktop");

function salt(day: string) {
  const saved = getSetting("visit_salt");
  if (saved?.startsWith(day + ":")) return saved.slice(day.length + 1);
  const s = crypto.randomBytes(16).toString("hex");
  setSetting("visit_salt", `${day}:${s}`); // yesterday's salt is gone, so yesterday's hashes can't be linked
  return s;
}

export function recordHit(input: { path: string; ref?: string; ip: string; ua: string; host?: string }) {
  if (!input.ua || BOTS.test(input.ua)) return false;
  const path = normalisePath(input.path);
  if (PRIVATE.test(path)) return false;
  const day = toDateStr(new Date());
  let ref = "";
  try {
    const h = input.ref ? new URL(input.ref).hostname.replace(/^www\./, "") : "";
    if (h && h !== input.host?.split(":")[0]) ref = h.slice(0, 60);
  } catch {}
  const vid = crypto.createHash("sha256").update(`${salt(day)}|${input.ip}|${input.ua}`).digest("hex").slice(0, 20);
  db.prepare("INSERT OR IGNORE INTO visits (day, vid, device) VALUES (?, ?, ?)").run(day, vid, deviceOf(input.ua));
  db.prepare("INSERT INTO page_views (day, path, ref, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, path, ref) DO UPDATE SET n = n + 1").run(day, path, ref);
  return true;
}

export function visitorReport(days = 30) {
  const since = toDateStr(new Date(Date.now() - (days - 1) * 86_400_000));
  const perDay = new Map((db.prepare("SELECT day, COUNT(*) AS v FROM visits WHERE day >= ? GROUP BY day").all(since) as { day: string; v: number }[]).map((r) => [r.day, r.v]));
  const views = new Map((db.prepare("SELECT day, SUM(n) AS n FROM page_views WHERE day >= ? GROUP BY day").all(since) as { day: string; n: number }[]).map((r) => [r.day, r.n]));
  const orders = new Map((db.prepare("SELECT date(created_at) AS day, COUNT(*) AS n FROM orders WHERE date(created_at) >= ? GROUP BY day").all(since) as { day: string; n: number }[]).map((r) => [r.day, r.n]));
  const daily = Array.from({ length: days }, (_, i) => {
    const d = toDateStr(new Date(Date.now() - (days - 1 - i) * 86_400_000));
    return { day: d, visitors: perDay.get(d) ?? 0, views: views.get(d) ?? 0, orders: orders.get(d) ?? 0 };
  });
  const visitors = daily.reduce((s, d) => s + d.visitors, 0);
  const totalOrders = daily.reduce((s, d) => s + d.orders, 0);
  return {
    days,
    visitors,
    views: daily.reduce((s, d) => s + d.views, 0),
    orders: totalOrders,
    conversion: visitors ? Math.round((totalOrders / visitors) * 1000) / 10 : 0,
    daily,
    pages: db.prepare("SELECT path, SUM(n) AS n FROM page_views WHERE day >= ? GROUP BY path ORDER BY n DESC LIMIT 8").all(since),
    referrers: db.prepare("SELECT ref, SUM(n) AS n FROM page_views WHERE day >= ? AND ref != '' GROUP BY ref ORDER BY n DESC LIMIT 6").all(since),
    devices: db.prepare("SELECT device, COUNT(*) AS n FROM visits WHERE day >= ? GROUP BY device ORDER BY n DESC").all(since),
  };
}
