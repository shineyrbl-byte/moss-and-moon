// Unit tests for price maths (no server needed). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, unitPrice, cleanOptions, defaultOptions, describeOptions, isStudentEmail, matchCombos, type Combo } from "../src/lib/pricing.ts";
import { slotsFor, openStatus, demoStatus, forecastDay, quietestHour, busyLevel } from "../src/lib/cafe.ts";
import type { MenuItem } from "../src/lib/menu.ts";

const latte: MenuItem = { id: "latte", cat: "coffee", name: "Latte", desc: "", price: 200, img: "x", traits: { energy: 1, sweet: 1, temp: "hot" } };
const tea: MenuItem = { id: "tea", cat: "tea", name: "Tea", desc: "", price: 150, img: "x", diet: ["vegan"], traits: { energy: 1, sweet: 0, temp: "hot" } };
const cake: MenuItem = { id: "cake", cat: "bakes", name: "Cake", desc: "", price: 300, img: "x" };
const menu = new Map([latte, tea, cake].map((m) => [m.id, m]));
const find = (id: string) => menu.get(id);
const morning = new Date(2026, 9, 19, 10, 0); // not golden hour
const goldenHour = new Date(2026, 9, 19, 16, 0);

test("drink options change the price", () => {
  assert.equal(unitPrice(latte, { size: "large", milk: "oat", shot: true }), 200 + 40 + 30 + 40);
  assert.equal(unitPrice(latte, { size: "small" }), 180);
  assert.equal(unitPrice(cake, { warm: true }), 300);
});

test("unknown option values fall back to defaults", () => {
  const o = cleanOptions(latte, { size: "gigantic", milk: "unicorn", shot: "yes" });
  assert.deepEqual(o, defaultOptions(latte));
  // Bakes only accept "warm" (and their own add-ons)
  assert.deepEqual(cleanOptions(cake, { size: "large", warm: true }), { warm: true, addons: [] });
});

test("vegan drinks default to no milk", () => {
  assert.equal(defaultOptions(tea).milk, "none");
  assert.equal(describeOptions(latte, { ...defaultOptions(latte), size: "large", milk: "oat" }), "large · oat milk");
});

test("quote skips unknown items and silly quantities", () => {
  const q = quote([{ itemId: "latte", qty: 2 }, { itemId: "ghost", qty: 1 }, { itemId: "cake", qty: 0 }, { itemId: "tea", qty: 99 }], find, null, false, { now: morning });
  assert.equal(q.lines.length, 1);
  assert.equal(q.subtotal, 400);
  assert.equal(q.total, 400);
});

test("promo codes", () => {
  const items = [{ itemId: "latte", qty: 2 }];
  assert.equal(quote(items, find, "bloom10", false, { now: morning }).promoDiscount, 40);
  assert.equal(quote(items, find, "FIRSTSIP", false, { now: morning }).promoDiscount, 50); // 400 ≥ 300
  assert.equal(quote([{ itemId: "tea", qty: 1 }], find, "FIRSTSIP", false, { now: morning }).promoDiscount, 0); // under ₹300
  assert.equal(quote(items, find, "NOPE", false, { now: morning }).promoCode, null);
});

test("golden hour takes 20% off bakes only", () => {
  const q = quote([{ itemId: "cake", qty: 1 }, { itemId: "latte", qty: 1 }], find, null, false, { now: goldenHour });
  assert.equal(q.happyHour, true);
  assert.equal(q.happyDiscount, 60);
  assert.equal(q.total, 440);
});

test("loyalty reward makes the cheapest drink free", () => {
  const q = quote([{ itemId: "latte", qty: 1 }, { itemId: "tea", qty: 1 }, { itemId: "cake", qty: 1 }], find, null, true, { now: morning });
  assert.equal(q.loyaltyDiscount, 150);
});

test("gift card pays what it can and the rest is due", () => {
  const q = quote([{ itemId: "cake", qty: 1 }], find, null, false, { now: morning, giftBalance: 120 });
  assert.equal(q.giftUsed, 120);
  assert.equal(q.due, 180);
  const covered = quote([{ itemId: "cake", qty: 1 }], find, null, false, { now: morning, giftBalance: 999 });
  assert.equal(covered.giftUsed, 300);
  assert.equal(covered.due, 0);
});

test("totals never go below zero", () => {
  const q = quote([{ itemId: "tea", qty: 1 }], find, "BLOOM10", true, { now: morning });
  assert.ok(q.total >= 0);
});

test("booking slots follow opening hours", () => {
  // 2030-01-06 is a Sunday: 9am–6pm, last booking 5pm
  const sunday = slotsFor("2030-01-06");
  assert.equal(sunday[0], "09:00");
  assert.equal(sunday.at(-1), "17:00");
  assert.equal(slotsFor("not-a-date").length, 0);
});

test("open / closed status", () => {
  assert.equal(openStatus(new Date(2026, 9, 19, 10, 0)).open, true); // Monday 10am
  assert.equal(openStatus(new Date(2026, 9, 19, 6, 0)).open, false);
});

test("tips, delivery and what's due", () => {
  const q = quote([{ itemId: "latte", qty: 1 }], find, null, false, { now: morning, tipPercent: 10, delivery: true });
  assert.equal(q.tip, 20);
  assert.equal(q.deliveryFee, 40);
  assert.equal(q.due, 260);
  const big = quote([{ itemId: "cake", qty: 2 }], find, null, false, { now: morning, delivery: true });
  assert.equal(big.deliveryFee, 0, "free delivery over ₹600");
  assert.equal(quote([{ itemId: "latte", qty: 1 }], find, null, false, { now: morning, tipPercent: 37 }).tip, 0, "only offered tip choices");
});

test("coffee pass and loyalty can't use the same cup", () => {
  const one = quote([{ itemId: "latte", qty: 1 }], find, null, true, { now: morning, passDrink: true });
  assert.equal(one.passDiscount, 200);
  assert.equal(one.loyaltyDiscount, 0);
  const two = quote([{ itemId: "latte", qty: 1 }, { itemId: "tea", qty: 1 }], find, null, true, { now: morning, passDrink: true });
  assert.equal(two.passDiscount, 200);
  assert.equal(two.loyaltyDiscount, 150);
  // the pass covers the base price, not paid extras
  assert.equal(quote([{ itemId: "latte", qty: 1, opts: { size: "large", milk: "oat" } }], find, null, false, { now: morning, passDrink: true }).total, 70);
});

test("birthday treat and account credit", () => {
  const q = quote([{ itemId: "cake", qty: 1 }, { itemId: "latte", qty: 1 }], find, null, false, { now: morning, birthdayTreat: true, credit: 100, giftBalance: 1000 });
  assert.equal(q.birthdayDiscount, 250, "capped at ₹250");
  assert.equal(q.total, 250);
  assert.equal(q.creditUsed, 100);
  assert.equal(q.giftUsed, 150);
  assert.equal(q.due, 0);
});

test("demo barista moves orders along over time", () => {
  assert.equal(demoStatus(0.5, false), "received");
  assert.equal(demoStatus(1, false), "brewing");
  assert.equal(demoStatus(3, false), "ready");
  assert.equal(demoStatus(15, false), "collected");
  assert.equal(demoStatus(15, true), "ready", "deliveries stay on their way a bit longer");
  assert.equal(demoStatus(25, true), "collected");
});

test("busy forecast covers opening hours and finds the quiet time", () => {
  const monday = forecastDay(1, null);
  assert.equal(monday[0].hour, 7);
  assert.equal(monday.at(-1)!.hour, 19);
  assert.ok(monday.every((f) => f.score >= 0 && f.score <= 1));
  const at9 = new Date("2026-10-19T09:10:00");
  assert.equal(quietestHour(monday, at9), 15, "mid-afternoon is quietest on a typical day");
  const lateNight = new Date("2026-10-19T23:00:00");
  assert.equal(quietestHour(monday, lateNight), null);
  assert.equal(busyLevel(0.1), "quiet");
  assert.equal(busyLevel(0.5), "cosy");
  assert.equal(busyLevel(0.9), "packed");
  // Bookings push an hour up
  const booked = forecastDay(1, null, { 15: 24 });
  assert.ok(booked.find((f) => f.hour === 15)!.score > monday.find((f) => f.hour === 15)!.score);
});

test("seasonal themes follow the calendar", async () => {
  const { seasonFor, activeSeason } = await import("../src/lib/seasons.ts");
  assert.equal(seasonFor(new Date("2026-11-08T10:00")), "diwali");
  assert.equal(seasonFor(new Date("2026-11-04T10:00")), "diwali", "festival week");
  assert.equal(seasonFor(new Date("2026-11-20T10:00")), null);
  assert.equal(seasonFor(new Date("2026-12-25T10:00")), "christmas");
  assert.equal(seasonFor(new Date("2027-01-01T10:00")), "christmas");
  assert.equal(seasonFor(new Date("2027-02-14T10:00")), "valentines");
  assert.equal(seasonFor(new Date("2027-07-20T10:00")), "monsoon");
  assert.equal(seasonFor(new Date("2027-10-29T10:00")), "diwali", "Diwali moves each year");
  assert.equal(activeSeason("off", new Date("2026-12-25T10:00")), null);
  assert.equal(activeSeason("monsoon", new Date("2026-12-25T10:00")), "monsoon");
});

test("rota helpers: weeks, hours and overlaps", async () => {
  const { weekStart, weekDays, shiftHours, overlaps, fmtTime } = await import("../src/lib/rota.ts");
  assert.equal(weekStart(new Date("2026-10-18T10:00")), "2026-10-12", "Sunday belongs to the week starting Monday");
  assert.equal(weekStart(new Date("2026-10-19T10:00")), "2026-10-19");
  assert.deepEqual(weekDays("2026-10-26").slice(-1), ["2026-11-01"]);
  assert.equal(shiftHours("07:00", "13:30"), 6.5);
  assert.equal(overlaps({ start: "07:00", end: "13:00" }, { start: "12:00", end: "18:00" }), true);
  assert.equal(overlaps({ start: "07:00", end: "13:00" }, { start: "13:00", end: "18:00" }), false, "back-to-back is fine");
  assert.equal(fmtTime("13:30"), "1:30pm");
});

test("badges and streaks", async () => {
  const { computeBadges, streaks } = await import("../src/lib/badges.ts");
  const o = (created_at: string, lines = [{ itemId: "matcha", name: "Ceremonial Matcha", cat: "tea", qty: 1 }], tip = 0) => ({ created_at, lines, tip });
  const orders = [o("2026-10-14 07:30:00"), o("2026-10-15 07:45:00"), o("2026-10-16 07:10:00", undefined, 20), o("2026-10-18 20:00:00")];
  assert.deepEqual(streaks(orders, "2026-10-18"), { current: 1, best: 3 });
  assert.deepEqual(streaks(orders, "2026-10-20"), { current: 0, best: 3 }, "a gap breaks the streak");
  const { badges } = computeBadges(orders, { reviews: 0, tickets: 0, giftsSent: 1 }, "2026-10-18");
  const has = (id: string) => badges.find((b) => b.id === id)!.earned;
  assert.ok(has("first-sip"));
  assert.ok(has("streak-3"));
  assert.ok(has("early-bird"), "three orders before 8am");
  assert.ok(!has("night-owl"));
  assert.ok(has("kind-soul"));
  assert.deepEqual(badges.find((b) => b.id === "matcha-lover")!.progress, { have: 4, need: 5 });
});

test("voice orders: numbers, options and several items", async () => {
  const { parseVoiceOrder } = await import("../src/lib/voiceParse.ts");
  const menu = [
    { id: "honey-oat-latte", name: "Honey Oat Latte", cat: "coffee" },
    { id: "rose-latte", name: "Rose Pistachio Latte", cat: "coffee" },
    { id: "croissant", name: "Butter Croissant", cat: "bakes" },
    { id: "chai", name: "Rose Masala Chai", cat: "tea" },
    { id: "americano", name: "Long Black", cat: "coffee" },
  ];
  const a = parseVoiceOrder("Two iced oat rose lattes and a croissant please", menu);
  assert.deepEqual(a.lines.map((l) => [l.itemId, l.qty]), [["rose-latte", 2], ["croissant", 1]]);
  assert.equal(a.lines[0].opts.temp, "iced");
  assert.equal(a.lines[0].opts.milk, "oat");
  const b = parseVoiceOrder("one large masala chai with no sugar, plus my usual", menu);
  assert.equal(b.lines[0].itemId, "chai");
  assert.equal(b.lines[0].opts.size, "large");
  assert.equal(b.lines[0].opts.sweet, "none");
  assert.equal(b.usual, true);
  assert.deepEqual(parseVoiceOrder("a unicorn frappe", menu).lines, []);
  assert.equal(parseVoiceOrder("a long black, extra shot", menu).lines[0].opts.shot, true);
  const hinglish = parseVoiceOrder("ek iced rose latte aur do croissant", menu);
  assert.deepEqual(hinglish.lines.map((l) => [l.itemId, l.qty]), [["rose-latte", 1], ["croissant", 2]], "Hinglish: aur = and, do = two");
});

test("allergens follow the milk you pick; calories follow size and sugar", async () => {
  const { allergensFor, kcalFor, canAvoid } = await import("../src/lib/nutrition.ts");
  const latte = { id: "rose-latte", cat: "coffee", allergens: ["nuts", "milk"] as ("nuts" | "milk")[], kcal: 260 };
  const chai = { id: "chai", cat: "tea", allergens: [], kcal: 160 };
  assert.deepEqual(allergensFor(chai, { milk: "whole" }), ["milk"]);
  assert.deepEqual(allergensFor(chai, { milk: "almond" }), ["nuts"]);
  assert.deepEqual(allergensFor(chai, { milk: "none" }), []);
  assert.deepEqual(allergensFor(latte, { milk: "oat" }), ["milk", "nuts", "gluten"], "pistachio cream still has milk");
  assert.equal(kcalFor(chai, { size: "regular", milk: "whole", sweet: "normal" }), 160);
  assert.ok(kcalFor(chai, { size: "large", milk: "whole" })! > 160);
  assert.ok(kcalFor(chai, { milk: "none", sweet: "none" })! < 60);
  assert.equal(kcalFor({ id: "x", cat: "tea" }, {}), null);
  assert.equal(canAvoid(latte, "nuts"), false);
  assert.equal(canAvoid(chai, "nuts"), true);
});

test("one-time codes match the standard test vectors", async () => {
  const { codeAt, verify, base32Encode, base32Decode } = await import("../src/lib/totp.ts");
  // RFC 6238 test secret "12345678901234567890", 6 digits
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  assert.equal(base32Decode(secret).toString(), "12345678901234567890");
  assert.equal(codeAt(secret, Math.floor(59 / 30)), "287082");
  assert.equal(codeAt(secret, Math.floor(1111111109 / 30)), "081804");
  assert.equal(codeAt(secret, Math.floor(1234567890 / 30)), "005924");
  const now = 1_700_000_000_000;
  const code = codeAt(secret, Math.floor(now / 30_000));
  assert.ok(verify(secret, code, now) !== null);
  assert.ok(verify(secret, code, now + 30_000) !== null, "one step of clock drift is fine");
  assert.equal(verify(secret, code, now + 120_000), null);
  assert.equal(verify(secret, "abc", now), null);
});

test("new drink choices and food add-ons are priced and checked on the server", () => {
  const frappe = { id: "f", cat: "cold" as const, name: "Frappé", desc: "", price: 260, img: "x", traits: { energy: 1 as const, sweet: 2 as const, temp: "iced" as const } };
  const smoothie = { id: "s", cat: "cold" as const, name: "Smoothie", desc: "", price: 220, img: "x", noMilk: true };
  const toastie = { id: "t", cat: "food" as const, name: "Toastie", desc: "", price: 220, img: "x", addons: [{ id: "cheese", label: "Extra cheese", price: 40 }, { id: "gf-bread", label: "Gluten-free bread", price: 50 }] };
  const latte2 = { ...latte, cat: "coffee" as const };

  const o = cleanOptions(latte2, { milk: "soy", syrup: "hazelnut", toppings: ["whipped", "glitter", "cinnamon"], decaf: true, temp: "hot", extraHot: true });
  assert.equal(o.milk, "soy");
  assert.deepEqual(o.toppings, ["whipped", "cinnamon"], "unknown toppings are dropped");
  assert.equal(unitPrice(latte2, o), 200 + 30 + 30 + 30, "soy + syrup + whipped cream");
  assert.match(describeOptions(latte2, o), /extra hot.*soy milk.*decaf.*hazelnut syrup.*whipped cream/);

  // Cold drinks are always iced; drinks without milk get no milk, syrup or toppings
  assert.equal(cleanOptions(frappe, { temp: "hot" }).temp, "iced");
  assert.equal(cleanOptions(frappe, { ice: "light" }).ice, "light");
  const s = cleanOptions(smoothie, { milk: "oat", syrup: "vanilla", toppings: ["whipped"] });
  assert.equal(s.milk, undefined);
  assert.equal(s.syrup, undefined);
  assert.equal(unitPrice(smoothie, s), 220);

  // Food: only that item's add-ons, and they're added to the price
  const t = cleanOptions(toastie, { addons: ["gf-bread", "cheese", "caviar"], warm: true });
  assert.deepEqual(t, { addons: ["cheese", "gf-bread"] });
  assert.equal(unitPrice(toastie, t), 310);
  assert.equal(describeOptions(toastie, t), "Extra cheese · Gluten-free bread");

  // Golden hour is for bakes, not savoury food
  const find = (id: string) => (({ t: toastie, cake } as Record<string, typeof toastie>)[id]);
  const q = quote([{ itemId: "t", qty: 1 }, { itemId: "cake", qty: 1 }], find as never, null, false, { now: new Date("2026-10-19T15:30:00") });
  assert.equal(q.happyDiscount, Math.round(cake.price * 0.2));
});

test("allergens and calories follow syrups, toppings and food add-ons", async () => {
  const { allergensFor, kcalFor } = await import("../src/lib/nutrition.ts");
  const latte = { id: "l", cat: "coffee", allergens: [], kcal: 190 };
  assert.deepEqual(allergensFor(latte, { milk: "soy", syrup: "hazelnut" }), ["nuts", "soy"]);
  assert.ok(allergensFor(latte, { milk: "none", toppings: ["whipped"] }).includes("milk"), "whipped cream has milk");
  assert.ok(kcalFor(latte, { milk: "whole", syrup: "vanilla", toppings: ["whipped"] })! > 190 + 100);
  const toast = { id: "t", cat: "food", allergens: ["gluten", "milk"] as ("gluten" | "milk")[], kcal: 480, addons: [{ id: "egg", kcal: 90, adds: ["egg"] }, { id: "gf-bread", removes: ["gluten"] }] };
  assert.deepEqual(allergensFor(toast, { addons: ["gf-bread", "egg"] }), ["milk", "egg"]);
  assert.equal(kcalFor(toast, { addons: ["egg"] }), 570);
});

test("voice orders understand syrups, toppings, ice and food add-ons", async () => {
  const { parseVoiceOrder } = await import("../src/lib/voiceParse.ts");
  const menu = [
    { id: "iced-mocha", name: "Iced Mocha", cat: "cold" },
    { id: "honey-oat-latte", name: "Honey Oat Latte", cat: "coffee" },
    { id: "cheese-toastie", name: "Three Cheese Toastie", cat: "food", addons: [{ id: "egg", label: "Add a fried egg" }, { id: "gf-bread", label: "Gluten-free bread" }, { id: "cheese", label: "Extra cheese" }] },
  ];
  const r = parseVoiceOrder("an iced mocha with soy milk, less ice and whipped cream, and a cheese toastie with a fried egg on gluten-free bread", menu);
  assert.equal(r.lines[0].itemId, "iced-mocha");
  assert.equal(r.lines[0].opts.milk, "soy");
  assert.equal(r.lines[0].opts.ice, "light");
  assert.deepEqual(r.lines[0].opts.toppings, ["whipped"]);
  assert.equal(r.lines[1].itemId, "cheese-toastie");
  assert.deepEqual(r.lines[1].opts.addons, ["egg", "gf-bread"]);
  const h = parseVoiceOrder("decaf honey oat latte with vanilla syrup", menu).lines[0].opts;
  assert.equal(h.syrup, "vanilla");
  assert.equal(h.milk, undefined, "saying the name 'Honey Oat Latte' doesn't pick oat milk");
  assert.equal(parseVoiceOrder("honey oat latte with oat milk", menu).lines[0].opts.milk, "oat");
});

test("hours labels group days, and closures close a date", async () => {
  const { hoursLabel, applyConfig, DEFAULT_CONFIG, openStatus, slotsFor } = await import("../src/lib/cafe.ts");
  assert.deepEqual(hoursLabel().map((r) => `${r.days} ${r.time}`), ["Mon – Fri 7am – 8pm", "Saturday 8am – 10pm", "Sunday 9am – 6pm"]);
  applyConfig({ hours: { ...DEFAULT_CONFIG.hours, 1: null }, closures: [{ date: "2026-10-21", note: "Staff day out" }] });
  assert.equal(hoursLabel()[0].time, "Closed");
  assert.match(openStatus(new Date("2026-10-19T10:00:00")).text, /Closed today · open tomorrow at 7am/, "Monday closed");
  assert.match(openStatus(new Date("2026-10-21T10:00:00")).text, /Closed today · Staff day out/);
  assert.deepEqual(slotsFor("2026-10-21"), []);
  applyConfig(DEFAULT_CONFIG);
});

test("the text formatter makes simple marks into safe HTML", async () => {
  const { renderMarkdown } = await import("../src/lib/markdown.ts");
  const html = renderMarkdown("## Hello\n\nSome **bold** and *soft* words, [a link](https://x.example/a).\n\n- one\n- two\n\n<script>alert(1)</script> [bad](javascript:alert(1))");
  assert.match(html, /<h2>Hello<\/h2>/);
  assert.match(html, /<strong>bold<\/strong> and <em>soft<\/em>/);
  assert.match(html, /<a href="https:\/\/x.example\/a">a link<\/a>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.ok(!html.includes("<script"), "HTML is escaped");
  assert.ok(!html.includes('href="javascript'), "only http(s) links");
});

test("loyalty tiers and their free size upgrades", async () => {
  const { tierFor } = await import("../src/lib/tiers.ts");
  assert.equal(tierFor(3).id, "bronze");
  assert.equal(tierFor(3).next?.needed, 7);
  assert.equal(tierFor(10).id, "silver");
  assert.equal(tierFor(31).id, "gold");
  assert.equal(tierFor(31).next, null);
  const lines = [{ itemId: "latte", qty: 2, opts: { size: "large" } }];
  assert.equal(quote(lines, find, null, false, { tier: "silver" }).tierDiscount, 40, "silver: one cup");
  assert.equal(quote(lines, find, null, false, { tier: "gold" }).tierDiscount, 80, "gold: every cup");
  assert.equal(quote(lines, find, null, false, { tier: "bronze" }).tierDiscount, 0);
});

test("last-hour deal and student discount", () => {
  const find = (id: string) => ({ croissant: { id: "croissant", cat: "bakes", name: "Croissant", desc: "", price: 100, img: "" }, latte: { id: "latte", cat: "coffee", name: "Latte", desc: "", price: 200, img: "" } } as Record<string, MenuItem>)[id];
  const lines = [{ itemId: "croissant", qty: 2 }, { itemId: "latte", qty: 1 }];
  const monday = new Date(2026, 9, 19, 19, 30);
  const saturday = new Date(2026, 9, 24, 19, 30);
  const q = quote(lines, find, null, false, { now: monday, lastHour: { off: 0.3, cats: ["bakes"] }, student: true });
  assert.equal(q.lastHourDiscount, 60); // 30% of ₹200 of bakes
  assert.equal(q.studentDiscount, Math.round(q.lines.find((l) => l.itemId === "latte")!.total * 0.1));
  assert.equal(q.total, q.subtotal - 60 - q.studentDiscount);
  assert.equal(quote(lines, find, null, false, { now: saturday, student: true }).studentDiscount, 0, "weekdays only");
  assert.ok(isStudentEmail("f20240273@goa.bits-pilani.ac.in"));
  assert.ok(isStudentEmail("a@stanford.edu"));
  assert.ok(!isStudentEmail("a@gmail.com"));
});

test("combo deals: matched once per unit, only when they save money, and they don't stack with golden hour", () => {
  const items: Record<string, MenuItem> = {
    latte: { id: "latte", cat: "coffee", name: "Latte", desc: "", price: 220, img: "" },
    chai: { id: "chai", cat: "tea", name: "Chai", desc: "", price: 150, img: "" },
    croissant: { id: "croissant", cat: "bakes", name: "Croissant", desc: "", price: 150, img: "" },
    cookie: { id: "cookie", cat: "bakes", name: "Cookie", desc: "", price: 60, img: "" },
  };
  const find = (id: string) => items[id];
  const AM = new Date(2026, 9, 20, 10); // a Tuesday morning, outside golden hour
  const combos: Combo[] = [{ id: "bf", name: "Breakfast", price: 299, on: true, slots: [{ label: "Coffee", cats: ["coffee"] }, { label: "Bake", cats: ["bakes"] }] }];
  // 2 lattes + 1 croissant + 1 cookie: one combo with the croissant (saves 71), one with the cookie isn't worth it (280 < 299)
  const q = quote([{ itemId: "latte", qty: 2 }, { itemId: "croissant", qty: 1 }, { itemId: "cookie", qty: 1 }], find, null, false, { combos, now: AM });
  assert.deepEqual(q.combos, [{ id: "bf", name: "Breakfast", count: 1, saving: 71 }]);
  assert.equal(q.total, q.subtotal - 71);
  // Two of each: two combos
  assert.equal(quote([{ itemId: "latte", qty: 2 }, { itemId: "croissant", qty: 2 }], find, null, false, { combos, now: AM }).comboDiscount, 142);
  // Tea doesn't count as coffee
  assert.equal(quote([{ itemId: "chai", qty: 1 }, { itemId: "croissant", qty: 1 }], find, null, false, { combos, now: AM }).comboDiscount, 0);
  const m = matchCombos(quote([{ itemId: "latte", qty: 1 }, { itemId: "croissant", qty: 1 }], find).lines, combos);
  assert.deepEqual(m.used, [1, 1]);
});

test("build-your-own groups and half portions", () => {
  const bowl: MenuItem = {
    id: "bowl", cat: "food", name: "Bowl", desc: "", price: 240, img: "", kcal: 300, allergens: [],
    groups: [
      { id: "base", label: "Base", min: 1, max: 1, choices: [{ id: "rice", label: "Rice", price: 0 }, { id: "quinoa", label: "Quinoa", price: 0 }] },
      { id: "top", label: "Toppings", min: 0, max: 2, choices: [{ id: "avo", label: "Avocado", price: 40, kcal: 120 }, { id: "feta", label: "Feta", price: 40, adds: ["milk"] }, { id: "corn", label: "Corn", price: 0 }] },
    ],
  };
  const o = cleanOptions(bowl, { picks: { base: ["quinoa"], top: ["feta", "avo", "corn"] } });
  assert.deepEqual(o.picks, { base: ["quinoa"], top: ["avo", "feta"] }, "kept to each group's max, in menu order");
  assert.equal(unitPrice(bowl, o), 320);
  assert.equal(describeOptions(bowl, o), "Quinoa · Avocado · Feta");
  assert.deepEqual(cleanOptions(bowl, {}).picks, { base: ["rice"], top: [] }, "a required choice is filled in");
  const pasta: MenuItem = { id: "pasta", cat: "food", name: "Pasta", desc: "", price: 340, img: "", half: true };
  assert.equal(unitPrice(pasta, cleanOptions(pasta, { half: true })), 200);
  const noHalf: MenuItem = { ...pasta, half: undefined };
  assert.equal(unitPrice(noHalf, cleanOptions(noHalf, { half: true })), 340, "only items that offer it");
});

test("the wider allergen list: shellfish, fish, peanuts, mustard, celery", async () => {
  const { ALLERGENS, allergensFor, canAvoid } = await import("../src/lib/nutrition.ts");
  assert.ok(["peanuts", "fish", "shellfish", "mustard", "celery"].every((a) => ALLERGENS.some((x) => x.id === a)));
  const prawns = { id: "p", cat: "food", allergens: ["gluten", "shellfish"] as never[] };
  assert.deepEqual(allergensFor(prawns), ["gluten", "shellfish"]);
  assert.equal(canAvoid(prawns, "shellfish" as never), false);
});

test("CSV reading and item notes", async () => {
  const { parseCsv } = await import("../src/lib/csv.ts");
  const rows = parseCsv('﻿Name,Phone,Note\r\n"Rao, Meera",98765 43210,"said ""hi"""\r\n\r\nKabir,9123456789,\n');
  assert.deepEqual(rows, [{ name: "Rao, Meera", phone: "98765 43210", note: 'said "hi"' }, { name: "Kabir", phone: "9123456789", note: "" }]);
  const o = cleanOptions(latte, { size: "regular", note: "  less   ice please  " });
  assert.equal(o.note, "less ice please");
  assert.match(describeOptions(latte, o), /“less ice please”$/);
});

test("every language has every label, and the opening status is translated", async () => {
  const { DICT } = await import("../src/lib/i18n.ts");
  const keys = Object.keys(DICT.en).sort();
  for (const lang of ["hi", "mr", "kok"] as const) {
    assert.deepEqual(Object.keys(DICT[lang]).sort(), keys, lang);
    for (const k of keys) assert.ok(DICT[lang][k as keyof typeof DICT.en].trim(), `${lang} ${k} is empty`);
  }
  const noon = new Date(2026, 9, 20, 12); // a Tuesday, open
  assert.match(openStatus(noon).text, /^Open now/);
  const hi = openStatus(noon, null, "hi").text;
  assert.match(hi, /खुला/);
  assert.doesNotMatch(hi, /\{|Open/);
});

test("dish names fall back to the nearest language", async () => {
  const { itemName } = await import("../src/lib/menu.ts");
  const m = { name: "Chai", nameHi: "चाय", nameMr: "चहा" };
  assert.equal(itemName(m, "en"), "Chai");
  assert.equal(itemName(m, "hi"), "चाय");
  assert.equal(itemName(m, "mr"), "चहा");
  assert.equal(itemName(m, "kok"), "चहा");
  assert.equal(itemName({ ...m, nameKok: "चा" }, "kok"), "चा");
  assert.equal(itemName({ name: "Chai" }, "mr"), "Chai");
});

test("every drink choice and allergen has a translated label", async () => {
  const { DICT } = await import("../src/lib/i18n.ts");
  const { SIZES, TEMPS, ICE, MILKS, SWEETS, SYRUPS, TOPPINGS } = await import("../src/lib/pricing.ts");
  const { ALLERGENS } = await import("../src/lib/nutrition.ts");
  const need = [
    ...Object.entries({ size: SIZES, temp: TEMPS, ice: ICE, milk: MILKS, sweet: SWEETS, syrup: SYRUPS, toppings: TOPPINGS }).flatMap(([k, list]) => list.map((c) => `${k}.${c.value}`)),
    ...ALLERGENS.map((a) => `al.${a.id}`),
  ];
  const missing = need.filter((k) => !(k in DICT.en));
  assert.deepEqual(missing, []);
});

test("weather picks: rain means chai, heat means something cold", async () => {
  const { weatherPicks, moodFor, isRainy } = await import("../src/lib/weatherPicks.ts");
  const menu = ["chai", "monsoon-ginger-chai", "kokum-soda", "cold-brew", "hot-chocolate", "rose-latte", "iced-brown-sugar"].map((id) => ({ id }));
  assert.equal(moodFor({ temp: 27, code: 63, isDay: true }), "rain");
  assert.ok(isRainy(95) && !isRainy(2));
  assert.equal(moodFor({ temp: 34, code: 0, isDay: true }), "hot");
  assert.equal(moodFor({ temp: 19, code: 1, isDay: false }), "cool");
  assert.equal(moodFor({ temp: 27, code: 1, isDay: true }), "nice");
  assert.deepEqual(weatherPicks({ temp: 27, code: 63, isDay: true }, menu).items.map((m) => m.id), ["monsoon-ginger-chai", "chai", "hot-chocolate"]);
  const hot = weatherPicks({ temp: 35, code: 0, isDay: true }, [...menu.filter((m) => m.id !== "kokum-soda"), { id: "kokum-soda", soldOut: true }]);
  assert.deepEqual(hot.items.map((m) => m.id), ["cold-brew"], "sold-out dishes are skipped");
});

test("caffeine: size, extra shot, decaf and herbal teas", async () => {
  const { caffeineFor, guessCaffeine, caffeineNudge, DAILY_LIMIT } = await import("../src/lib/caffeine.ts");
  const latte = { id: "x-latte", cat: "coffee", name: "Latte", traits: { energy: 1 } };
  assert.equal(caffeineFor(latte), 128);
  assert.equal(caffeineFor(latte, { size: "large" }), Math.round(128 * 1.3));
  assert.equal(caffeineFor(latte, { shot: true }), 192);
  assert.equal(caffeineFor(latte, { decaf: true, shot: true }), 5);
  assert.equal(caffeineFor({ id: "cold-brew", cat: "cold", name: "Slow Cold Brew" }), 200);
  assert.equal(caffeineFor({ id: "chamomile", cat: "tea", name: "Chamomile & Honey" }), 0);
  assert.equal(caffeineFor({ id: "kokum-soda", cat: "cold", name: "Kokum Soda", desc: "Goan kokum syrup, lime" }), 0);
  assert.equal(caffeineFor({ id: "new", cat: "coffee", name: "New", caffeine: 77 }), 77, "the owner's number wins");
  assert.equal(guessCaffeine("Double espresso"), 128);
  assert.equal(guessCaffeine("Peppermint tea"), 0);
  assert.equal(guessCaffeine("Masala chai"), 45);
  assert.equal(guessCaffeine("Lemonade"), null);
  assert.match(caffeineNudge(DAILY_LIMIT + 1, 10)!, /over/);
  assert.match(caffeineNudge(250, 17)!, /late/);
  assert.equal(caffeineNudge(250, 10), null);
});

test("barista rush: orders make sense and are marked fairly", async () => {
  const { newOrder, mistakes, points, gameChoices, playableDrinks } = await import("../src/lib/gameOrders.ts");
  const drinks = playableDrinks([
    { id: "cold", cat: "cold", name: "Cold", noMilk: true },
    { id: "kid", cat: "cold", name: "Kids", kids: true },
    { id: "bowl", cat: "food", name: "Bowl" },
  ]);
  assert.deepEqual(drinks.map((d) => d.id), ["cold"]);
  for (let i = 0; i < 20; i++) {
    const o = newOrder(drinks);
    assert.equal(o.want.temp, "iced", "cold drinks are always iced");
    assert.equal(o.want.milk, "none", "no milk when the drink has none");
    assert.equal(o.want.shot, false, "shots are only for coffee");
  }
  assert.deepEqual(gameChoices({ id: "c", cat: "coffee", name: "C" }), { temp: true, milk: true, shot: true });
  const want = { size: "large", temp: "iced", milk: "oat", shot: true } as const;
  assert.deepEqual(mistakes(want, { ...want }), []);
  assert.deepEqual(mistakes(want, { ...want, milk: "soy", size: "small" }), ["size", "milk"]);
  assert.equal(points(0, 0), 150);
  assert.equal(points(10, 0), 100, "slow but right still scores");
  assert.equal(points(0, 20), 300, "the streak doubles it at most");
});

test("brew timer steps and the origins map", async () => {
  const { BREW_METHODS, stepAt, mmss } = await import("../src/lib/brewMethods.ts");
  for (const m of BREW_METHODS) {
    assert.equal(m.steps[0].at, 0, `${m.id} starts at 0`);
    assert.ok(m.steps.every((s, i) => i === 0 || s.at > m.steps[i - 1].at), `${m.id} steps in order`);
    assert.ok(m.total > m.steps[m.steps.length - 1].at);
    assert.ok(m.steps.some((s) => s.water === 1), `${m.id} pours all the water`);
  }
  const v60 = BREW_METHODS[0];
  assert.equal(stepAt(v60, -1), -1);
  assert.equal(stepAt(v60, 50), 2);
  assert.equal(mmss(75), "1:15");
  const { ORIGINS, CAFE_SPOT, project, MAP_SIZE, coastPath } = await import("../src/lib/origins.ts");
  for (const o of [...ORIGINS, CAFE_SPOT]) {
    const p = project(o.lat, o.lon);
    assert.ok(p.x > 0 && p.x < MAP_SIZE.w && p.y > 0 && p.y < MAP_SIZE.h, `${o.name} is on the map`);
  }
  assert.match(coastPath(), /^M-?[\d.]+,-?[\d.]+ L.* Z$/);
});

test("flavour notes: cleaned, read from dishes, and favourites weighted by rating", async () => {
  const { cleanFlavours, dishFlavours, favouriteFlavours } = await import("../src/lib/flavours.ts");
  assert.deepEqual(cleanFlavours(["nutty", "nutty", "bogus", "floral", "citrus", "berry", "bold"]), ["nutty", "floral", "citrus", "berry"], "real notes, no repeats, four at most");
  assert.deepEqual(cleanFlavours("nutty"), []);
  assert.deepEqual(dishFlavours({ name: "Hazelnut Latte", desc: "Espresso, steamed milk and toasted hazelnut syrup." }).sort(), ["creamy", "nutty"].sort());
  assert.ok(dishFlavours({ name: "Rose Pistachio Latte", desc: "rose syrup, pistachio cream" }).includes("floral"));
  const fav = favouriteFlavours([
    { rating: 5, flavours: ["chocolatey", "nutty"] },
    { rating: 4, flavours: ["nutty"] },
    { rating: 2, flavours: ["citrus"] },
    { rating: 3, flavours: ["floral"] },
  ]);
  assert.deepEqual(fav, ["nutty", "chocolatey", "floral"], "a 2★ note doesn't count as a favourite");
});

test("daily challenge: the same orders for everyone on a day, and streaks", async () => {
  const { seededRand, newOrder, playStreak } = await import("../src/lib/gameOrders.ts");
  const drinks = [{ id: "a", cat: "coffee", name: "A" }, { id: "b", cat: "tea", name: "B" }, { id: "c", cat: "cold", name: "C" }];
  const run = (seed: string) => { const r = seededRand(seed); return Array.from({ length: 8 }, () => newOrder(drinks, r)); };
  assert.deepEqual(run("moss-moon-2026-10-23"), run("moss-moon-2026-10-23"), "same day, same orders");
  assert.notDeepEqual(run("moss-moon-2026-10-23"), run("moss-moon-2026-10-24"), "a new day, new orders");
  assert.equal(playStreak(["2026-10-21", "2026-10-22", "2026-10-23"], "2026-10-23"), 3);
  assert.equal(playStreak(["2026-10-20", "2026-10-22", "2026-10-23"], "2026-10-23"), 2);
  assert.equal(playStreak(["2026-10-22"], "2026-10-23"), 0, "today not played yet");
});

test("moon: full-moon times match the almanac, and nights are counted in India", async () => {
  const { fullMoonsFrom, fullMoonNight, isFullMoonNight, moonNow } = await import("../src/lib/moon.ts");
  // Known 2026 full moons (UTC): the 3 March total eclipse, 28 Aug, 26 Oct
  const near = (iso: string) => {
    const want = Date.parse(iso);
    const got = fullMoonsFrom(new Date(want - 5 * 86400_000), 1)[0].getTime();
    assert.ok(Math.abs(got - want) < 20 * 60_000, `${iso}: off by ${Math.round((got - want) / 60_000)} min`);
  };
  near("2026-03-03T11:38:00Z");
  near("2026-08-28T04:18:00Z");
  near("2026-10-26T04:12:00Z");
  near("2026-12-24T01:28:00Z");
  // 26 Oct 09:42 India time belongs to the night of the 25th
  assert.equal(fullMoonNight(new Date("2026-10-26T04:12:00Z")), "2026-10-25");
  assert.equal(isFullMoonNight("2026-10-25"), true);
  assert.equal(isFullMoonNight("2026-10-24"), false);
  assert.equal(isFullMoonNight("2026-10-24", 1), true, "the night before counts with spread 1");
  assert.equal(isFullMoonNight("2026-10-20", 1), false);
  const before = moonNow(new Date("2026-10-23T12:00:00+05:30"));
  assert.equal(before.phase.id, "waxing-gibbous");
  assert.equal(before.nextFull, "2026-10-25");
  assert.equal(before.daysToFull, 2);
  const on = moonNow(new Date("2026-10-25T21:00:00+05:30"));
  assert.equal(on.fullTonight, true);
  assert.equal(on.phase.id, "full");
  assert.equal(on.nextFull, "2026-11-24");
  const dark = moonNow(new Date("2026-11-09T22:00:00+05:30"));
  assert.ok(dark.lit < 5, "new moon is dark");
});

test("bingo: a fair, repeatable card and the right lines", async () => {
  const { pickCard, doneLines, BINGO_LINES } = await import("../src/lib/bingo.ts");
  const pool = [...Array(40).keys()].map((i) => ({ id: `item-${i}`, name: `Item ${i}`, cat: ["coffee", "tea", "cold", "food", "bakes"][i % 5] }));
  const a = pickCard(pool, "2026-10"), b = pickCard([...pool].reverse(), "2026-10"), c = pickCard(pool, "2026-11");
  assert.equal(a.length, 16);
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id), "same month, same card, whatever the menu order");
  assert.notDeepEqual(a.map((x) => x.id), c.map((x) => x.id), "a new card next month");
  const per = new Map<string, number>();
  for (const x of a) per.set(x.cat, (per.get(x.cat) ?? 0) + 1);
  assert.ok([...per.values()].every((n) => n <= 5));
  assert.equal(pickCard(pool.slice(0, 10), "2026-10").length, 10, "a small menu gives a smaller card");
  assert.equal(BINGO_LINES.length, 10);
  const st = Array(16).fill(false);
  assert.equal(doneLines(st).length, 0);
  [0, 5, 10, 15].forEach((i) => (st[i] = true));
  assert.deepEqual(doneLines(st), [[0, 5, 10, 15]], "a diagonal");
  [4, 6, 7].forEach((i) => (st[i] = true));
  assert.equal(doneLines(st).length, 2, "and the second row");
});

test("calendar files: India times, escaped text and a reminder", async () => {
  const { icsText, googleCalUrl } = await import("../src/lib/ics.ts");
  const e = { uid: "TB1234", title: "Table for 2, by the window", date: "2026-12-31", time: "23:00", minutes: 90, details: "Line one\nline two; ok", alarmMinutes: 60 };
  const ics = icsText(e, new Date("2026-10-01T00:00:00Z"));
  assert.match(ics, /DTSTART;TZID=Asia\/Kolkata:20261231T230000/);
  assert.match(ics, /DTEND;TZID=Asia\/Kolkata:20270101T003000/, "runs past midnight into the new year");
  assert.match(ics, /SUMMARY:Table for 2\\, by the window/);
  assert.match(ics, /DESCRIPTION:Line one\\nline two\\; ok/);
  assert.match(ics, /TRIGGER:-PT60M/);
  assert.ok(ics.split("\r\n").length > 10);
  const g = new URL(googleCalUrl(e));
  assert.equal(g.searchParams.get("dates"), "20261231T230000/20270101T003000");
  assert.equal(g.searchParams.get("ctz"), "Asia/Kolkata");
});

test("focus timer: breaks, a long one every fourth round, and the clock", async () => {
  const { nextPhase, phaseMinutes, clock, PLANS } = await import("../src/lib/focus.ts");
  assert.equal(nextPhase("work", 1), "short");
  assert.equal(nextPhase("work", 3), "short");
  assert.equal(nextPhase("work", 4), "long");
  assert.equal(nextPhase("short", 2), "work");
  assert.equal(nextPhase("long", 4), "work");
  assert.equal(phaseMinutes(PLANS[0], "work"), 25);
  assert.equal(clock(1500), "25:00");
  assert.equal(clock(61), "1:01");
  assert.equal(clock(-5), "0:00");
});

test("trivia: every question is sound, and days rotate through them", async () => {
  const { QUESTIONS, questionIndex, bestRun } = await import("../src/lib/trivia.ts");
  assert.ok(QUESTIONS.length >= 30);
  for (const q of QUESTIONS) {
    assert.equal(q.choices.length, 4, q.q);
    assert.ok(q.answer >= 0 && q.answer < 4, q.q);
    assert.equal(new Set(q.choices).size, 4, `no repeated choices: ${q.q}`);
  }
  assert.equal(new Set(QUESTIONS.map((q) => q.q)).size, QUESTIONS.length, "no repeated questions");
  const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
  const run = [...Array(QUESTIONS.length).keys()].map((i) => questionIndex(day(i)));
  assert.equal(new Set(run).size, QUESTIONS.length, "no repeats until every question has had a turn");
  assert.equal(questionIndex("2026-10-23"), questionIndex("2026-10-23"));
  assert.equal(bestRun([]), 0);
  assert.equal(bestRun(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-02"]), 3);
  assert.equal(bestRun(["2026-12-31", "2027-01-01"]), 2, "across the new year");
});

test("seat tags and colouring pages are well formed", async () => {
  const { cleanTags, FLOOR, DEFAULT_TAGS } = await import("../src/lib/floor.ts");
  assert.deepEqual(cleanTags(null)[1], []);
  assert.deepEqual(cleanTags({ 1: ["window", "window", "bogus"] })[1], ["window"]);
  assert.ok(FLOOR.every((t) => Array.isArray(DEFAULT_TAGS[t.no])));
  const { COLOUR_PAGES, CRAYONS } = await import("../src/lib/colouring.ts");
  for (const p of COLOUR_PAGES) {
    assert.equal(new Set(p.areas.map((a) => a.id)).size, p.areas.length, `${p.id}: unique areas`);
    for (const a of p.areas) assert.match(a.d, /^M[-\d.,]+[\s\S]*Z$/, `${p.id}/${a.id} is a closed shape`);
  }
  assert.ok(CRAYONS.includes("#ffffff"), "has a rubber");
});

test("read your cup: the same reading all day, coloured by the moon", async () => {
  const { readCup, moonGroup, FORTUNES } = await import("../src/lib/fortune.ts");
  const a = readCup("2026-10-24", "voter1", "waxing-gibbous");
  assert.deepEqual(readCup("2026-10-24", "voter1", "waxing-gibbous"), a);
  assert.equal(a.group, "waxing");
  assert.ok(FORTUNES.waxing.includes(a.text));
  assert.ok(a.luckyNumber >= 1 && a.luckyNumber <= 9);
  assert.equal(moonGroup("full"), "full");
  assert.equal(moonGroup("new"), "new");
  assert.equal(moonGroup("first-quarter"), "waxing");
  assert.equal(moonGroup("last-quarter"), "waning");
  assert.equal(moonGroup("waning-crescent"), "waning");
  const days = new Set(Array.from({ length: 10 }, (_, i) => readCup(`2026-11-${String(i + 1).padStart(2, "0")}`, "voter1", "full").text + readCup(`2026-11-${String(i + 1).padStart(2, "0")}`, "voter1", "full").symbol.name));
  assert.ok(days.size > 3, "changes day to day");
});

test("letters: open dates land on the same day a few months on", async () => {
  const { openOn, isOpen, daysUntil } = await import("../src/lib/letters.ts");
  assert.equal(openOn("2026-10-24", 3), "2027-01-24");
  assert.equal(openOn("2026-10-24", 12), "2027-10-24");
  assert.equal(openOn("2026-08-31", 6), "2027-02-28");
  assert.equal(openOn("2027-08-31", 6), "2028-02-29");
  assert.ok(isOpen("2026-10-24", "2026-10-24"));
  assert.ok(!isOpen("2026-10-25", "2026-10-24"));
  assert.equal(daysUntil("2026-11-03", "2026-10-24"), 10);
});

test("café word: answers are real five-letter words, scoring handles repeated letters", async () => {
  const { ANSWERS, score, wordFor, shareGrid } = await import("../src/lib/wordGame.ts");
  const { WORDS5 } = await import("../src/lib/data/words5.ts");
  assert.ok(ANSWERS.length >= 60);
  assert.equal(new Set(ANSWERS).size, ANSWERS.length, "no repeats");
  for (const w of ANSWERS) assert.match(w, /^[a-z]{5}$/);
  const dict = new Set(WORDS5.split(" "));
  assert.ok(dict.size > 10000);
  assert.ok(dict.has("beans") && dict.has("toast"), "plurals and common words");
  assert.deepEqual(score("cocoa", "crema"), ["g", "b", "b", "b", "g"]);
  assert.deepEqual(score("tatty", "latte"), ["b", "g", "g", "g", "b"]);
  assert.deepEqual(score("eerie", "there"), ["y", "b", "y", "b", "g"]);
  assert.deepEqual(score("latte", "latte"), ["g", "g", "g", "g", "g"]);
  assert.equal(wordFor("2026-10-24"), wordFor("2026-10-24"));
  const month = new Set(Array.from({ length: 30 }, (_, i) => wordFor(new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10))));
  assert.equal(month.size, 30, "no repeats within a month");
  assert.equal(shareGrid([["g", "y", "b", "b", "g"]]), "🟩🟨⬜⬜🟩");
});

test("bring it back months and the secret moons", async () => {
  const { shiftMonth, monthOf } = await import("../src/lib/comeback.ts");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(monthOf("2026-10-24"), "2026-10");
  const { MOONS, allFound, cleanFound } = await import("../src/lib/secret.ts");
  assert.equal(MOONS.length, 5);
  assert.deepEqual(cleanFound(["nope", MOONS[0].id, MOONS[0].id]), [MOONS[0].id]);
  assert.ok(!allFound(MOONS.slice(1).map((m) => m.id)));
  assert.ok(allFound(MOONS.map((m) => m.id).reverse()));
  assert.ok(!allFound("all"));
});

test("konkani: a word a day, and a fair Sunday quiz on the week before", async () => {
  const { KONKANI, konkaniFor, quizFor, weekBefore } = await import("../src/lib/konkani.ts");
  assert.ok(KONKANI.length >= 30);
  assert.equal(new Set(KONKANI.map((w) => w.word)).size, KONKANI.length, "no repeats");
  assert.equal(new Set(KONKANI.map((w) => w.means)).size, KONKANI.length, "meanings are distinct, so the quiz has one right answer");
  assert.deepEqual(konkaniFor("2026-10-24"), konkaniFor("2026-10-24"));
  assert.deepEqual(weekBefore("2026-10-25"), ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]);
  const quiz = quizFor("2026-10-25");
  assert.equal(quiz.length, 6);
  for (const [i, q] of quiz.entries()) {
    assert.equal(q.choices.length, 4);
    assert.equal(new Set(q.choices).size, 4);
    assert.equal(q.choices[q.answer], konkaniFor(weekBefore("2026-10-25")[i]).means);
  }
});

test("memory match: the same cards all day, every card has a pair", async () => {
  const { pickItems, deal, minMs, memoryMode, clock } = await import("../src/lib/memory.ts");
  const items = Array.from({ length: 20 }, (_, i) => ({ id: `i${i}` }));
  const a = pickItems(items, "2026-10-24", "full");
  assert.equal(a.length, 8);
  assert.deepEqual(pickItems([...items].reverse(), "2026-10-24", "full"), a, "menu order doesn't matter");
  assert.equal(pickItems(items, "2026-10-24", "easy").length, 6);
  const cards = deal(a);
  assert.equal(cards.length, 16);
  for (const it of a) assert.equal(cards.filter((c) => c.item.id === it.id).length, 2);
  assert.equal(memoryMode("nope"), "full");
  assert.equal(minMs("easy"), 7200);
  assert.equal(clock(65400), "1:05.4");
});

test("wish tree: ribbons stay on the tree, and the tree knows its full moons", async () => {
  const { ribbonSpot } = await import("../src/lib/wishes.ts");
  for (let i = 0; i < 300; i++) { const { x, y } = ribbonSpot(i); assert.ok(x > 50 && x < 350 && y > 40 && y < 180, `${i}: ${x},${y}`); }
  const { fullMoonAround } = await import("../src/lib/moon.ts");
  const now = new Date("2026-10-24T12:00:00Z");
  const { prev, next } = fullMoonAround(now);
  assert.ok(prev < now.getTime() && now.getTime() < next);
  assert.equal(new Date(next).toISOString().slice(0, 13), "2026-10-26T04");
});

test("sunset: Panjim's evenings in the right order and at the right times", async () => {
  const { sunDay, istClock } = await import("../src/lib/sun.ts");
  const oct = sunDay("2026-10-24");
  assert.ok(oct.goldenStart < oct.sunset && oct.sunset < oct.dusk);
  const mins = (ms: number) => { const [h, m] = istClock(ms).split(":").map(Number); return h * 60 + m; };
  assert.ok(mins(oct.sunset) >= 18 * 60 + 5 && mins(oct.sunset) <= 18 * 60 + 15, istClock(oct.sunset));
  assert.ok(mins(oct.sunrise) >= 6 * 60 + 20 && mins(oct.sunrise) <= 6 * 60 + 35, istClock(oct.sunrise));
  const jun = sunDay("2026-06-21");
  assert.ok(mins(jun.sunset) >= 19 * 60 && mins(jun.sunset) <= 19 * 60 + 15, istClock(jun.sunset));
  assert.ok(mins(oct.sunset) - mins(oct.goldenStart) >= 20 && mins(oct.sunset) - mins(oct.goldenStart) <= 40, "golden hour is about half an hour this far south");
});

test("moon calendar, weekly poll, six-word stories and blind-date hints", async () => {
  const { monthNights, nextFullMoons } = await import("../src/lib/moonCalendar.ts");
  const oct = monthNights("2026-10");
  assert.equal(oct.length, 31);
  assert.deepEqual(oct.filter((n) => n.cortado).map((n) => n.date), ["2026-10-24", "2026-10-25", "2026-10-26"]);
  assert.equal(oct.find((n) => n.date === "2026-10-25")!.phase, "full");
  assert.equal(nextFullMoons(new Date("2026-10-01T00:00:00Z"), 2)[0].night, "2026-10-25");
  const { weekOf, ideaFor, POLL_IDEAS } = await import("../src/lib/polls.ts");
  assert.equal(weekOf("2026-10-24"), "2026-10-19");
  assert.equal(weekOf("2026-10-19"), "2026-10-19");
  assert.equal(weekOf("2026-10-25"), "2026-10-19", "Sunday ends the week");
  assert.deepEqual(ideaFor("2026-10-19"), ideaFor("2026-10-19"));
  for (const p of POLL_IDEAS) assert.ok(p.choices.length >= 2 && p.choices.length <= 5 && new Set(p.choices).size === p.choices.length, p.q);
  const { isSixWords, storyWords } = await import("../src/lib/stories.ts");
  assert.ok(isSixWords("Ordered decaf. Regretted it. Ordered espresso."));
  assert.ok(isSixWords("Strong coffee — weak excuses, better mornings"), "a dash isn't a word");
  assert.equal(storyWords("Twenty-two cups later, finally awake. Yay!").length, 6, "hyphenated words count once");
  assert.ok(!isSixWords("Too short to be one"));
  const { cleanHints, DEFAULT_HINTS } = await import("../src/lib/blindDate.ts");
  assert.deepEqual(cleanHints(["a", " ", "b", "c", "d"]), ["a", "b"], "first three, blanks dropped");
  for (const h of Object.values(DEFAULT_HINTS)) assert.equal(h.length, 3);
});

test("café connections: every puzzle has 16 different words, and guesses are checked fairly", async () => {
  const { PUZZLES, puzzleFor, tilesFor, checkGuess, connectionsGrid } = await import("../src/lib/connections.ts");
  for (const p of PUZZLES) {
    const words = p.flatMap((g) => g.words);
    assert.equal(words.length, 16, p[0].name);
    assert.equal(new Set(words).size, 16, `${p[0].name}: no word in two groups`);
    for (const w of words) assert.match(w, /^[A-Z]+$/, w);
  }
  const p = puzzleFor("2026-10-24");
  assert.deepEqual(puzzleFor("2026-10-24"), p, "same puzzle all day");
  assert.notDeepEqual(puzzleFor("2026-10-25"), p, "a new one tomorrow");
  assert.deepEqual([...tilesFor("2026-10-24")].sort(), p.flatMap((g) => g.words).sort());
  assert.deepEqual(checkGuess(p, [...p[2].words]), { level: 2, away: 0 });
  assert.deepEqual(checkGuess(p, [...p[1].words.slice(0, 3), p[0].words[0]]), { level: null, away: 1 }, "one away");
  assert.equal(connectionsGrid(p, [[...p[0].words]]), "🟨🟨🟨🟨");
});

test("slide puzzle: scrambles can always be solved and never start nearly done", async () => {
  const { scramble, isSolved, solved, slide, movable, distance } = await import("../src/lib/slide.ts");
  assert.ok(isSolved(solved(3)));
  // Only half of all tile orders can be solved: count inversions to check every scramble is a solvable one
  const solvable = (b: number[]) => {
    const n = Math.sqrt(b.length), t = b.filter(Boolean);
    let inv = 0;
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (t[i] > t[j]) inv++;
    const gapRowFromBottom = n - Math.floor(b.indexOf(0) / n);
    return n % 2 ? inv % 2 === 0 : (inv + gapRowFromBottom) % 2 === 1;
  };
  for (let i = 0; i < 50; i++) for (const n of [3, 4]) {
    const b = scramble(n);
    assert.ok(!isSolved(b) && solvable(b) && distance(b) >= n * n);
  }
  const b = solved(3);
  assert.deepEqual(movable(b).sort(), [5, 7]);
  assert.deepEqual(slide(b, 0), b, "a tile away from the gap doesn't move");
  assert.equal(slide(b, 7).indexOf(0), 7);
});

test("fruit calendar: months are real, and dishes are matched by name", async () => {
  const { FRUITS, inSeason, comingNext, dishesWith } = await import("../src/lib/fruits.ts");
  for (const f of FRUITS) assert.ok(f.months.length && f.months.every((m) => m >= 1 && m <= 12), f.id);
  assert.ok(inSeason(5).some((f) => f.id === "mango"));
  assert.ok(!inSeason(10).some((f) => f.id === "mango"));
  assert.equal(inSeason(10).at(-1)!.months.length, 12, "year-round fruit goes last");
  assert.ok(comingNext(2).some((f) => f.id === "mango"));
  const mango = FRUITS.find((f) => f.id === "mango")!;
  assert.deepEqual(dishesWith(mango, [{ name: "Mango Cold Brew" }, { name: "Alphonso Mango Sorbet" }, { name: "Latte" }]).length, 2);
  const { noteProblem } = await import("../src/lib/kindNotes.ts");
  assert.equal(noteProblem("You're doing better than you think."), null);
  assert.ok(noteProblem("follow me at www.example.com"));
  assert.ok(noteProblem("call me on 98765 43210 anytime"));
});

test("mini sudoku: every daily grid is fair, with exactly one answer", async () => {
  const { sudokuFor, isComplete, countSolutions, clashes, SUDOKU_MODES } = await import("../src/lib/sudoku.ts");
  for (const date of ["2026-10-25", "2026-10-26", "2027-01-01", "2027-02-28"]) for (const mode of ["easy", "hard"] as const) {
    const { puzzle, answer } = sudokuFor(date, mode);
    assert.ok(isComplete(answer), `${date} ${mode}: the answer follows the rules`);
    assert.ok(puzzle.every((v, i) => !v || v === answer[i]), "the clues match the answer");
    assert.equal(countSolutions([...puzzle]), 1, `${date} ${mode}: only one answer`);
    assert.ok(puzzle.filter(Boolean).length <= SUDOKU_MODES[mode] + 2);
  }
  assert.deepEqual(sudokuFor("2026-10-25", "easy"), sudokuFor("2026-10-25", "easy"), "the same grid all day");
  const b = sudokuFor("2026-10-25", "easy").answer.slice();
  [b[0], b[1]] = [b[1], b[0]];
  assert.ok(!isComplete(b) && clashes(b).size > 0, "swapping two pictures breaks it");
});

test("word search: eight words, each hidden exactly once, found either way round", async () => {
  const { wordSearchFor, lineBetween, wordAt, SIZE, HIDDEN } = await import("../src/lib/wordSearch.ts");
  for (const date of ["2026-10-25", "2026-10-26", "2026-12-31"]) {
    const { grid, words } = wordSearchFor(date);
    assert.equal(grid.length, SIZE * SIZE);
    assert.equal(words.length, HIDDEN);
    for (const w of words) assert.equal(w.cells.map((c) => grid[c]).join(""), w.word, `${date} ${w.word}`);
    const dirs = new Set(words.map((w) => w.cells[1] - w.cells[0]));
    assert.ok(dirs.size >= 3, "a mix of across, down and diagonal");
  }
  const { words } = wordSearchFor("2026-10-25");
  const w = words[0];
  assert.equal(wordAt(words, lineBetween(w.cells[0], w.cells.at(-1)!)!), w.word);
  assert.equal(wordAt(words, lineBetween(w.cells.at(-1)!, w.cells[0])!), w.word, "dragging backwards counts");
  assert.equal(lineBetween(0, 12), null, "not a straight line");
  const { recipeLines, recipeProblem } = await import("../src/lib/guestRecipes.ts");
  assert.deepEqual(recipeLines("- 2 cups water\n\n1. Boil it\n• <b>sugar</b>", 10), ["2 cups water", "Boil it", "bsugar/b"]);
  assert.ok(recipeProblem({ title: "Chai", ingredients: ["tea"], steps: ["boil"] }));
  const { cleanSpy, ISPY_DEFAULT } = await import("../src/lib/ispy.ts");
  assert.deepEqual(cleanSpy(["  a plant ", "", "<b>"]), ["a plant", "b"]);
  assert.ok(ISPY_DEFAULT.length >= 8);
});

test("connect four: drops, wins, and a barista who takes a win and blocks one", async () => {
  const { empty, drop, winner, botMove, topVote, openCols, COLS } = await import("../src/lib/connect4.ts");
  let b = empty();
  for (let i = 0; i < 6; i++) b = drop(b, 0, 1)!;
  assert.equal(drop(b, 0, 2), null, "a full column takes no more");
  assert.ok(!openCols(b).includes(0));
  b = empty();
  for (const c of [0, 1, 2, 3]) b = drop(b, c, 1)!;
  assert.equal(winner(b)?.who, 1);
  // Barista takes its own win
  b = empty();
  for (const c of [0, 1, 2]) b = drop(drop(b, c, 2)!, c, 1)!;
  b = drop(b, 6, 1)!;
  assert.equal(botMove(b), 3, "wins along the bottom row");
  // ...and blocks the guests' three in a row
  b = empty();
  for (const c of [0, 1, 2]) b = drop(b, c, 1)!;
  b = drop(b, 0, 2)!; b = drop(b, 1, 2)!;
  assert.equal(botMove(b), 3, "blocks the guests' only way to four");
  const counts = Array(COLS).fill(0);
  assert.equal(topVote(counts, empty()), null, "no votes, no move");
  counts[1] = 2; counts[4] = 2;
  assert.equal(topVote(counts, empty()), 4, "a tie goes to the column nearer the middle");
});

test("guess the dish, the recipe scaler, story chain lines and places", async () => {
  const { DISH_PUZZLES, isRight, dishesFor, dishGrid } = await import("../src/lib/emojiDish.ts");
  assert.equal(new Set(DISH_PUZZLES.map((p) => p.id)).size, DISH_PUZZLES.length, "one puzzle per dish");
  assert.equal(new Set(DISH_PUZZLES.map((p) => p.emoji)).size, DISH_PUZZLES.length, "no two puzzles look the same");
  assert.ok(isRight("Cinamon roll", "Cinnamon Roll", []), "small typos are fine");
  assert.ok(isRight("chai & samosa", "Chai & Samosa Plate", ["chai and samosa"]));
  assert.ok(!isRight("latte", "Spanish Latte", ["spanish latte"]), "too vague");
  const ids = new Set(DISH_PUZZLES.map((p) => p.id));
  assert.equal(dishesFor("2026-10-25", ids).length, 5);
  assert.deepEqual(dishesFor("2026-10-25", ids), dishesFor("2026-10-25", ids));
  assert.equal(dishGrid([{ ok: true, n: 1 }, { ok: true, n: 3 }, { ok: false, n: 3 }]), "🟩🟧⬛");
  const { scaleLine, scaleMakes } = await import("../src/lib/scale.ts");
  assert.equal(scaleLine("200 ml milk", 2), "400 ml milk");
  assert.equal(scaleLine("½ lime", 3), "1½ lime");
  assert.equal(scaleLine("1 to 2 tsp honey", 0.5), "½ to 1 tsp honey");
  assert.equal(scaleLine("A pinch of salt", 4), "A pinch of salt");
  assert.equal(scaleLine("8 ice cubes", 3), "24 ice cubes");
  assert.equal(scaleMakes("1 mug", 2), "2 mugs");
  assert.equal(scaleMakes("2 cups", 0.5), "1 cup");
  const { lineProblem } = await import("../src/lib/storyChain.ts");
  assert.equal(lineProblem("She opened the cupboard anyway."), null);
  assert.ok(lineProblem("One. Two. Three. Four."), "one sentence only");
  const { placeFor, STATES } = await import("../src/lib/places.ts");
  assert.equal(STATES.length, 36, "28 states and 8 union territories");
  assert.deepEqual(placeFor("Goa"), { name: "Goa", kind: "state" });
  assert.equal(placeFor("Atlantis"), null);
});

test("doodle prompts, shout-out checks and shelter links", async () => {
  const { promptFor, DOODLE_PROMPTS } = await import("../src/lib/doodlePrompts.ts");
  assert.equal(new Set(DOODLE_PROMPTS).size, DOODLE_PROMPTS.length);
  assert.equal(promptFor("2026-10-25"), promptFor("2026-10-25"));
  const week = ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"].map(promptFor);
  assert.equal(new Set(week).size, 7, "a different prompt every day of the week");
  const { shoutProblem } = await import("../src/lib/shoutouts.ts");
  assert.equal(shoutProblem("Happy birthday, Priya! 🎂", "2026-10-26", "2026-10-25"), null);
  assert.ok(shoutProblem("Happy birthday, Priya!", "2026-10-24", "2026-10-25"), "not in the past");
  assert.ok(shoutProblem("Happy birthday, Priya!", "2027-03-01", "2026-10-25"), "not too far ahead");
  assert.ok(shoutProblem("Call me on 98765 43210", "2026-10-26", "2026-10-25"));
  const { cleanLink, petKind } = await import("../src/lib/pets.ts");
  assert.equal(cleanLink("https://shelter.example/biscuit"), "https://shelter.example/biscuit");
  assert.equal(cleanLink("javascript:alert(1)"), "");
  assert.equal(cleanLink("http://not-secure.example"), "");
  assert.equal(petKind("dragon"), "dog");
});

test("mini crossword: every grid's answers are words with clues", async () => {
  const { CROSSWORDS, entriesOf, crosswordFor, isSolved } = await import("../src/lib/crossword.ts");
  for (const x of CROSSWORDS) {
    assert.ok(x.rows.length === 5 && x.rows.every((r) => r.length === 5));
    const { entries } = entriesOf(x.rows, x.clues);
    assert.equal(entries.length, 10);
    for (const e of entries) assert.ok(e.clue, `${x.rows.join("/")}: no clue for ${e.answer}`);
    assert.equal(new Set(entries.map((e) => e.answer)).size, entries.length, "no answer twice in a grid");
    assert.equal(Object.keys(x.clues).length, entries.length, "no spare clues");
  }
  const today = crosswordFor("2026-10-25");
  assert.equal(today.entries[0].num, 1);
  assert.ok(isSolved(today.rows.join("").split("").map((c) => (c === "#" ? "" : c.toUpperCase())), today.rows));
  assert.ok(!isSolved(Array(25).fill("a"), today.rows));
});

test("pixel pictures: every picture has exactly one answer", async () => {
  const { PICTURES, cluesOf, countSolutions, isSolved, runs } = await import("../src/lib/nonogram.ts");
  assert.deepEqual(runs([true, true, false, true]), [2, 1]);
  assert.deepEqual(runs([false, false]), [0]);
  for (const mode of ["easy", "hard"] as const) for (const p of PICTURES[mode]) {
    assert.ok(p.rows.every((r) => r.length === p.rows.length) && p.rows.length === (mode === "easy" ? 5 : 10), p.name);
    const clues = cluesOf(p.rows);
    assert.equal(countSolutions(clues), 1, `${mode} ${p.name}`);
    assert.ok(isSolved(p.rows.join("").split("").map((c) => c === "#"), clues));
  }
});

test("crack the order: marks like Mastermind", async () => {
  const { feedback, validGuess, crackGrid } = await import("../src/lib/crack.ts");
  assert.deepEqual(feedback([0, 1, 2, 3], [0, 1, 2, 3]), { right: 4, near: 0 });
  assert.deepEqual(feedback([0, 1, 2, 3], [3, 2, 1, 0]), { right: 0, near: 4 });
  assert.deepEqual(feedback([0, 0, 1, 1], [0, 1, 0, 5]), { right: 1, near: 2 });
  assert.deepEqual(feedback([0, 1, 2, 3], [0, 0, 0, 0]), { right: 1, near: 0 }, "a repeat only counts once");
  assert.ok(validGuess([0, 5, 2, 2]) && !validGuess([0, 6, 1, 1]) && !validGuess([1, 2, 3]));
  assert.equal(crackGrid([{ right: 1, near: 2 }]), "✅🔄🔄▫️");
});

test("bean sweeper: first tap is safe and empty squares open their neighbours", async () => {
  const { layBeans, countsOf, reveal, isCleared, SWEEP_MODES, neighbours } = await import("../src/lib/sweeper.ts");
  for (const mode of ["easy", "hard"] as const) {
    const { w, h, beans } = SWEEP_MODES[mode];
    for (const first of [0, 17, w * h - 1]) {
      const b = layBeans("2026-10-25", mode, first);
      assert.equal(b.size, beans);
      assert.ok(![first, ...neighbours(first, w, h)].some((p) => b.has(p)), "first tap and around it are clear");
      const counts = countsOf(b, w, h);
      assert.equal(counts[first], 0);
      const opened = reveal(first, b, counts, new Set(), w, h);
      assert.ok(opened.size > 1 && [...opened].every((p) => !b.has(p)), "opens a patch, never a bean");
    }
  }
  const b = new Set([0]);
  const all = new Set([...Array(9).keys()].filter((p) => p !== 0));
  assert.ok(isCleared(all, b, 3, 3));
});

test("brew merge: tiles slide and merge once per move", async () => {
  const { slide, canMove, addTile } = await import("../src/lib/merge.ts");
  const row = (a: number[]) => [...a, ...Array(12).fill(0)];
  const r = slide(row([1, 1, 1, 1]), "left");
  assert.deepEqual(r.board.slice(0, 4), [2, 2, 0, 0]);
  assert.equal(r.gained, 8);
  assert.deepEqual(slide(row([2, 0, 2, 1]), "right").board.slice(0, 4), [0, 0, 3, 1]);
  assert.equal(slide(row([1, 2, 3, 4]), "left").moved, false);
  const col = slide([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], "down");
  assert.equal(col.board[12], 2);
  assert.ok(!canMove([1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1]));
  assert.equal(addTile(Array(16).fill(0), () => 0).filter(Boolean).length, 1);
  assert.equal(slide(row([11, 11, 0, 0]), "left").gained, 0, "the moon brew is the top");
});

test("higher or lower: pairs never tie on price", async () => {
  const { pairFrom } = await import("../src/lib/higherLower.ts");
  const items = [{ id: "a", name: "A", price: 100, img: "" }, { id: "b", name: "B", price: 100, img: "" }, { id: "c", name: "C", price: 150, img: "" }];
  for (let i = 0; i < 30; i++) { const p = pairFrom(items, Math.random)!; assert.notEqual(p[0].price, p[1].price); }
  assert.equal(pairFrom(items.slice(0, 2), Math.random), null);
});

test("word ladder: every ladder can be climbed with everyday words", async () => {
  const { LADDERS, shortest, ladderFor, stepProblem, isWord } = await import("../src/lib/wordLadder.ts");
  const { COMMON4 } = await import("../src/lib/data/words4.ts");
  for (const [a, b] of LADDERS) {
    const path = shortest(a, b);
    assert.ok(path && path.length - 1 >= 4 && path.length - 1 <= 6, `${a} → ${b}`);
    assert.ok(path.every((w) => COMMON4.includes(w)));
  }
  assert.equal(new Set(LADDERS.map((l) => l.join())).size, LADDERS.length, "no repeats");
  assert.ok(ladderFor("2026-10-25").par >= 4);
  assert.equal(stepProblem("cold", "cord", ["cold"]), null);
  assert.ok(stepProblem("cold", "cart", ["cold"]), "two letters changed");
  assert.ok(stepProblem("cold", "cold", ["cold"]));
  assert.ok(stepProblem("cold", "colx", ["cold"]), "not a word");
  assert.ok(isWord("cups") && isWord("mugs"), "plurals count");
});

test("jigsaw: trays are shuffled and pieces map to the right part of the photo", async () => {
  const { trayOrder, piecePos, photoFor, pieceCount } = await import("../src/lib/jigsaw.ts");
  const t = trayOrder(12, () => 0.5);
  assert.deepEqual([...t].sort((a, b) => a - b), [...Array(12).keys()]);
  assert.ok(t.some((v, i) => v !== i));
  assert.deepEqual(piecePos(0, "small"), { x: 0, y: 0 });
  assert.deepEqual(piecePos(11, "small"), { x: 100, y: 100 });
  assert.deepEqual(piecePos(1, "small"), { x: 50, y: 0 });
  assert.equal(pieceCount("large"), 48);
  const items = [{ id: "a", img: "/api/uploads/x.jpg" }, { id: "b", img: "1509042239860-f550ce710b93" }];
  assert.equal(photoFor("2026-10-25", items)!.id, "b", "only Unsplash photos");
  assert.equal(photoFor("2026-10-25", [items[0]]), null);
});

test("bean snake: grows when it eats, wraps at the edges, ends on its own tail", async () => {
  const { start, tick, GRID } = await import("../src/lib/snake.ts");
  const s0 = start(() => 0);
  const head = s0.body[0];
  const fed = tick({ ...s0, bean: head + 1 }, "right", () => 0);
  assert.equal(fed.score, 1);
  assert.equal(fed.body.length, 4);
  assert.equal(tick(s0, "left", () => 0).body[0], head + 1, "can't turn straight back");
  const edge = tick({ ...s0, body: [GRID - 1, GRID - 2, GRID - 3], bean: 100 }, "right", () => 0);
  assert.equal(edge.body[0], 0, "wraps around");
  const loop = { body: [16, 17, 32, 31, 30], dir: "up" as const, bean: 200, score: 5, over: false };
  assert.ok(tick(loop, "right", () => 0).over, "bumped into itself");
});

test("split the bill: shares add up exactly, shared items split evenly", async () => {
  const { splitBill, fairShares } = await import("../src/lib/split.ts");
  assert.deepEqual(fairShares(100, 3), [34, 33, 33]);
  const r = splitBill([
    { name: "Latte", price: 220, qty: 1, people: [0] },
    { name: "Cold brew", price: 240, qty: 1, people: [1] },
    { name: "Cheesecake", price: 310, qty: 1, people: [0, 1, 2] },
  ], 3, 10);
  assert.equal(r.subtotal, 770);
  assert.equal(r.tip, 77);
  assert.equal(r.shares.reduce((a, b) => a + b, 0), r.total, "adds up to the total");
  assert.equal(r.own.reduce((a, b) => a + b, 0), 770);
  assert.ok(Math.max(...r.own.map((o, i) => o - [220, 240, 0][i])) - Math.min(...r.own.map((o, i) => o - [220, 240, 0][i])) <= 1, "cheesecake split within a rupee");
  const nobody = splitBill([{ name: "Tea", price: 120, qty: 2, people: [] }], 2);
  assert.equal(nobody.unassigned, 240);
  assert.equal(nobody.total, 0);
});

test("quiz night: quick right answers score more", async () => {
  const { points, cleanName } = await import("../src/lib/quizNight.ts");
  assert.equal(points(0, 20000), 1000);
  assert.equal(points(20000, 20000), 500);
  assert.equal(points(10000, 20000), 750);
  assert.equal(points(99999, 20000), 500);
  assert.equal(cleanName("  <b>Flat   Whites</b> "), "bFlat Whites/b");
});

test("bean hive: every puzzle's words fit its letters, and ranks build up", async () => {
  const { HIVE_PUZZLES } = await import("../src/lib/data/hive.ts");
  const { puzzle, hiveFor, hiveProblem, points, rankOf, isPangram, lettersOf } = await import("../src/lib/hive.ts");
  for (const p of HIVE_PUZZLES) {
    const h = puzzle(p, "x"), letters = new Set(p.base);
    assert.equal(letters.size, 7, p.base);
    assert.equal(h.outer.length, 6);
    const all = [...h.common, ...h.bonus];
    assert.equal(new Set(all).size, all.length, `${p.base} has a repeated word`);
    for (const w of all) assert.ok(w.length >= 4 && w.includes(p.centre) && [...w].every((c) => letters.has(c)), `${p.base}: ${w}`);
    assert.ok(h.common.some((w) => isPangram(w, p.base)), `${p.base} needs a word using all seven`);
  }
  const h = hiveFor("2026-10-25"), word = h.common[0];
  assert.equal(hiveProblem(h, "abc", []), "Four letters or more.");
  assert.equal(hiveProblem(h, word, [word]), "Already found.");
  assert.equal(hiveProblem(h, word, []), null);
  assert.match(hiveProblem(h, h.outer.slice(0, 4).join(""), []) ?? "", /middle letter|word list/);
  assert.equal(points("cake", "cupcakes"), 1);
  assert.equal(points("cupcakes", "cupcakes"), 15);
  assert.equal(rankOf(0, 100), "Decaf");
  assert.equal(rankOf(100, 100), "Moon brew");
  // Sixteen days in a row never repeat a puzzle
  const seen = new Set<string>();
  for (let d = 1; d <= 16; d++) seen.add(lettersOf(hiveFor(`2026-11-${String(d).padStart(2, "0")}`)).split("").sort().join(""));
  assert.equal(seen.size, 16);
});

test("pour paths: every puzzle has a full answer, and pipes behave", async () => {
  const { pathsFor, isSolved, extend, PATH_MODES } = await import("../src/lib/pourPaths.ts");
  for (const mode of ["easy", "hard"] as const) for (let d = 1; d <= 20; d++) {
    const p = pathsFor(`2026-11-${String(d).padStart(2, "0")}`, mode);
    assert.equal(p.ends.length, PATH_MODES[mode].pairs);
    assert.ok(isSolved(p.size, p.ends, p.solution), `${mode} ${d}`);
    assert.ok(p.solution.every((s) => s.length >= 3));
  }
  const p = pathsFor("2026-10-25", "easy");
  assert.ok(!isSolved(p.size, p.ends, p.ends.map(() => [])));
  // Drawing the answer step by step through extend gets there too
  let paths = p.ends.map(() => [] as number[]);
  p.solution.forEach((s, i) => { paths = paths.map((x, k) => (k === i ? [s[0]] : x)); for (const c of s.slice(1)) paths = extend(p.size, p.ends, paths, i, c); });
  assert.ok(isSolved(p.size, p.ends, paths));
  // Can't run a pipe into someone else's cup
  const other = p.ends[1][0], before = [[p.ends[0][0]], ...p.ends.slice(1).map(() => [])];
  assert.equal(extend(p.size, p.ends, before, 0, other), before);
});

test("tea tiles: the daily deal can always be cleared, and a reshuffle keeps it clearable", async () => {
  const { tilesFor, freeSpots, hintPair, reshuffle, LAYOUT } = await import("../src/lib/teaTiles.ts");
  const { seededRand } = await import("../src/lib/gameOrders.ts");
  assert.equal(LAYOUT.length % 2, 0);
  for (let d = 1; d <= 10; d++) {
    const tiles = tilesFor(`2026-11-${String(d).padStart(2, "0")}`);
    assert.equal(tiles.length, LAYOUT.length);
    // A careful player (always taking a pair that keeps a way out) can clear it: search for one
    const solve = (left: typeof tiles, depth = 0): boolean => {
      if (!left.length) return true;
      if (depth > 40) return false;
      const free = freeSpots(left) as typeof tiles;
      for (let i = 0; i < free.length; i++) for (let k = i + 1; k < free.length; k++) {
        if (free[i].face !== free[k].face) continue;
        if (solve(left.filter((t) => t !== free[i] && t !== free[k]), depth + 1)) return true;
      }
      return false;
    };
    assert.ok(hintPair(tiles));
    if (d <= 3) assert.ok(solve(tiles), `day ${d}`);
  }
  let t = tilesFor("2026-10-25");
  for (let i = 0; i < 10; i++) { const pair = hintPair(t)!; t = t.filter((x) => !pair.includes(x)); }
  const r = reshuffle(t, seededRand("x"));
  assert.deepEqual(r.map((x) => x.id), t.map((x) => x.id));
  assert.deepEqual(r.map((x) => x.face).sort(), t.map((x) => x.face).sort());
});

test("spot the difference: five separate changes, and taps find them", async () => {
  const { sceneFor, hitDiff, DIFFS, COLS, ROWS } = await import("../src/lib/spotDiff.ts");
  for (let d = 1; d <= 30; d++) {
    const s = sceneFor(`2026-11-${String(d).padStart(2, "0")}`);
    assert.equal(s.diffs.length, DIFFS);
    assert.equal(new Set(s.diffs.map((x) => x.cell)).size, DIFFS);
    for (const x of s.diffs) {
      const a = s.left.find((i) => i.cell === x.cell), b = s.right.find((i) => i.cell === x.cell);
      assert.notDeepEqual(a, b, `day ${d}: ${x.kind} at ${x.cell} changes nothing`);
    }
    // Everything else is identical
    for (const a of s.left) if (!s.diffs.some((x) => x.cell === a.cell)) assert.deepEqual(s.right.find((i) => i.cell === a.cell), a);
  }
  const s = sceneFor("2026-10-25"), c = s.diffs[2].cell;
  assert.equal(hitDiff(s, ((c % COLS) + 0.5) / COLS, (Math.floor(c / COLS) + 0.5) / ROWS, []), 2);
  assert.equal(hitDiff(s, ((c % COLS) + 0.5) / COLS, (Math.floor(c / COLS) + 0.5) / ROWS, [2]), -1);
});

test("call the order: typing matches the oldest ticket and ignores case and commas", async () => {
  const { matchTicket, isDone, orderText, norm, travelMs } = await import("../src/lib/callOrder.ts");
  const tickets = [{ id: 2, text: "oat latte", born: 20, travel: 9000 }, { id: 1, text: "Oat latte, to go", born: 10, travel: 9000 }, { id: 3, text: "mocha", born: 30, travel: 9000 }];
  assert.equal(matchTicket(tickets, "oat l")?.id, 1);
  assert.equal(matchTicket(tickets, "MOC")?.id, 3);
  assert.equal(matchTicket(tickets, "tea"), null);
  assert.ok(isDone(tickets[1], "oat latte to go"));
  assert.ok(!isDone(tickets[1], "oat latte"));
  assert.equal(norm("  Large,  OAT latte "), "large oat latte ");
  assert.ok(!orderText(0, () => 0.5).includes(" ") || orderText(0, () => 0.5).split(" ").length <= 2);
  assert.ok(orderText(30, () => 0.5).includes(","));
  assert.ok(travelMs(100) >= 6500);
});

test("café patience: deals, moves and tap-to-move follow the rules", async () => {
  const { newGame, drawCards, autoMove, move, canStack, canFound, isWon, canFinish, finishStep } = await import("../src/lib/patience.ts");
  const { seededRand } = await import("../src/lib/gameOrders.ts");
  const g = newGame(seededRand("deal"), 1);
  assert.equal(g.stock.length, 24);
  assert.deepEqual(g.piles.map((p) => p.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(g.piles.every((p) => p[p.length - 1].up && p.slice(0, -1).every((c) => !c.up)));
  const d = drawCards(g);
  assert.equal(d.waste.length, 1); assert.equal(d.stock.length, 23);
  let x = g; for (let i = 0; i < 24; i++) x = drawCards(x);
  assert.equal(x.stock.length, 0);
  assert.equal(drawCards(x).stock.length, 24);
  assert.equal(drawCards(newGame(seededRand("deal"), 3)).waste.length, 3);
  // Colours alternate: brown (0, 2) on pink (1, 3)
  assert.ok(canStack({ suit: 0, rank: 6, up: true }, [{ suit: 1, rank: 7, up: true }]));
  assert.ok(!canStack({ suit: 2, rank: 6, up: true }, [{ suit: 0, rank: 7, up: true }]));
  assert.ok(canStack({ suit: 0, rank: 13, up: true }, []));
  assert.ok(canFound({ suit: 0, rank: 1, up: true }, []));
  assert.ok(!canFound({ suit: 0, rank: 2, up: true }, []));
  // An ace on a pile flies home when tapped, and the card under it turns over
  const ace = { ...g, piles: [[{ suit: 1, rank: 9, up: false }, { suit: 3, rank: 1, up: true }], ...g.piles.slice(1)] };
  const after = autoMove(ace, { kind: "pile", i: 0, at: 1 })!;
  assert.equal(after.found[3].length, 1);
  assert.ok(after.piles[0][0].up);
  assert.equal(move(ace, { kind: "pile", i: 0, at: 1 }, { kind: "found", i: 0 }), null);
  // Nearly won: everything face up, finish sends it all home
  const found = [0, 1, 2, 3].map((s) => [...Array(12).keys()].map((r) => ({ suit: s, rank: r + 1, up: true })));
  let end = { ...g, stock: [], waste: [], found, piles: [[{ suit: 0, rank: 13, up: true }], [{ suit: 1, rank: 13, up: true }], [{ suit: 2, rank: 13, up: true }], [{ suit: 3, rank: 13, up: true }], [], [], []] };
  assert.ok(canFinish(end));
  for (let i = 0; i < 4; i++) end = finishStep(end)!;
  assert.ok(isWon(end));
  assert.equal(finishStep(end), null);
});

test("café cryptogram: no letter stands for itself, guesses move, hints fill", async () => {
  const { cipherFor, makeKey, codeLetters, guess, isSolved, isFilled, hintLetter, decode, SAYINGS, ALPHABET } = await import("../src/lib/cryptogram.ts");
  const { seededRand } = await import("../src/lib/gameOrders.ts");
  const key = makeKey(seededRand("k"));
  assert.ok([...ALPHABET].every((c) => key[c] !== c));
  assert.equal(new Set(Object.values(key)).size, 26);
  const days = [...Array(SAYINGS.length).keys()].map((i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
  assert.equal(new Set(days.map((d) => cipherFor(d).plain)).size, SAYINGS.length, "no repeats within a cycle");
  const p = cipherFor("2026-10-25");
  assert.equal(p.code.length, p.plain.length);
  assert.equal(Object.keys(p.given).length, 1);
  // A plain letter can only be used once: putting it elsewhere moves it
  const [a, b] = codeLetters(p);
  let g = guess({}, a, "Q"); g = guess(g, b, "Q");
  assert.equal(g[a], undefined); assert.equal(g[b], "Q");
  // Locked (given) letters can't be changed
  const [given] = Object.keys(p.given);
  assert.equal(guess(p.given, given, "Z", p.given)[given], p.given[given]);
  // Fill everything in with hints and it's solved
  let all: Record<string, string> = {};
  for (let c = hintLetter(p, all); c; c = hintLetter(p, all)) all = { ...all, [c]: decode(p, c) };
  assert.ok(isFilled(p, all) && isSolved(p, all));
});

test("cake stacker: drops trim the overhang, perfect drops grow back, misses end it", async () => {
  const { drop, slide, START_W, WIDTH } = await import("../src/lib/stacker.ts");
  const base = { x: 20, w: 60 };
  const half = drop(base, { x: 50, w: 60 })!;
  assert.equal(half.x, 50); assert.equal(half.w, 30); assert.equal(half.cut, 30); assert.ok(!half.perfect);
  const perfect = drop({ x: 30, w: 40 }, { x: 31, w: 40 })!;
  assert.ok(perfect.perfect); assert.equal(perfect.w, 43);
  assert.ok(drop({ x: 20, w: START_W }, { x: 20.5, w: START_W })!.w <= START_W, "never wider than it started");
  assert.equal(drop({ x: 0, w: 20 }, { x: 40, w: 20 }), null);
  // Bounces off both edges
  const r = slide(75, 1, 20, 100, 0.1);
  assert.equal(r.dir, -1); assert.ok(r.x <= WIDTH - 20 && r.x >= 0);
  assert.equal(slide(2, -1, 20, 100, 0.05).dir, 1);
});

test("bean reversi: flips lines, passes when stuck, and the hard computer takes corners", async () => {
  const { start, legal, play, count, flips, nextTurn, bestMove } = await import("../src/lib/reversi.ts");
  const b = start();
  assert.deepEqual(legal(b, 1).sort((x, y) => x - y), [19, 26, 37, 44]);
  const after = play(b, 19, 1)!;
  assert.equal(count(after, 1), 4); assert.equal(count(after, 2), 1);
  assert.equal(play(b, 0, 1), null);
  // A corner up for grabs: hard takes it
  const c = Array(64).fill(0); c[9] = 2; c[18] = 1; c[1] = 2; c[2] = 1; c[50] = 1;
  assert.ok(flips(c, 0, 1).length > 0);
  assert.equal(bestMove(c, 1, "hard", () => 0), 0);
  // Nobody can move on a full board
  assert.equal(nextTurn(Array(64).fill(1), 2), null);
});

test("flood the cup: the patch soaks up neighbours, par finishes the board, scores pack", async () => {
  const { gridFor, flood, region, isDone, par, packScore, unpackScore, SIZE, COLOURS } = await import("../src/lib/flood.ts");
  const g = gridFor("2026-10-25");
  assert.equal(g.length, SIZE * SIZE);
  assert.equal(new Set(g).size, COLOURS.length);
  assert.deepEqual(gridFor("2026-10-25"), g);
  const other = (g[0] + 1) % COLOURS.length;
  assert.ok(region(flood(g, other)).size >= region(g).size);
  const p = par(g);
  assert.ok(p >= 5 && p < 40, `par ${p}`);
  assert.ok(isDone(Array(SIZE * SIZE).fill(2)));
  assert.ok(packScore(20, 99000) < packScore(21, 1000));
  assert.deepEqual(unpackScore(packScore(20, 4321)), { moves: 20, ms: 4321 });
});

test("lamp switch: presses flip a plus shape, and every day can be solved in the fewest taps", async () => {
  const { press, solve, lampsFor, allOff, SIZE } = await import("../src/lib/lamps.ts");
  const off = Array(SIZE * SIZE).fill(false);
  assert.equal(press(off, 12).filter(Boolean).length, 5);
  assert.equal(press(off, 0).filter(Boolean).length, 3);
  assert.ok(allOff(press(press(off, 7), 7)));
  for (let i = 0; i < 20; i++) {
    const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
    const { lit, fewest } = lampsFor(d);
    const s = solve(lit)!;
    assert.equal(s.length, fewest);
    assert.ok(allOff(s.reduce((g, k) => press(g, k), lit)), d);
  }
});

test("sink the saucers: fleets never touch, shots sink ships, the hard computer finishes faster", async () => {
  const { placeFleet, shoot, allSunk, aiShot, FLEET, SIZE } = await import("../src/lib/saucers.ts");
  const { seededRand } = await import("../src/lib/gameOrders.ts");
  const rand = seededRand("fleet");
  for (let n = 0; n < 20; n++) {
    const ships = placeFleet(rand);
    assert.deepEqual(ships.map((s) => s.cells.length), FLEET.map((f) => f.len));
    for (const [i, a] of ships.entries()) for (const b of ships.slice(i + 1)) for (const x of a.cells) for (const y of b.cells)
      assert.ok(Math.abs(Math.floor(x / SIZE) - Math.floor(y / SIZE)) > 1 || Math.abs((x % SIZE) - (y % SIZE)) > 1, "touching");
  }
  const ships = placeFleet(rand), cup = ships[4].cells;
  assert.equal(shoot(ships, [], cup[0]), "hit");
  assert.equal(shoot(ships, [cup[0]], cup[1]), "sunk");
  const avg = (lv: "easy" | "hard") => {
    let total = 0;
    for (let n = 0; n < 8; n++) { const f = placeFleet(rand), shots: number[] = []; while (!allSunk(f, shots)) shots.push(aiShot(f, shots, lv, rand)); total += shots.length; }
    return total / 8;
  };
  assert.ok(avg("hard") < avg("easy") - 10);
});

test("today's five: two word games, two puzzles and a quick one, the same all day", async () => {
  const { todaysFive, fiveDays, KINDS } = await import("../src/lib/todaysFive.ts");
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
    const f = todaysFive(d);
    assert.equal(new Set(f).size, 5);
    assert.equal(f.filter((id) => (KINDS.word as readonly string[]).includes(id)).length, 2);
    assert.equal(f.filter((id) => (KINDS.logic as readonly string[]).includes(id)).length, 2);
    assert.equal(f.filter((id) => (KINDS.quick as readonly string[]).includes(id)).length, 1);
    assert.deepEqual(todaysFive(d), f);
  }
  const d = "2026-10-25", played: Record<string, string[]> = {};
  for (const id of todaysFive(d).slice(0, 4)) played[id] = [d];
  assert.deepEqual(fiveDays(played), []);
  played[todaysFive(d)[4]] = [d];
  assert.deepEqual(fiveDays(played), [d]);
});

test("trophies: earned from plays, arcade bests, local wins and one-off moments", async () => {
  const { TROPHIES, earned, longestRun } = await import("../src/lib/trophies.ts");
  assert.equal(new Set(TROPHIES.map((t) => t.id)).size, TROPHIES.length);
  assert.ok(TROPHIES.length >= 30);
  assert.equal(longestRun(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-02"]), 3);
  const none = earned({ played: { word: [], sudoku: [] }, five: [], arcade: {}, local: {} });
  assert.deepEqual(none, []);
  const got = earned({
    played: { word: ["2026-10-01", "2026-10-02", "2026-10-03"], sudoku: ["2026-10-02"], hive: [] }, five: ["2026-10-02"],
    arcade: { stacker: 16, typing: 3 }, local: { reversi: { easy: { won: 1 }, hard: { won: 0 } }, patience: { won: 2, streak: 0, bestStreak: 3 }, flags: ["flood-under-par"] },
  });
  for (const id of ["first", "streak3", "five", "stack15", "reversi", "patience", "patience3", "underpar"]) assert.ok(got.includes(id), id);
  for (const id of ["streak7", "stack40", "typing", "reversiHard", "everything"]) assert.ok(!got.includes(id), id);
  // Tried them all / full house: every game, and all on one day
  const all = earned({ played: { word: ["2026-10-01"], sudoku: ["2026-10-01"] }, five: [], arcade: {}, local: {} });
  assert.ok(all.includes("everything") && all.includes("fullhouse"));
});

test("bean counting: sowing skips the other jar, extra turns, captures and the end sweep", async () => {
  const { start, sow, legal, bestPit, MY_STORE, AI_STORE } = await import("../src/lib/mancala.ts");
  const b = start();
  // 4 beans from cup 2 land in 3, 4, 5 and the jar: go again
  const r = sow(b, 2, 0)!;
  assert.equal(r.board[MY_STORE], 1); assert.ok(r.again); assert.equal(r.next, 0);
  assert.equal(sow(b, 8, 0), null, "not your cup");
  // Capture: last bean in your empty cup takes the beans opposite
  const c = Array(14).fill(0); c[0] = 1; c[1] = 0; c[11] = 5; c[9] = 2;
  const cap = sow(c, 0, 0)!;
  assert.equal(cap.captured, 6); assert.equal(cap.board[MY_STORE], 6); assert.equal(cap.board[11], 0);
  // Your sowing never drops a bean in the computer's jar
  const big = Array(14).fill(0); big[5] = 13; big[9] = 1;
  const lap = sow(big, 5, 0)!;
  assert.equal(lap.board[AI_STORE], 0);
  assert.equal(lap.board.reduce((a, x) => a + x, 0), 14);
  // When one side's empty, the game ends and the rest is swept up
  const end = Array(14).fill(0); end[5] = 1; end[7] = 3;
  const e = sow(end, 5, 0)!;
  assert.ok(e.over); assert.equal(e.board[AI_STORE], 3); assert.equal(e.board[MY_STORE], 1);
  assert.ok(legal(start(), 1).length === 6);
  assert.notEqual(bestPit(start(), "hard", () => 0.5), null);
});

test("café draughts: forced captures, multi-jumps, crowning and kings going backwards", async () => {
  const { start, moves, apply, bestMove, count } = await import("../src/lib/draughts.ts");
  const b = start();
  assert.equal(count(b, 1), 12); assert.equal(count(b, -1), 12);
  assert.equal(moves(b, 1).length, 7);
  // A capture is compulsory
  const c = Array(64).fill(0); c[5 * 8 + 2] = 1; c[4 * 8 + 3] = -1; c[5 * 8 + 6] = 1;
  const cm = moves(c, 1);
  assert.equal(cm.length, 1); assert.deepEqual(cm[0].caps, [4 * 8 + 3]);
  // A double jump takes both
  const d = Array(64).fill(0); d[6 * 8 + 1] = 1; d[5 * 8 + 2] = -1; d[3 * 8 + 4] = -1;
  const dm = moves(d, 1);
  assert.equal(dm[0].caps.length, 2); assert.equal(dm[0].path.length, 2);
  assert.equal(count(apply(d, dm[0]), -1), 0);
  // Reaching the far row crowns you
  const k = Array(64).fill(0); k[1 * 8 + 2] = 1;
  const km = moves(k, 1)[0];
  assert.equal(apply(k, km)[km.path[0]], 2);
  // Kings move backwards too
  const kb = Array(64).fill(0); kb[3 * 8 + 3] = 2;
  assert.equal(moves(kb, 1).length, 4);
  // Hard takes a free piece
  const f = Array(64).fill(0); f[2 * 8 + 3] = -1; f[3 * 8 + 4] = 1; f[7 * 8 + 0] = 1;
  assert.equal(bestMove(f, "hard", () => 0.5)!.caps.length, 1);
});

test("bean jumble: five words, five to nine letters, scrambled differently, no repeats for 20 days", async () => {
  const { jumbleFor, scramble, WORDS, LENGTHS, isAnswer } = await import("../src/lib/jumble.ts");
  const { seededRand } = await import("../src/lib/gameOrders.ts");
  for (const n of LENGTHS) { assert.equal(WORDS[n].length, 20); assert.ok(WORDS[n].every((w) => w.length === n && /^[a-z]+$/.test(w)), String(n)); }
  const all = Object.values(WORDS).flat();
  assert.equal(new Set(all).size, all.length);
  // No word is an anagram of another on the list
  const key = (w: string) => [...w].sort().join("");
  assert.equal(new Set(all.map(key)).size, all.length);
  const j = jumbleFor("2026-10-25");
  assert.deepEqual(j.map((x) => x.word.length), LENGTHS);
  for (const x of j) { assert.notEqual(x.letters, x.word); assert.equal(key(x.letters), key(x.word)); }
  const days = [...Array(20).keys()].map((i) => jumbleFor(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))[2].word);
  assert.equal(new Set(days).size, 20);
  assert.notEqual(scramble("latte", seededRand("x")), "latte");
  assert.ok(isAnswer(" Latte ", "latte"));
});
