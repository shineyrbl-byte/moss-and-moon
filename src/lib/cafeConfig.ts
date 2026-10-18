// Saving and loading the café's opening hours, holidays and golden hour
import "server-only";
import { getSetting, setSetting } from "./db";
import { DEFAULT_CONFIG, MAIN_BRANCH, applyConfig, cafeConfig, parseDate, toDateStr, type Branch, type CafeConfig, type Closure, type DayHours } from "./cafe";
import { DEFAULT_HAPPY_HOUR, type HappyHour } from "./pricing";
import { DEFAULT_LAST_HOUR, type CafeLinks, type LastHour } from "./cafe";
import type { Category } from "./menu";

export type FullConfig = CafeConfig & { happyHour: HappyHour; branches: Branch[]; lastHour: LastHour; links: CafeLinks };
export const MAX_BRANCHES = 4;
const CATS: Category[] = ["coffee", "tea", "cold", "food", "bakes", "shop"];
const hour = (v: unknown, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

/** Check and tidy settings from the admin page (anything odd falls back to what's there now) */
export function cleanConfig(raw: unknown, current: FullConfig = fullConfig()): FullConfig | { error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const hours: Record<number, DayHours> = { ...current.hours };
  if (r.hours && typeof r.hours === "object") {
    for (let d = 0; d < 7; d++) {
      const v = (r.hours as Record<string, unknown>)[d];
      if (v === undefined) continue;
      if (v === null) { hours[d] = null; continue; }
      const [o, c] = Array.isArray(v) ? v : [];
      const open = hour(o, 0, 23);
      const close = hour(c, 1, 24);
      if (open === null || close === null || close <= open) return { error: "Each open day needs a closing time after its opening time." };
      hours[d] = [open, close];
    }
  }
  let closures: Closure[] = current.closures;
  if (Array.isArray(r.closures)) {
    closures = r.closures
      .slice(0, 60)
      .map((c: { date?: unknown; note?: unknown }) => ({ date: String(c?.date ?? ""), note: String(c?.note ?? "").trim().slice(0, 60) }))
      .filter((c) => parseDate(c.date))
      .filter((c, i, all) => all.findIndex((x) => x.date === c.date) === i)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  // Holidays that have passed are tidied away
  const today = toDateStr(new Date());
  closures = closures.filter((c) => c.date >= today);

  let happyHour = current.happyHour;
  if (r.happyHour && typeof r.happyHour === "object") {
    const h = r.happyHour as Record<string, unknown>;
    const from = hour(h.from, 0, 23) ?? happyHour.from;
    const to = hour(h.to, 1, 24) ?? happyHour.to;
    const pct = Number(h.off);
    const off = Number.isFinite(pct) ? pct / (pct > 1 ? 100 : 1) : happyHour.off;
    if (to <= from) return { error: "Golden hour needs to end after it starts." };
    if (!(off > 0 && off <= 0.9)) return { error: "Golden hour discount should be between 1% and 90%." };
    const cats = Array.isArray(h.cats) ? (h.cats.filter((c) => CATS.includes(c as Category)) as Category[]) : happyHour.cats;
    const days = Array.isArray(h.days) ? [...new Set(h.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : happyHour.days;
    if (!cats.length) return { error: "Pick at least one menu section for golden hour." };
    happyHour = { on: h.on === undefined ? happyHour.on : !!h.on, from, to, off: Math.round(off * 100) / 100, cats, days };
  }
  let lastHour = current.lastHour;
  if (r.lastHour && typeof r.lastHour === "object") {
    const l = r.lastHour as Record<string, unknown>;
    const pct = Number(l.off);
    const off = Number.isFinite(pct) ? pct / (pct > 1 ? 100 : 1) : lastHour.off;
    const minutes = Math.round(Number(l.minutes ?? lastHour.minutes));
    if (!(off > 0 && off <= 0.9)) return { error: "The last-hour discount should be between 1% and 90%." };
    if (!(minutes >= 15 && minutes <= 180)) return { error: "The last-hour deal can start 15 to 180 minutes before closing." };
    const cats = Array.isArray(l.cats) ? (l.cats.filter((c) => CATS.includes(c as Category)) as Category[]) : lastHour.cats;
    if (!cats.length) return { error: "Pick at least one menu section for the last-hour deal." };
    lastHour = { on: l.on === undefined ? lastHour.on : !!l.on, off: Math.round(off * 100) / 100, minutes, cats };
  }
  let links = current.links;
  if (r.links && typeof r.links === "object") {
    const l = r.links as Record<string, unknown>;
    const g = String(l.googleReview ?? links.googleReview).trim();
    const w = String(l.whatsapp ?? links.whatsapp).replace(/\D/g, "").slice(-10);
    if (g && !/^https:\/\/([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl|g\.page)\//i.test(g)) return { error: "The review link should be your Google review link (it starts with https://g.page/ or https://maps.app.goo.gl/ or similar)." };
    if (w && w.length !== 10) return { error: "The WhatsApp number should be 10 digits." };
    links = { googleReview: g.slice(0, 300), whatsapp: w };
  }
  let branches = current.branches;
  if (Array.isArray(r.branches)) {
    const out: Branch[] = [];
    for (const raw of r.branches.slice(0, MAX_BRANCHES) as Record<string, unknown>[]) {
      const name = String(raw?.name ?? "").trim().slice(0, 40);
      const address = String(raw?.address ?? "").trim().slice(0, 120);
      if (!name) return { error: "Every branch needs a name." };
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "branch";
      const id = raw?.id === "main" ? "main" : typeof raw?.id === "string" && /^[a-z0-9-]{1,24}$/.test(raw.id) ? raw.id : slug;
      if (out.some((b) => b.id === id)) return { error: `Two branches can't share the name "${name}".` };
      let own: Record<number, DayHours> | null = null;
      if (id !== "main" && raw?.hours && typeof raw.hours === "object") {
        own = {};
        for (let d = 0; d < 7; d++) {
          const v = (raw.hours as Record<string, unknown>)[d];
          if (!Array.isArray(v)) { own[d] = null; continue; }
          const open = hour(v[0], 0, 23), close = hour(v[1], 1, 24);
          if (open === null || close === null || close <= open) return { error: `${name}: each open day needs a closing time after its opening time.` };
          own[d] = [open, close];
        }
      }
      out.push({ id, name, address, hours: own, active: id === "main" ? true : raw?.active !== false });
    }
    if (!out.some((b) => b.id === "main")) out.unshift(current.branches.find((b) => b.id === "main") ?? MAIN_BRANCH);
    branches = out;
  }
  return { hours, closures, happyHour, branches, lastHour, links };
}

export function fullConfig(): FullConfig {
  const c = cafeConfig() as CafeConfig & { happyHour?: HappyHour };
  return { hours: c.hours, closures: c.closures, happyHour: c.happyHour ?? DEFAULT_HAPPY_HOUR, branches: c.branches?.length ? c.branches : [MAIN_BRANCH], lastHour: (c as { lastHour?: LastHour }).lastHour ?? DEFAULT_LAST_HOUR, links: c.links ?? { googleReview: "", whatsapp: "" } };
}

/** Read the saved settings into memory (at start-up) */
export function loadConfig() {
  let saved: Partial<FullConfig> = {};
  try { saved = JSON.parse(getSetting("cafe_config") ?? "{}"); } catch {}
  applyConfig({ hours: { ...DEFAULT_CONFIG.hours, ...(saved.hours ?? {}) }, closures: saved.closures ?? [], happyHour: { ...DEFAULT_HAPPY_HOUR, ...(saved.happyHour ?? {}) }, branches: saved.branches?.length ? saved.branches : [MAIN_BRANCH], lastHour: { ...DEFAULT_LAST_HOUR, ...(saved.lastHour ?? {}) }, links: { googleReview: "", whatsapp: "", ...(saved.links ?? {}) } } as CafeConfig);
  return fullConfig();
}

export function saveConfig(c: FullConfig) {
  setSetting("cafe_config", JSON.stringify(c));
  applyConfig(c);
}
