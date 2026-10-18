// Prices and drink options. The server uses these same functions to
// recalculate every order, so prices can't be changed from the browser.
import type { Category, MenuItem } from "./menu";

/** Looks up a menu item by id (from the database on the server, from the loaded menu in the browser) */
export type FindItem = (id: string) => MenuItem | undefined;

export type Options = {
  size?: "small" | "regular" | "large";
  temp?: "hot" | "iced";
  milk?: "whole" | "oat" | "almond" | "soy" | "none";
  sweet?: "none" | "less" | "normal" | "extra";
  shot?: boolean;
  decaf?: boolean;
  syrup?: "none" | "vanilla" | "caramel" | "hazelnut" | "rose";
  toppings?: ("whipped" | "cinnamon" | "cocoa" | "caramel-drizzle")[];
  ice?: "light" | "normal" | "extra";
  extraHot?: boolean;
  warm?: boolean;
  /** Food add-ons: ids from the item's own add-on list */
  addons?: string[];
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
  { value: "soy", label: "Soy", extra: 30 },
  { value: "none", label: "No milk", extra: 0 },
];
export const SWEETS: Choice<NonNullable<Options["sweet"]>>[] = [
  { value: "none", label: "None", extra: 0 },
  { value: "less", label: "Less", extra: 0 },
  { value: "normal", label: "Normal", extra: 0 },
  { value: "extra", label: "Extra", extra: 0 },
];
export const SYRUPS: Choice<NonNullable<Options["syrup"]>>[] = [
  { value: "none", label: "No syrup", extra: 0 },
  { value: "vanilla", label: "Vanilla", extra: 30 },
  { value: "caramel", label: "Caramel", extra: 30 },
  { value: "hazelnut", label: "Hazelnut", extra: 30 },
  { value: "rose", label: "Rose", extra: 30 },
];
export const TOPPINGS: Choice<NonNullable<Options["toppings"]>[number]>[] = [
  { value: "whipped", label: "Whipped cream", extra: 30 },
  { value: "caramel-drizzle", label: "Caramel drizzle", extra: 20 },
  { value: "cinnamon", label: "Cinnamon dust", extra: 0 },
  { value: "cocoa", label: "Cocoa dust", extra: 0 },
];
export const ICE: Choice<NonNullable<Options["ice"]>>[] = [
  { value: "light", label: "Light ice", extra: 0 },
  { value: "normal", label: "Normal ice", extra: 0 },
  { value: "extra", label: "Extra ice", extra: 0 },
];
export const SHOT_PRICE = 40;

export const isDrink = (cat: Category) => cat === "coffee" || cat === "tea" || cat === "cold";

/** Which choices a drink offers */
export function drinkChoices(item: Pick<MenuItem, "cat" | "noMilk">) {
  const coffee = item.cat === "coffee";
  return {
    temp: item.cat !== "cold", // cold drinks are always iced
    milk: !item.noMilk,
    sweet: true,
    shot: coffee,
    decaf: coffee,
    syrup: !item.noMilk,
    toppings: !item.noMilk,
  };
}

export function defaultOptions(item: MenuItem): Options {
  if (!isDrink(item.cat)) return item.cat === "bakes" ? { warm: false, addons: [] } : { addons: [] };
  const c = drinkChoices(item);
  const temp = item.cat === "cold" ? "iced" : (item.traits?.temp ?? "hot");
  return {
    size: "regular",
    temp,
    ...(c.milk ? { milk: item.diet?.includes("vegan") ? "none" : "whole" } : {}),
    sweet: "normal",
    ...(c.shot ? { shot: false, decaf: false } : {}),
    ...(c.syrup ? { syrup: "none", toppings: [] } : {}),
    ...(temp === "iced" ? { ice: "normal" } : { extraHot: false }),
  };
}

/** Keep only allowed option values (anything else falls back to the default). */
export function cleanOptions(item: MenuItem, raw: unknown): Options {
  const d = defaultOptions(item);
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <V extends string>(list: Choice<V>[], v: unknown, fallback?: V) =>
    list.some((c) => c.value === v) ? (v as V) : fallback;
  const addons = (item.addons ?? []).map((a) => a.id).filter((id) => Array.isArray(r.addons) && r.addons.includes(id)); // in the menu's order
  if (!isDrink(item.cat)) return item.cat === "bakes" ? { warm: r.warm === true, addons } : { addons };
  const c = drinkChoices(item);
  const temp = c.temp ? pick(TEMPS, r.temp, d.temp) : "iced";
  return {
    size: pick(SIZES, r.size, d.size),
    temp,
    ...(c.milk ? { milk: pick(MILKS, r.milk, d.milk) } : {}),
    sweet: pick(SWEETS, r.sweet, d.sweet),
    ...(c.shot ? { shot: r.shot === true, decaf: r.decaf === true } : {}),
    ...(c.syrup
      ? { syrup: pick(SYRUPS, r.syrup, "none"), toppings: TOPPINGS.map((t) => t.value).filter((t) => Array.isArray(r.toppings) && r.toppings.includes(t)) }
      : {}),
    ...(temp === "iced" ? { ice: pick(ICE, r.ice, "normal") } : { extraHot: r.extraHot === true }),
  };
}

export function unitPrice(item: MenuItem, o: Options) {
  let p = item.price;
  p += SIZES.find((s) => s.value === o.size)?.extra ?? 0;
  p += MILKS.find((m) => m.value === o.milk)?.extra ?? 0;
  if (o.shot) p += SHOT_PRICE;
  p += SYRUPS.find((s) => s.value === o.syrup)?.extra ?? 0;
  for (const t of o.toppings ?? []) p += TOPPINGS.find((x) => x.value === t)?.extra ?? 0;
  for (const id of o.addons ?? []) p += item.addons?.find((a) => a.id === id)?.price ?? 0;
  return p;
}

export function describeOptions(item: MenuItem, o: Options) {
  const addons = (o.addons ?? []).map((id) => item.addons?.find((a) => a.id === id)?.label).filter(Boolean) as string[];
  if (!isDrink(item.cat)) return [o.warm ? "warmed" : "", ...addons.map((a) => a.replace(/^Make it a combo: /, ""))].filter(Boolean).join(" · ");
  const d = defaultOptions(item);
  const parts: string[] = [];
  if (o.size && o.size !== "regular") parts.push(o.size);
  if (o.temp && o.temp !== d.temp) parts.push(o.temp);
  if (o.extraHot) parts.push("extra hot");
  if (o.ice && o.ice !== "normal") parts.push(`${o.ice} ice`);
  if (o.milk && o.milk !== d.milk) parts.push(o.milk === "none" ? "no milk" : `${o.milk} milk`);
  if (o.sweet && o.sweet !== "normal") parts.push(`${o.sweet} sweet`);
  if (o.decaf) parts.push("decaf");
  if (o.shot) parts.push("extra shot");
  if (o.syrup && o.syrup !== "none") parts.push(`${o.syrup} syrup`);
  for (const t of o.toppings ?? []) parts.push(TOPPINGS.find((x) => x.value === t)?.label.toLowerCase() ?? t);
  return parts.join(" · ");
}

export const lineKey = (itemId: string, o: Options) => `${itemId}|${JSON.stringify(o)}`;

// ----- promo codes -----
// Owners manage codes in /admin → Promos (stored in the database). These are the starting ones.
export type PromoRule = { code: string; kind: "percent" | "amount"; value: number; minOrder: number };

export const DEFAULT_PROMOS: PromoRule[] = [
  { code: "BLOOM10", kind: "percent", value: 10, minOrder: 0 },
  { code: "FIRSTSIP", kind: "amount", value: 50, minOrder: 300 },
  { code: "PINKMOON", kind: "percent", value: 15, minOrder: 500 },
];

export function promoLabel(p: PromoRule) {
  const what = p.kind === "percent" ? `${p.value}% off` : `₹${p.value} off`;
  return p.minOrder > 0 ? `${what} orders over ₹${p.minOrder}` : `${what} everything`;
}

export function promoDiscountFor(p: PromoRule, subtotal: number) {
  if (subtotal < p.minOrder) return 0;
  return p.kind === "percent" ? Math.round((subtotal * p.value) / 100) : Math.min(p.value, subtotal);
}

export type QuoteLine = { itemId: string; name: string; cat?: Category; opts: Options; note: string; qty: number; unit: number; base?: number; total: number; cost?: number };
export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  happyHour: boolean;
  happyDiscount: number;
  promoCode: string | null;
  promoDiscount: number;
  loyaltyDiscount: number; // 10-stamp free drink
  birthdayDiscount: number; // free bake in your birthday week
  passDiscount: number; // coffee pass: one drink a day
  total: number; // goods after discounts
  creditUsed: number; // account credit (from invites)
  giftUsed: number; // paid from a gift card
  deliveryFee: number;
  tip: number;
  due: number; // what's left to pay
};

// ----- happy hour: 20% off bakes, every day 3pm–5pm -----
export const HAPPY_HOUR = { from: 15, to: 17, off: 0.2, label: "Golden hour · 20% off bakes, 3–5pm" };
export const isHappyHour = (now = new Date()) => now.getHours() >= HAPPY_HOUR.from && now.getHours() < HAPPY_HOUR.to;

// ----- perks & extras -----
export const TIP_CHOICES = [0, 5, 10, 15];
export const PASS = { price: 1499, days: 30, cap: 300, label: "Coffee Pass · one drink a day for 30 days" };
export const BIRTHDAY_CAP = 250;
export const REFERRAL_CREDIT = 100;
export const DELIVERY = { fee: 40, freeOver: 600, minOrder: 200 };

/** What a stored order still needs paid (shared by server and browser) */
export const orderDue = (o: { total: number; giftcard_used?: number | null; credit_used?: number | null; tip?: number | null; delivery_fee?: number | null }) =>
  Math.max(0, o.total - (o.giftcard_used ?? 0) - (o.credit_used ?? 0) + (o.tip ?? 0) + (o.delivery_fee ?? 0));

/**
 * Work out the price of an order.
 * - find: how to look up menu items (unknown or hidden items are skipped)
 * - freeDrink: the customer has a loyalty reward, so their cheapest drink is free
 * - extra.giftBalance / credit: money on a gift card / account, used after discounts
 * - extra.birthdayTreat: cheapest bake free (up to ₹250)
 * - extra.passDrink: coffee pass, one drink's base price free (up to ₹300)
 * - extra.tipPercent / tipAmount: optional tip for the team
 * - extra.delivery: add the delivery fee
 */
export function quote(
  raw: { itemId: string; opts?: unknown; qty: number }[],
  find: FindItem,
  promo?: PromoRule | string | null,
  freeDrink = false,
  extra: {
    now?: Date; giftBalance?: number; credit?: number; birthdayTreat?: boolean; passDrink?: boolean;
    tipPercent?: number; tipAmount?: number; delivery?: boolean;
  } = {}
): Quote {
  const lines: QuoteLine[] = [];
  for (const l of raw) {
    const item = find(l.itemId);
    const qty = Math.floor(Number(l.qty));
    if (!item || !(qty >= 1 && qty <= 20)) continue;
    const opts = cleanOptions(item, l.opts);
    const unit = unitPrice(item, opts);
    lines.push({ itemId: item.id, name: item.name, cat: item.cat, opts, note: describeOptions(item, opts), qty, unit, base: item.price, total: unit * qty });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);

  const happyHour = isHappyHour(extra.now);
  const bakes = lines.filter((l) => l.cat === "bakes"); // golden hour and birthday treats are for bakes (not savoury food)
  const happyDiscount = happyHour ? Math.round(bakes.reduce((s, l) => s + l.total, 0) * HAPPY_HOUR.off) : 0;

  // A code on its own (e.g. in tests) is looked up in the starting codes
  const p = typeof promo === "string" ? DEFAULT_PROMOS.find((x) => x.code === promo.trim().toUpperCase()) : promo ?? undefined;
  const code = p?.code ?? null;
  const promoDiscount = p ? promoDiscountFor(p, subtotal - happyDiscount) : 0;

  // One entry per drink cup, so a pass and a loyalty reward can't use the same cup
  const cups = lines.filter((l) => isDrink(l.cat!)).flatMap((l) => Array.from({ length: l.qty }, () => ({ unit: l.unit, base: l.base ?? l.unit })));
  let passDiscount = 0;
  if (extra.passDrink && cups.length) {
    cups.sort((a, b) => b.base - a.base);
    passDiscount = Math.min(cups[0].base, PASS.cap);
    cups.shift();
  }
  let loyaltyDiscount = 0;
  if (freeDrink && cups.length) loyaltyDiscount = Math.min(...cups.map((c) => c.unit));

  let birthdayDiscount = 0;
  if (extra.birthdayTreat && bakes.length) birthdayDiscount = Math.min(Math.min(...bakes.map((b) => b.unit)), BIRTHDAY_CAP);

  const total = Math.max(0, subtotal - happyDiscount - promoDiscount - loyaltyDiscount - birthdayDiscount - passDiscount);
  const creditUsed = Math.min(total, Math.max(0, Math.floor(extra.credit ?? 0)));
  const giftUsed = Math.min(total - creditUsed, Math.max(0, Math.floor(extra.giftBalance ?? 0)));
  const deliveryFee = extra.delivery && lines.length ? (total >= DELIVERY.freeOver ? 0 : DELIVERY.fee) : 0;
  const tip =
    extra.tipAmount !== undefined
      ? Math.max(0, Math.min(2000, Math.round(extra.tipAmount)))
      : TIP_CHOICES.includes(extra.tipPercent ?? 0)
        ? Math.round((total * (extra.tipPercent ?? 0)) / 100)
        : 0;
  return {
    lines, subtotal, happyHour, happyDiscount, promoCode: p ? code : null, promoDiscount, loyaltyDiscount, birthdayDiscount, passDiscount,
    total, creditUsed, giftUsed, deliveryFee, tip, due: total - creditUsed - giftUsed + deliveryFee + tip,
  };
}

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
