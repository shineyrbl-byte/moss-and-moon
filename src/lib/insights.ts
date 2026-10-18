// Weekly AI help for the owner:
//  - a summary of what guests said in reviews (what they love, what to fix)
//  - business suggestions from sales, hours, stock and the rota
// Uses Claude or free Gemini when a key is set; otherwise a plain summary without AI.
import "server-only";
import { db, getSetting, setSetting } from "./db";
import { askJSON, aiProvider, type JsonSchema } from "./ai";
import { HOURS, toDateStr } from "./cafe";
import { rupees, type QuoteLine } from "./pricing";
import { ownerEmail, ownerPref } from "./owner";
import { sendEmail } from "./email";

export type ReviewSummary = { mood: string; loved: string[]; improve: string[]; quote: string | null; actions: string[]; count: number; avg: number | null };
export type Suggestion = { title: string; why: string; action: string; kind: "promote" | "drop" | "staff" | "price" | "stock" | "other" };
export type BusinessInsights = { headline: string; suggestions: Suggestion[] };
type Cached<T> = { at: string; provider: string; data: T };

const DAY = 86_400_000;
const STOP = new Set("the a an and or but to of in on at for with is was were it this that my our we i you so very really just too also had have has be been are not no its from as they them their me us all one get got".split(" "));

// ---------- reviews ----------
export async function summariseReviews(days = 7): Promise<Cached<ReviewSummary>> {
  const rows = db.prepare(`SELECT name, rating, text FROM reviews WHERE created_at >= datetime('now','localtime','-${Math.floor(days)} days') ORDER BY id DESC LIMIT 80`).all() as { name: string; rating: number; text: string }[];
  const avg = rows.length ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : null;
  const base = { count: rows.length, avg };
  if (!rows.length) return { at: new Date().toISOString(), provider: "none", data: { mood: "No new reviews this week.", loved: [], improve: [], quote: null, actions: [], ...base } };

  const schema: JsonSchema = {
    type: "object",
    properties: {
      mood: { type: "string", description: "One warm sentence on the overall feeling" },
      loved: { type: "array", items: { type: "string" }, description: "Up to 4 things guests loved, short" },
      improve: { type: "array", items: { type: "string" }, description: "Up to 4 things to fix, short (empty if none)" },
      quote: { type: "string", description: "The single best short quote, word for word" },
      actions: { type: "array", items: { type: "string" }, description: "Up to 3 concrete things the owner could do this week" },
    },
    required: ["mood", "loved", "improve", "quote", "actions"],
  };
  const ai = await askJSON<Omit<ReviewSummary, "count" | "avg">>(
    "You help the owner of a small café called Moss & Moon understand guest reviews. Be specific, kind and brief. Only use what the reviews say.",
    `Here are this week's reviews (rating out of 5, then text):\n\n${rows.map((r) => `${r.rating}★ ${r.name}: ${r.text}`).join("\n")}`,
    schema
  );
  if (ai) return { at: new Date().toISOString(), provider: ai.provider, data: { ...ai.data, loved: ai.data.loved.slice(0, 4), improve: ai.data.improve.slice(0, 4), actions: ai.data.actions.slice(0, 3), ...base } };

  // Without AI: the most common words in happy and unhappy reviews
  const words = (list: typeof rows) => {
    const c = new Map<string, number>();
    for (const r of list) for (const w of r.text.toLowerCase().match(/[a-z]{4,}/g) ?? []) if (!STOP.has(w)) c.set(w, (c.get(w) ?? 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w);
  };
  const happy = rows.filter((r) => r.rating >= 4);
  const unhappy = rows.filter((r) => r.rating <= 3);
  const best = [...happy].sort((a, b) => b.text.length - a.text.length).find((r) => r.text.length < 160);
  return {
    at: new Date().toISOString(),
    provider: "simple",
    data: {
      mood: `${rows.length} review${rows.length === 1 ? "" : "s"} this week, averaging ${avg}★.`,
      loved: words(happy).map((w) => `Mentioned a lot: “${w}”`),
      improve: unhappy.slice(0, 3).map((r) => `${r.rating}★ from ${r.name}: ${r.text.slice(0, 90)}`),
      quote: best?.text ?? null,
      actions: unhappy.length ? ["Read the lower-rated reviews and reply to those guests if you can."] : [],
      ...base,
    },
  };
}

// ---------- business ----------
function businessFacts() {
  const now = Date.now();
  const since = (d: number) => toDateStr(new Date(now - d * DAY));
  const orders = db.prepare("SELECT created_at, lines, total FROM orders WHERE date(created_at) >= ?").all(since(56)) as { created_at: string; lines: string; total: number }[];
  const recent = orders.filter((o) => o.created_at >= since(28));
  const before = orders.filter((o) => o.created_at < since(28));
  const items = (list: typeof orders) => {
    const m = new Map<string, number>();
    for (const o of list) for (const l of JSON.parse(o.lines) as QuoteLine[]) m.set(l.name, (m.get(l.name) ?? 0) + l.qty);
    return m;
  };
  const now28 = items(recent);
  const prev28 = items(before);
  const names = new Set([...now28.keys(), ...prev28.keys()]);
  const changes = [...names].map((n) => ({ name: n, now: now28.get(n) ?? 0, before: prev28.get(n) ?? 0 })).sort((a, b) => b.now - b.before - (a.now - a.before));
  const menu = (db.prepare("SELECT data FROM menu_items").all() as { data: string }[]).map((r) => JSON.parse(r.data) as { name: string; hidden?: boolean });
  const neverOrdered = menu.filter((m) => !m.hidden && !now28.has(m.name)).map((m) => m.name);

  const heat = new Map<string, number>();
  for (const o of recent) {
    const d = new Date(o.created_at.replace(" ", "T"));
    const k = `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${d.getHours()}:00`;
    heat.set(k, (heat.get(k) ?? 0) + 1);
  }
  const busiest = [...heat].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const low = db.prepare("SELECT name FROM ingredients WHERE qty <= low_at").all() as { name: string }[];
  const shifts = db.prepare("SELECT day, start, end FROM shifts WHERE day >= ?").all(toDateStr(new Date())) as { day: string; start: string; end: string }[];
  const waste = db.prepare("SELECT item_name, SUM(qty) AS q, SUM(cost) AS c FROM waste WHERE day >= ? GROUP BY item_name ORDER BY q DESC LIMIT 5").all(since(28)) as { item_name: string; q: number; c: number }[];
  const revenue = (l: typeof orders) => l.reduce((s, o) => s + o.total, 0);
  return {
    last28: { orders: recent.length, revenue: revenue(recent) },
    previous28: { orders: before.length, revenue: revenue(before) },
    risers: changes.slice(0, 4).filter((c) => c.now > c.before),
    fallers: changes.slice(-4).reverse().filter((c) => c.now < c.before),
    neverOrdered: neverOrdered.slice(0, 8),
    busiestSlots: busiest.map(([k, n]) => `${k} (${n} orders)`),
    openingHours: HOURS,
    lowStock: low.map((l) => l.name),
    shiftsComingUp: shifts.length,
    waste: waste.map((w) => `${w.item_name}: ${w.q} thrown away (${rupees(Math.round(w.c ?? 0))})`),
  };
}

export async function businessInsights(): Promise<Cached<BusinessInsights>> {
  const facts = businessFacts();
  const schema: JsonSchema = {
    type: "object",
    properties: {
      headline: { type: "string", description: "One sentence on how the café is doing" },
      suggestions: {
        type: "array",
        description: "3 to 5 practical suggestions, most useful first",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short, e.g. 'Push iced drinks after 3pm'" },
            why: { type: "string", description: "The numbers behind it, one sentence" },
            action: { type: "string", description: "Exactly what to do this week" },
            kind: { type: "string", enum: ["promote", "drop", "staff", "price", "stock", "other"] },
          },
          required: ["title", "why", "action", "kind"],
        },
      },
    },
    required: ["headline", "suggestions"],
  };
  const ai = await askJSON<BusinessInsights>(
    "You are a friendly, practical advisor for a small independent café in India called Moss & Moon. Base every suggestion on the numbers given. Prices are in rupees. Be concrete and brief. If there is very little data, say so and suggest how to get more customers.",
    `Here are the café's numbers (JSON):\n${JSON.stringify(facts, null, 1)}`,
    schema
  );
  if (ai) return { at: new Date().toISOString(), provider: ai.provider, data: { ...ai.data, suggestions: ai.data.suggestions.slice(0, 5) } };

  // Without AI: a few rules of thumb
  const s: Suggestion[] = [];
  const { last28, previous28 } = facts;
  const change = previous28.revenue ? Math.round(((last28.revenue - previous28.revenue) / previous28.revenue) * 100) : null;
  if (facts.risers[0]) s.push({ kind: "promote", title: `Feature the ${facts.risers[0].name}`, why: `Up from ${facts.risers[0].before} to ${facts.risers[0].now} sold in the last 4 weeks.`, action: "Give it a 'bestseller' badge in the menu editor and post it on Instagram." });
  if (facts.fallers[0]) s.push({ kind: "drop", title: `Check on the ${facts.fallers[0].name}`, why: `Down from ${facts.fallers[0].before} to ${facts.fallers[0].now} sold.`, action: "Ask regulars what changed, or try it as a limited special." });
  if (facts.neverOrdered.length) s.push({ kind: "drop", title: `${facts.neverOrdered.length} items weren't ordered in 4 weeks`, why: facts.neverOrdered.slice(0, 4).join(", "), action: "Hide them for now, or bundle one with a popular drink." });
  if (facts.busiestSlots[0]) s.push({ kind: "staff", title: "Staff up for the rush", why: `Busiest: ${facts.busiestSlots.slice(0, 3).join(", ")}.`, action: "Make sure two people are on the rota for those hours." });
  if (facts.lowStock.length) s.push({ kind: "stock", title: "Restock soon", why: `Running low: ${facts.lowStock.join(", ")}.`, action: "Order today so nothing sells out." });
  if (!s.length) s.push({ kind: "other", title: "Not much data yet", why: `${last28.orders} orders in the last 4 weeks.`, action: "Share the site and the table QR codes so more guests order online." });
  return {
    at: new Date().toISOString(),
    provider: "simple",
    data: { headline: `${last28.orders} orders and ${rupees(last28.revenue)} in the last 4 weeks${change !== null ? ` (${change >= 0 ? "+" : ""}${change}% vs the 4 weeks before)` : ""}.`, suggestions: s.slice(0, 5) },
  };
}

// ---------- caching & the Monday email ----------
export function cached<T>(key: "insights_reviews" | "insights_business"): Cached<T> | null {
  try { return JSON.parse(getSetting(key) ?? "null"); } catch { return null; }
}
export async function refresh(kind: "reviews" | "business") {
  const v = kind === "reviews" ? await summariseReviews() : await businessInsights();
  setSetting(kind === "reviews" ? "insights_reviews" : "insights_business", JSON.stringify(v));
  return v;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const list = (items: string[]) => (items.length ? `<ul style="margin:4px 0 0;padding-left:20px">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");

/** Monday 9am: the weekly report email (reviews + suggestions) */
export async function weeklyTick(now = new Date()) {
  if (now.getDay() !== 1 || now.getHours() < 9 || !ownerPref("daily_summary") || !ownerEmail()) return;
  const today = toDateStr(now);
  if (getSetting("weekly_sent") === today) return;
  setSetting("weekly_sent", today);
  const [r, b] = [await refresh("reviews"), await refresh("business")];
  const rv = r.data as ReviewSummary;
  const bi = b.data as BusinessInsights;
  await sendEmail(
    ownerEmail(),
    `Your week at Moss & Moon ✨`,
    `<h3 style="font-family:Georgia,serif;font-weight:normal;margin:0 0 6px">What guests said</h3>
     <p style="margin:0">${esc(rv.mood)}</p>
     ${rv.loved.length ? `<p style="margin:10px 0 0"><b>Loved</b></p>${list(rv.loved)}` : ""}
     ${rv.improve.length ? `<p style="margin:10px 0 0"><b>To improve</b></p>${list(rv.improve)}` : ""}
     ${rv.quote ? `<p style="font-family:Georgia,serif;font-style:italic;border-left:3px solid #e391a8;padding-left:10px">“${esc(rv.quote)}”</p>` : ""}
     <h3 style="font-family:Georgia,serif;font-weight:normal;margin:22px 0 6px">Ideas for this week</h3>
     <p style="margin:0">${esc(bi.headline)}</p>
     ${bi.suggestions.map((s) => `<p style="margin:12px 0 0"><b>${esc(s.title)}</b><br><span style="color:#8a6a5c">${esc(s.why)}</span><br>→ ${esc(s.action)}</p>`).join("")}
     <p style="color:#8a6a5c;font-size:12px;margin-top:18px">${aiProvider() ? "Written with AI from your café's data. Double-check before acting." : "Add a Gemini key to get AI-written ideas (see DEPLOY.md)."}</p>`
  );
}
