// Swiggy and Zomato: their orders land on the barista screen like any other order, tagged 🛵.
// Two ways in: staff type an order from the platform's tablet, or a partner/middleware webhook posts it.
// The platform has already taken the money, so these are marked paid.
import "server-only";
import crypto from "node:crypto";
import { db, makeCode, cleanText, getSetting, setSetting } from "./db";
import { menuLookup, getMenu } from "./menuStore";
import { quote } from "./pricing";
import { withCosts } from "./profit";
import { checkStock, consumeStock } from "./stock";
import { publish } from "./live";

export const PLATFORMS = { swiggy: { label: "Swiggy", icon: "🛵" }, zomato: { label: "Zomato", icon: "🛵" } } as const;
export type Platform = keyof typeof PLATFORMS;
export const isPlatform = (p: unknown): p is Platform => p === "swiggy" || p === "zomato";

export type PlatformSettings = { on: boolean; markup: number; commission: number };
export type AggregatorSettings = Record<Platform, PlatformSettings> & { secret: string };

const DEFAULTS: Record<Platform, PlatformSettings> = { swiggy: { on: false, markup: 15, commission: 22 }, zomato: { on: false, markup: 15, commission: 22 } };
const clampPct = (v: unknown, d: number) => { const n = Math.round(Number(v)); return n >= 0 && n <= 60 ? n : d; };

export function aggregatorSettings(): AggregatorSettings {
  let saved: Partial<AggregatorSettings> = {};
  try { saved = JSON.parse(getSetting("aggregators") ?? "{}"); } catch {}
  let secret = saved.secret;
  if (!secret) { secret = crypto.randomBytes(18).toString("base64url"); setSetting("aggregators", JSON.stringify({ ...saved, secret })); }
  const one = (p: Platform): PlatformSettings => ({ ...DEFAULTS[p], ...(saved[p] ?? {}) });
  return { swiggy: one("swiggy"), zomato: one("zomato"), secret };
}

export function saveAggregatorSettings(b: Record<string, unknown>) {
  const cur = aggregatorSettings();
  const next: AggregatorSettings = { ...cur };
  for (const p of ["swiggy", "zomato"] as const) {
    const x = (b[p] ?? {}) as Record<string, unknown>;
    next[p] = { on: x.on === undefined ? cur[p].on : !!x.on, markup: x.markup === undefined ? cur[p].markup : clampPct(x.markup, cur[p].markup), commission: x.commission === undefined ? cur[p].commission : clampPct(x.commission, cur[p].commission) };
  }
  if (b.newSecret) next.secret = crypto.randomBytes(18).toString("base64url");
  setSetting("aggregators", JSON.stringify(next));
  return next;
}

/** Does this request carry the webhook secret? (header "x-mm-secret" or "Authorization: Bearer …") */
export function webhookAllowed(req: Request) {
  const given = req.headers.get("x-mm-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given), b = Buffer.from(aggregatorSettings().secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The price a dish is listed at on a platform (menu price plus the markup, rounded to ₹5) */
export const platformPrice = (price: number, markup: number) => Math.round((price * (1 + markup / 100)) / 5) * 5;

type InLine = { itemId?: unknown; name?: unknown; qty?: unknown };
export type AggregatorOrderIn = { ref?: unknown; customer?: unknown; lines?: unknown; total?: unknown; note?: unknown };

/** Add a platform order. Lines can name dishes by id or by name (as the platform shows them). */
export function addAggregatorOrder(platform: Platform, b: AggregatorOrderIn): { code: string; duplicate?: boolean } | { error: string; status: number } {
  const s = aggregatorSettings()[platform];
  const ref = cleanText(b.ref, 40).replace(/\s+/g, "");
  if (!ref) return { error: `Add the ${PLATFORMS[platform].label} order number.`, status: 400 };
  const dupe = db.prepare("SELECT code FROM orders WHERE source = ? AND source_ref = ?").get(platform, ref) as { code: string } | undefined;
  if (dupe) return { code: dupe.code, duplicate: true };

  const menu = getMenu();
  const byName = new Map(menu.map((m) => [m.name.toLowerCase().replace(/\s+/g, " ").trim(), m.id]));
  const find = menuLookup();
  const raw = (Array.isArray(b.lines) ? b.lines : []).slice(0, 30).map((l: InLine) => {
    const id = typeof l.itemId === "string" && find(l.itemId) ? l.itemId : byName.get(String(l.name ?? "").toLowerCase().replace(/\s+/g, " ").trim());
    return { itemId: id ?? "", qty: Math.max(1, Math.min(20, Math.floor(Number(l.qty) || 1))), name: String(l.name ?? l.itemId ?? "") };
  });
  const unknown = raw.find((l) => !l.itemId);
  if (unknown) return { error: `We couldn't match “${unknown.name.slice(0, 40)}” to a dish on the menu.`, status: 400 };
  if (!raw.length) return { error: "Add at least one dish.", status: 400 };

  const q = quote(raw.map((l) => ({ itemId: l.itemId, qty: l.qty })), find, null, false, {});
  if (!q.lines.length) return { error: "Add at least one dish.", status: 400 };
  const stock = checkStock(q.lines);
  if (stock) return { error: `We've run out of ${stock}. Mark the dish unavailable on ${PLATFORMS[platform].label} too.`, status: 409 };
  // What the guest paid on the platform (as sent), or our menu total plus the markup
  const sent = Math.round(Number(b.total));
  const total = sent > 0 && sent < 100000 ? sent : platformPrice(q.subtotal, s.markup);
  const customer = cleanText(b.customer, 30) || "Guest";
  const note = [`${PLATFORMS[platform].icon} ${PLATFORMS[platform].label} #${ref}`, "rider pickup", cleanText(b.note, 150)].filter(Boolean).join(" · ");
  const code = makeCode("MM", 6);
  db.prepare(
    `INSERT INTO orders (code, name, phone, pickup, note, lines, subtotal, discount, total, pay_method, pay_status, source, source_ref, branch)
     VALUES (?, ?, '', 'asap', ?, ?, ?, 0, ?, ?, 'paid', ?, ?, 'main')`
  ).run(code, `${customer} (${PLATFORMS[platform].label})`, note, JSON.stringify(withCosts(q.lines, find)), total, total, platform, platform, ref);
  consumeStock(q.lines);
  publish({ type: "order", code, action: "new" });
  return { code };
}

/** Orders, takings, the platforms' cut and what's left, for the last N days */
export function aggregatorSummary(days = 7) {
  const s = aggregatorSettings();
  const rows = db.prepare(`SELECT source, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS gross FROM orders WHERE source IN ('swiggy','zomato') AND status != 'cancelled' AND created_at >= datetime('now','localtime', ?) GROUP BY source`).all(`-${days} days`) as { source: Platform; orders: number; gross: number }[];
  return (["swiggy", "zomato"] as const).map((p) => {
    const r = rows.find((x) => x.source === p) ?? { orders: 0, gross: 0 };
    const commission = Math.round((r.gross * s[p].commission) / 100);
    return { platform: p, label: PLATFORMS[p].label, orders: r.orders, gross: r.gross, commission, net: r.gross - commission };
  });
}

/** A menu file to list the café on a platform: one row per dish, prices with the markup */
export function platformMenuCsv(platform: Platform) {
  const s = aggregatorSettings()[platform];
  const esc = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = getMenu().filter((m) => m.cat !== "shop" && !m.groups?.length);
  const head = ["Item ID", "Name", "Category", "Price (₹)", "Menu price (₹)", "Veg", "Description"];
  const lines = rows.map((m) => [m.id, m.name, m.cat, platformPrice(m.price, s.markup), m.price, m.allergens?.includes("fish") || m.allergens?.includes("shellfish") || /chicken|chorizo|prawn/i.test(m.name + m.desc) ? "Non-veg" : "Veg", m.desc].map(esc).join(","));
  return [head.join(","), ...lines].join("\n");
}
