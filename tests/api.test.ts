// End-to-end API tests against a real running copy of the site. Run: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, type TestServer } from "./server.ts";

let s: TestServer;
before(async () => {
  s = await startServer();
});
after(async () => {
  await s?.stop();
});

const order = (body: Record<string, unknown>) => s.api("/api/orders", { method: "POST", json: body });
const tomorrow = () => {
  const d = new Date(Date.now() + 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test("pages load", async () => {
  for (const p of ["/", "/gift-cards", "/orders", "/loyalty", "/admin", "/board", "/offline", "/manifest.webmanifest"]) {
    const r = await fetch(s.url + p);
    assert.equal(r.status, 200, p);
  }
});

test("menu is seeded and public", async () => {
  const r = await s.api("/api/menu");
  assert.equal(r.status, 200);
  assert.ok(r.body.items.length >= 20);
});

test("order prices are worked out on the server", async () => {
  const r = await order({ name: "Test", phone: "9876543210", lines: [{ itemId: "cookie", qty: 2, price: 1 }] });
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 220);
  const track = await s.api(`/api/orders/${r.body.code}`);
  assert.equal(track.body.status, "received");
  assert.equal(track.body.phone, undefined, "phone must not be public");
});

test("orders need a name, a phone and real items", async () => {
  assert.equal((await order({ phone: "9876543210", lines: [{ itemId: "cookie", qty: 1 }] })).status, 400);
  assert.equal((await order({ name: "A", phone: "123", lines: [{ itemId: "cookie", qty: 1 }] })).status, 400);
  assert.equal((await order({ name: "A", phone: "9876543210", lines: [{ itemId: "ghost", qty: 1 }] })).status, 400);
});

test("table orders don't need a phone", async () => {
  const r = await order({ name: "Table Guest", table: 4, lines: [{ itemId: "matcha", qty: 1 }] });
  assert.equal(r.status, 200);
  assert.equal((await s.api(`/api/orders/${r.body.code}`)).body.table_no, 4);
});

test("staff routes are locked", async () => {
  assert.equal((await fetch(s.url + "/api/admin/stats")).status, 401);
  assert.equal((await fetch(s.url + "/api/orders")).status, 401);
  const wrong = await fetch(s.url + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: "moonlight" }) });
  assert.equal(wrong.status, 401, "default passcode must not work when ADMIN_PASSCODE is set");
});

test("staff can move an order along and the board shows it", async () => {
  await s.login();
  const r = await order({ name: "Board Test", phone: "9000000009", lines: [{ itemId: "croissant", qty: 1 }] });
  const code = r.body.code;
  assert.equal((await s.api(`/api/orders/${code}`, { method: "PATCH", json: { status: "brewing" } })).status, 200);
  assert.ok((await s.api("/api/board")).body.preparing.some((e: { code: string }) => e.code === code));
  await s.api(`/api/orders/${code}`, { method: "PATCH", json: { status: "ready" } });
  assert.ok((await s.api("/api/board")).body.ready.some((e: { code: string }) => e.code === code));
});

test("sold-out items can't be ordered", async () => {
  await s.login();
  await s.api("/api/menu", { method: "PATCH", json: { itemId: "tiramisu", soldOut: true } });
  assert.equal((await order({ name: "A", phone: "9876543210", lines: [{ itemId: "tiramisu", qty: 1 }] })).status, 409);
  await s.api("/api/menu", { method: "PATCH", json: { itemId: "tiramisu", soldOut: false } });
  assert.equal((await order({ name: "A", phone: "9876543210", lines: [{ itemId: "tiramisu", qty: 1 }] })).status, 200);
});

test("menu editor: create, price change, hide, delete", async () => {
  await s.login();
  const created = await s.api("/api/menu", { method: "POST", json: { name: "Test Brew", cat: "coffee", price: 199, img: "1541167760496-1628856ab772" } });
  assert.equal(created.status, 200);
  const id = created.body.item.id;
  assert.equal((await order({ name: "A", phone: "9876543210", lines: [{ itemId: id, qty: 1 }] })).body.total, 199);
  await s.api("/api/menu", { method: "POST", json: { ...created.body.item, price: 249 } });
  assert.equal((await order({ name: "A", phone: "9876543210", lines: [{ itemId: id, qty: 1 }] })).body.total, 249);
  await s.api("/api/menu", { method: "POST", json: { ...created.body.item, hidden: true } });
  assert.equal((await order({ name: "A", phone: "9876543210", lines: [{ itemId: id, qty: 1 }] })).status, 400);
  assert.equal((await s.api(`/api/menu?id=${id}`, { method: "DELETE" })).status, 200);
  assert.equal((await s.api("/api/menu", { method: "POST", json: { name: "Bad", cat: "coffee", price: 99999, img: "x" } })).status, 400);
});

test("online payment (demo mode) marks the order paid", async () => {
  const r = await order({ name: "Payer", phone: "9111111111", payMethod: "online", lines: [{ itemId: "matcha", qty: 1 }] });
  assert.equal(r.body.needsPayment, true);
  const code = r.body.code;
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "order", code } })).status, 400, "no fake payments");
  assert.equal((await s.api("/api/payments/start", { method: "POST", json: { kind: "order", code } })).body.amount, 260);
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "order", code, demo: true } })).status, 200);
  assert.equal((await s.api(`/api/orders/${code}`)).body.pay_status, "paid");
});

test("gift cards: unusable until paid, balance carries over", async () => {
  const g = await s.api("/api/giftcards", { method: "POST", json: { amount: 500, fromName: "A", toName: "B", toEmail: "b@example.com" } });
  const code = g.body.code;
  assert.equal((await s.api(`/api/giftcards/${code}`)).status, 404);
  await s.api("/api/payments/verify", { method: "POST", json: { kind: "giftcard", code, demo: true } });
  assert.equal((await s.api(`/api/giftcards/${code}`)).body.balance, 500);
  const o = await order({ name: "B", phone: "9222222222", giftCard: code, lines: [{ itemId: "tiramisu", qty: 1 }] });
  assert.equal(o.body.due, 0);
  assert.equal((await s.api(`/api/giftcards/${code}`)).body.balance, 210);
});

test("loyalty: ten stamps earn a free drink", async () => {
  const phone = "9333333333";
  for (let i = 0; i < 10; i++) await order({ name: "Loyal", phone, lines: [{ itemId: "cookie", qty: 1 }] });
  assert.equal((await s.api(`/api/loyalty?phone=${phone}`)).body.hasReward, true);
  const r = await order({ name: "Loyal", phone, lines: [{ itemId: "americano", qty: 1 }, { itemId: "matcha", qty: 1 }] });
  assert.equal(r.body.usedReward, true);
  assert.equal(r.body.total, 260);
  assert.equal((await s.api(`/api/loyalty?phone=${phone}`)).body.stamps, 1);
});

test("bookings respect table limits", async () => {
  const date = tomorrow();
  const slots = (await s.api(`/api/bookings/availability?date=${date}`)).body;
  const time = slots[0].time;
  const r = await s.api("/api/bookings", { method: "POST", json: { name: "Big Group", phone: "9444444444", date, time, guests: 6 } });
  assert.equal(r.status, 200);
  const after = (await s.api(`/api/bookings/availability?date=${date}`)).body.find((x: { time: string }) => x.time === time);
  assert.equal(after.left, slots[0].left - 2);
  assert.equal((await s.api("/api/bookings", { method: "POST", json: { name: "X", phone: "9444444444", date, time: "03:00", guests: 2 } })).status, 400);
});

test("events, reviews and newsletter", async () => {
  const ev = (await s.api("/api/events")).body;
  if (ev.length) {
    assert.equal((await s.api("/api/events", { method: "POST", json: { eventId: ev[0].id, name: "A", email: "a@example.com" } })).status, 200);
    assert.equal((await s.api("/api/events", { method: "POST", json: { eventId: ev[0].id, name: "A", email: "a@example.com" } })).status, 409);
  }
  assert.equal((await s.api("/api/reviews", { method: "POST", json: { name: "A", rating: 5, text: "Lovely place!" } })).status, 200);
  assert.equal((await s.api("/api/reviews", { method: "POST", json: { name: "A", rating: 9, text: "Lovely place!" } })).status, 400);
  assert.equal((await s.api("/api/newsletter", { method: "POST", json: { email: "news@example.com" } })).status, 200);
});

test("barista demo mode recommends real menu items", async () => {
  const r = await s.api("/api/barista", { method: "POST", json: { messages: [{ role: "user", content: "something iced and sweet" }] } });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, "demo");
  const ids = new Set(((await s.api("/api/menu")).body.items as { id: string }[]).map((m) => m.id));
  assert.ok(r.body.recommendations.length > 0);
  for (const rec of r.body.recommendations) assert.ok(ids.has(rec.itemId));
});

test("QR codes, table links and push key", async () => {
  const qr = await fetch(s.url + "/api/qr/3");
  assert.equal(qr.headers.get("content-type"), "image/svg+xml");
  assert.equal((await fetch(s.url + "/api/qr/999")).status, 404);
  assert.equal((await fetch(s.url + "/t/3", { redirect: "manual" })).status, 307);
  assert.equal((await s.api("/api/push")).body.publicKey.length, 87);
});
