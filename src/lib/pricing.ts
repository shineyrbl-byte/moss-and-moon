// Prices and drink options. The server uses these same functions to
// recalculate every order, so prices can't be changed from the browser.
import type { Addon, Category, MenuItem } from "./menu";
import type { LastHour } from "./cafe";

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
  /** Shop items: which version (grind, colour…) */
  variant?: string;
  /** Build-your-own / flights: chosen ids per choice group */
  picks?: Record<string, string[]>;
  /** A half portion */
  half?: boolean;
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
  if (item.groups?.length) return { picks: cleanPicks(item, {}), addons: [] };
  if (item.cat === "shop") return item.variants?.length ? { variant: item.variants[0].id } : {};
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
/** Picks for each choice group, kept to its min/max (missing ones filled with the first choices) */
function cleanPicks(item: MenuItem, raw: unknown) {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const g of item.groups ?? []) {
    const want = Array.isArray(r[g.id]) ? (r[g.id] as unknown[]).map(String) : [];
    let ids = g.choices.map((c) => c.id).filter((id) => want.includes(id)).slice(0, g.max);
    for (const c of g.choices) if (ids.length < g.min && !ids.includes(c.id)) ids = [...ids, c.id];
    out[g.id] = ids;
  }
  return out;
}
/** Every add-on-like choice the options include (food add-ons and build-your-own picks) */
export const chosenExtras = (item: MenuItem, o: { addons?: string[]; picks?: Record<string, string[]> }) => [
  ...(o.addons ?? []).map((id) => item.addons?.find((a) => a.id === id)).filter(Boolean),
  ...(item.groups ?? []).flatMap((g) => (o.picks?.[g.id] ?? []).map((id) => g.choices.find((c) => c.id === id)).filter(Boolean)),
] as Addon[];
const halfPrice = (p: number) => Math.round((p * 0.6) / 10) * 10;

export function cleanOptions(item: MenuItem, raw: unknown): Options {
  const d = defaultOptions(item);
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (item.groups?.length) return { picks: cleanPicks(item, r.picks), addons: (item.addons ?? []).map((a) => a.id).filter((id) => Array.isArray(r.addons) && r.addons.includes(id)) };
  const pick = <V extends string>(list: Choice<V>[], v: unknown, fallback?: V) =>
    list.some((c) => c.value === v) ? (v as V) : fallback;
  if (item.cat === "shop") return item.variants?.length ? { variant: item.variants.some((v) => v.id === r.variant) ? String(r.variant) : item.variants[0].id } : {};
  const addons = (item.addons ?? []).map((a) => a.id).filter((id) => Array.isArray(r.addons) && r.addons.includes(id)); // in the menu's order
  if (!isDrink(item.cat)) return item.cat === "bakes" ? { warm: r.warm === true, addons } : { addons, ...(item.half && r.half === true ? { half: true } : {}) };
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
  let p = o.half && item.half ? halfPrice(item.price) : item.price;
  for (const g of item.groups ?? []) for (const id of o.picks?.[g.id] ?? []) p += g.choices.find((c) => c.id === id)?.price ?? 0;
  p += SIZES.find((s) => s.value === o.size)?.extra ?? 0;
  p += MILKS.find((m) => m.value === o.milk)?.extra ?? 0;
  if (o.shot) p += SHOT_PRICE;
  p += SYRUPS.find((s) => s.value === o.syrup)?.extra ?? 0;
  for (const t of o.toppings ?? []) p += TOPPINGS.find((x) => x.value === t)?.extra ?? 0;
  for (const id of o.addons ?? []) p += item.addons?.find((a) => a.id === id)?.price ?? 0;
  if (o.variant) p += item.variants?.find((v) => v.id === o.variant)?.price ?? 0;
  return p;
}

export function describeOptions(item: MenuItem, o: Options) {
  if (item.cat === "shop") return o.variant && item.variants && item.variants.length > 1 ? (item.variants.find((v) => v.id === o.variant)?.label ?? "") : "";
  const addons = (o.addons ?? []).map((id) => item.addons?.find((a) => a.id === id)?.label).filter(Boolean) as string[];
  if (item.groups?.length) return [...item.groups.flatMap((g) => (o.picks?.[g.id] ?? []).map((id) => g.choices.find((c) => c.id === id)?.label ?? "")), ...addons].filter(Boolean).join(" · ");
  if (o.half) addons.unshift("half portion");
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
  tierDiscount: number; // silver/gold members: free size upgrades
  lastHourDiscount: number; // bakes cheaper just before closing
  comboDiscount: number; // combo deals
  combos: { id: string; name: string; count: number; saving: number }[];
  studentDiscount: number; // verified students, weekdays
  total: number; // goods after discounts
  creditUsed: number; // account credit (from invites)
  giftUsed: number; // paid from a gift card
  deliveryFee: number;
  tip: number;
  due: number; // what's left to pay
};

// ----- golden hour: a daily discount on some categories (owners edit it in Admin → Settings) -----
export type HappyHour = { on: boolean; from: number; to: number; off: number; cats: Category[]; days: number[] };
export const DEFAULT_HAPPY_HOUR: HappyHour = { on: true, from: 15, to: 17, off: 0.2, cats: ["bakes"], days: [0, 1, 2, 3, 4, 5, 6] };
/** The current golden-hour settings (kept with the café settings on globalThis, see lib/cafe.ts) */
export const happyHour = (): HappyHour => ((globalThis as { __mmConfig?: { happyHour?: HappyHour } }).__mmConfig?.happyHour ?? DEFAULT_HAPPY_HOUR);

const CAT_WORDS: Record<string, string> = { coffee: "coffee", tea: "tea", cold: "cold drinks", food: "food", bakes: "bakes", shop: "shop items" };
const hr = (x: number) => (x === 12 ? "12pm" : x > 12 ? `${x - 12}pm` : `${x}am`);
const range = (a: number, b: number) => `${hr(a).replace(/[ap]m$/, (m) => (hr(b).endsWith(m) ? "" : m))}–${hr(b)}`;
/** e.g. "Golden hour · 20% off bakes, 3–5pm" */
export function happyHourLabel(h = happyHour()) {
  const cats = h.cats.map((c) => CAT_WORDS[c] ?? c);
  const what = cats.length > 1 ? `${cats.slice(0, -1).join(", ")} & ${cats.at(-1)}` : cats[0] ?? "everything";
  const days = h.days.length === 7 ? "" : h.days.length === 5 && [1, 2, 3, 4, 5].every((d) => h.days.includes(d)) ? " on weekdays" : ` on ${h.days.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}`;
  return `Golden hour · ${Math.round(h.off * 100)}% off ${what}, ${range(h.from, h.to)}${days}`;
}
export const isHappyHour = (now = new Date()) => {
  const h = happyHour();
  // (The automated tests switch it off so prices don't change with the time of day)
  if (typeof process !== "undefined" && process.env?.HAPPY_HOUR === "off") return false;
  return h.on && h.days.includes(now.getDay()) && now.getHours() >= h.from && now.getHours() < h.to;
};
// ----- students: 10% off drinks on weekdays, for guests verified with a college email -----
export const STUDENT = { off: 0.1, days: [1, 2, 3, 4, 5], months: 12 };
/** College email domains we accept (e.g. name@goa.bits-pilani.ac.in, name@uni.edu) */
export const isStudentEmail = (email: string) => /@([a-z0-9-]+\.)*(ac\.in|edu|edu\.in|ac\.uk|edu\.au)$/i.test(email.trim());

// ----- combo deals: e.g. any coffee + a bake for ₹299 -----
export type ComboSlot = { label: string; cats?: Category[]; items?: string[] };
export type Combo = { id: string; name: string; slots: ComboSlot[]; price: number; on: boolean; from?: number; to?: number };
export const DEFAULT_COMBOS: Combo[] = [
  { id: "breakfast", name: "Breakfast combo", slots: [{ label: "Any coffee", cats: ["coffee"] }, { label: "Any bake", cats: ["bakes"] }], price: 299, on: true, from: 7, to: 11 },
  { id: "lunch", name: "Lunch combo", slots: [{ label: "Any food", cats: ["food"] }, { label: "Any cold drink", cats: ["cold"] }], price: 449, on: true, from: 12, to: 15 },
];
/** The combos in the café settings (shared with the browser like golden hour) */
export const combosConfig = (): Combo[] => ((globalThis as { __mmConfig?: { combos?: Combo[] } }).__mmConfig?.combos ?? DEFAULT_COMBOS);
/** Combos on offer at this time of day */
export const combosAt = (list: Combo[] | undefined, now = new Date()) => {
  // (The automated tests switch time-of-day deals off so prices don't change with the clock)
  const timedOff = typeof process !== "undefined" && process.env?.HAPPY_HOUR === "off";
  return (list ?? []).filter((c) => c.on && c.slots.length >= 2 && (c.from === undefined || c.to === undefined ? true : !timedOff && now.getHours() >= c.from && now.getHours() < c.to));
};
const fits = (s: ComboSlot, l: QuoteLine) => l.cat !== "shop" && ((s.items?.length && s.items.includes(l.itemId)) || (!s.items?.length && (s.cats ?? []).includes(l.cat!)));

/** Match the tray to combos: each unit is used once, and a combo only counts when it saves money */
export function matchCombos(lines: QuoteLine[], combos: Combo[]) {
  const used = lines.map(() => 0);
  const applied: { id: string; name: string; count: number; saving: number }[] = [];
  for (const c of combos) {
    for (let guard = 0; guard < 20; guard++) {
      const pick: number[] = [];
      for (const s of c.slots) {
        // The dearest unit that fits this slot and isn't taken yet
        let best = -1;
        lines.forEach((l, i) => {
          const free = l.qty - used[i] - pick.filter((p) => p === i).length;
          if (free > 0 && fits(s, l) && (best < 0 || l.unit > lines[best].unit)) best = i;
        });
        if (best < 0) break;
        pick.push(best);
      }
      if (pick.length < c.slots.length) break;
      const worth = pick.reduce((sum, i) => sum + lines[i].unit, 0);
      if (worth <= c.price) break;
      pick.forEach((i) => used[i]++);
      const a = applied.find((x) => x.id === c.id);
      if (a) { a.count++; a.saving += worth - c.price; } else applied.push({ id: c.id, name: c.name, count: 1, saving: worth - c.price });
    }
  }
  return { applied, used, discount: applied.reduce((s, a) => s + a.saving, 0) };
}

/** Kept for older code: the golden-hour label and discount right now */
export const HAPPY_HOUR = { get label() { return happyHourLabel(); }, get off() { return happyHour().off; } };

// ----- perks & extras -----
export const TIP_CHOICES = [0, 5, 10, 15];
export const PASS = { price: 1499, days: 30, cap: 300, label: "Coffee Pass · one drink a day for 30 days" };
export const BIRTHDAY_CAP = 250;
export const REFERRAL_CREDIT = 100;
/** Coffee wallet top-ups and the bonus each one adds */
export const WALLET_TOPUPS = [{ amount: 500, bonus: 25 }, { amount: 1000, bonus: 75 }, { amount: 2000, bonus: 200 }];
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
    tipPercent?: number; tipAmount?: number; delivery?: boolean; tier?: "bronze" | "silver" | "gold";
    /** The last-hour deal, when it's on right now (the caller checks the branch's hours) */
    lastHour?: Pick<LastHour, "off" | "cats"> | null;
    /** A verified student */
    student?: boolean;
    /** Combo deals on offer right now (see combosAt) */
    combos?: Combo[];
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

  // Combos first; whatever they use doesn't get golden-hour or last-hour money off as well
  const combo = matchCombos(lines, extra.combos ?? []);
  const left = (i: number) => (lines[i].qty - combo.used[i]) * lines[i].unit;
  const isGolden = isHappyHour(extra.now);
  const bakes = lines.filter((l) => l.cat === "bakes"); // birthday treats are for bakes (not savoury food)
  const hh = happyHour();
  const happyDiscount = isGolden ? Math.round(lines.reduce((s, l, i) => s + (hh.cats.includes(l.cat!) ? left(i) : 0), 0) * hh.off) : 0;

  // A code on its own (e.g. in tests) is looked up in the starting codes
  const p = typeof promo === "string" ? DEFAULT_PROMOS.find((x) => x.code === promo.trim().toUpperCase()) : promo ?? undefined;
  const code = p?.code ?? null;
  const promoDiscount = p ? promoDiscountFor(p, subtotal - happyDiscount - combo.discount) : 0;

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

  // Loyalty tiers: the upgrade to large is free (silver: one drink, gold: every drink)
  const upgrade = SIZES.find((x) => x.value === "large")!.extra;
  const largeCups = lines.filter((l) => isDrink(l.cat!) && l.opts.size === "large").reduce((s, l) => s + l.qty, 0);
  const tierDiscount = extra.tier === "gold" ? largeCups * upgrade : extra.tier === "silver" ? Math.min(1, largeCups) * upgrade : 0;

  // Last-hour deal: on anything golden hour hasn't already discounted
  const lh = extra.lastHour;
  const lastHourDiscount = lh ? Math.round(lines.reduce((s, l, i) => s + (lh.cats.includes(l.cat!) && !(isGolden && hh.cats.includes(l.cat!)) ? left(i) : 0), 0) * lh.off) : 0;
  const day = (extra.now ?? new Date()).getDay();
  const studentDiscount = extra.student && STUDENT.days.includes(day) ? Math.round(lines.filter((l) => isDrink(l.cat!)).reduce((s, l) => s + l.total, 0) * STUDENT.off) : 0;

  const total = Math.max(0, subtotal - happyDiscount - promoDiscount - loyaltyDiscount - birthdayDiscount - passDiscount - tierDiscount - lastHourDiscount - studentDiscount - combo.discount);
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
    lines, subtotal, happyHour: isGolden, happyDiscount, promoCode: p ? code : null, promoDiscount, loyaltyDiscount, birthdayDiscount, passDiscount, tierDiscount, lastHourDiscount, studentDiscount, comboDiscount: combo.discount, combos: combo.applied,
    total, creditUsed, giftUsed, deliveryFee, tip, due: total - creditUsed - giftUsed + deliveryFee + tip,
  };
}

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
