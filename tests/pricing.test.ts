// Unit tests for price maths (no server needed). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, unitPrice, cleanOptions, defaultOptions, describeOptions } from "../src/lib/pricing.ts";
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
  // Bakes only accept "warm"
  assert.deepEqual(cleanOptions(cake, { size: "large", warm: true }), { warm: true });
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
