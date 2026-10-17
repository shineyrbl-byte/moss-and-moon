// Prices and drink options. The server uses these same functions to
// recalculate every order, so prices can't be changed from the browser.
import type { Category, MenuItem } from "./menu";

/** Looks up a menu item by id (from the database on the server, from the loaded menu in the browser) */
export type FindItem = (id: string) => MenuItem | undefined;

export type Options = {
  size?: "small" | "regular" | "large";
  temp?: "hot" | "iced";
  milk?: "whole" | "oat" | "almond" | "none";
  sweet?: "none" | "less" | "normal" | "extra";
  shot?: boolean;
  warm?: boolean;
};

export type CartLine = { key: string; itemId: string; opts: Options; qty: number };

type Choice<V extends string> = { value: V; label: string; extra: number };

export const SIZES: Choice<NonNullable<Options["size"]>>[] = [
  { value: "small", label: "Small", extra: -20 },
  { value: "regular", label: "Regular", extra: 0 },
  { value: "large", label: "Large", extra: 40 },
];
export const TEMPS: Choice<NonNullable<Options["temp"]>>[] = [
  { value: "hot", label: "Hot", extra: 0 },
  { value: "iced", label: "Iced", extra: 0 },
];
export const MILKS: Choice<NonNullable<Options["milk"]>>[] = [
  { value: "whole", label: "Whole", extra: 0 },
  { value: "oat", label: "Oat", extra: 30 },
  { value: "almond", label: "Almond", extra: 30 },
  { value: "none", label: "No milk", extra: 0 },
];
export const SWEETS: Choice<NonNullable<Options["sweet"]>>[] = [
  { value: "none", label: "None", extra: 0 },
  { value: "less", label: "Less", extra: 0 },
  { value: "normal", label: "Normal", extra: 0 },
  { value: "extra", label: "Extra", extra: 0 },
];
export const SHOT_PRICE = 40;

export const isDrink = (cat: Category) => cat !== "bakes";

export function defaultOptions(item: MenuItem): Options {
  if (!isDrink(item.cat)) return { warm: false };
  return {
    size: "regular",
    temp: item.traits?.temp ?? "hot",
    milk: item.diet?.includes("vegan") ? "none" : "whole",
    sweet: "normal",
    ...(item.cat === "coffee" ? { shot: false } : {}),
  };
}

/** Keep only allowed option values (anything else falls back to the default). */
export function cleanOptions(item: MenuItem, raw: unknown): Options {
  const d = defaultOptions(item);
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <V extends string>(list: Choice<V>[], v: unknown, fallback?: V) =>
    list.some((c) => c.value === v) ? (v as V) : fallback;
  if (!isDrink(item.cat)) return { warm: r.warm === true };
  return {
    size: pick(SIZES, r.size, d.size),
    temp: pick(TEMPS, r.temp, d.temp),
    milk: pick(MILKS, r.milk, d.milk),
    sweet: pick(SWEETS, r.sweet, d.sweet),
    ...(item.cat === "coffee" ? { shot: r.shot === true } : {}),
  };
}

export function unitPrice(item: MenuItem, o: Options) {
  let p = item.price;
  p += SIZES.find((s) => s.value === o.size)?.extra ?? 0;
  p += MILKS.find((m) => m.value === o.milk)?.extra ?? 0;
  if (o.shot) p += SHOT_PRICE;
  return p;
}

export function describeOptions(item: MenuItem, o: Options) {
  if (!isDrink(item.cat)) return o.warm ? "warmed" : "";
  const d = defaultOptions(item);
  const parts: string[] = [];
  if (o.size && o.size !== "regular") parts.push(o.size);
  if (o.temp && o.temp !== d.temp) parts.push(o.temp);
  if (o.milk && o.milk !== d.milk) parts.push(o.milk === "none" ? "no milk" : `${o.milk} milk`);
  if (o.sweet && o.sweet !== "normal") parts.push(`${o.sweet} sweet`);
  if (o.shot) parts.push("extra shot");
  return parts.join(" · ");
}

export const lineKey = (itemId: string, o: Options) => `${itemId}|${JSON.stringify(o)}`;

// ----- promo codes -----
export const PROMOS: Record<string, { label: string; apply: (subtotal: number) => number }> = {
  BLOOM10: { label: "10% off everything", apply: (s) => Math.round(s * 0.1) },
  FIRSTSIP: { label: "₹50 off orders over ₹300", apply: (s) => (s >= 300 ? 50 : 0) },
  PINKMOON: { label: "15% off orders over ₹500", apply: (s) => (s >= 500 ? Math.round(s * 0.15) : 0) },
};

export type QuoteLine = { itemId: string; name: string; cat?: Category; opts: Options; note: string; qty: number; unit: number; total: number };
export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  happyHour: boolean;
  happyDiscount: number;
  promoCode: string | null;
  promoDiscount: number;
  loyaltyDiscount: number;
  total: number; // after discounts
  giftUsed: number; // paid from a gift card
  due: number; // left to pay
};

// ----- happy hour: 20% off bakes, every day 3pm–5pm -----
export const HAPPY_HOUR = { from: 15, to: 17, off: 0.2, label: "Golden hour · 20% off bakes, 3–5pm" };
export const isHappyHour = (now = new Date()) => now.getHours() >= HAPPY_HOUR.from && now.getHours() < HAPPY_HOUR.to;

/**
 * Work out the price of an order.
 * - find: how to look up menu items (unknown or hidden items are skipped)
 * - freeDrink: the customer has a loyalty reward, so their cheapest drink is free
 * - giftBalance: money left on a gift card, used after all discounts
 */
export function quote(
  raw: { itemId: string; opts?: unknown; qty: number }[],
  find: FindItem,
  promo?: string | null,
  freeDrink = false,
  extra: { now?: Date; giftBalance?: number } = {}
): Quote {
  const lines: QuoteLine[] = [];
  for (const l of raw) {
    const item = find(l.itemId);
    const qty = Math.floor(Number(l.qty));
    if (!item || !(qty >= 1 && qty <= 20)) continue;
    const opts = cleanOptions(item, l.opts);
    const unit = unitPrice(item, opts);
    lines.push({ itemId: item.id, name: item.name, cat: item.cat, opts, note: describeOptions(item, opts), qty, unit, total: unit * qty });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);

  const happyHour = isHappyHour(extra.now);
  const bakesTotal = lines.filter((l) => !isDrink(l.cat!)).reduce((s, l) => s + l.total, 0);
  const happyDiscount = happyHour ? Math.round(bakesTotal * HAPPY_HOUR.off) : 0;

  const code = promo?.trim().toUpperCase() || null;
  const p = code ? PROMOS[code] : undefined;
  const promoDiscount = p ? p.apply(subtotal - happyDiscount) : 0;

  let loyaltyDiscount = 0;
  if (freeDrink) {
    const drinks = lines.filter((l) => isDrink(l.cat!));
    if (drinks.length) loyaltyDiscount = Math.min(...drinks.map((d) => d.unit));
  }
  const total = Math.max(0, subtotal - happyDiscount - promoDiscount - loyaltyDiscount);
  const giftUsed = Math.min(total, Math.max(0, Math.floor(extra.giftBalance ?? 0)));
  return { lines, subtotal, happyHour, happyDiscount, promoCode: p ? code : null, promoDiscount, loyaltyDiscount, total, giftUsed, due: total - giftUsed };
}

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
