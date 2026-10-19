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
