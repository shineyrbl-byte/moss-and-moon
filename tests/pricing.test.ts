// Unit tests for price maths (no server needed). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, unitPrice, cleanOptions, defaultOptions, describeOptions } from "../src/lib/pricing.ts";
import { slotsFor, openStatus } from "../src/lib/cafe.ts";
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
