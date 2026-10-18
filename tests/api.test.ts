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
  const free = ((await s.api("/api/events")).body as { id: string; price: number }[]).find((e) => !e.price);
  if (free) {
    assert.equal((await s.api("/api/events", { method: "POST", json: { eventId: free.id, name: "A", email: "a@example.com" } })).status, 200);
    assert.equal((await s.api("/api/events", { method: "POST", json: { eventId: free.id, name: "A", email: "a@example.com" } })).status, 409);
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

test("accounts: sign in with an email code", async () => {
  const email = "guest@example.com";
  const sent = await s.api("/api/account/code", { method: "POST", json: { email } });
  assert.equal(sent.status, 200);
  assert.match(sent.body.demoCode, /^\d{6}$/, "demo mode shows the code");
  const wrong = sent.body.demoCode === "000000" ? "111111" : "000000";
  assert.equal((await s.api("/api/account/verify", { method: "POST", json: { email, code: wrong } })).status, 400);
  assert.equal((await s.api("/api/account/verify", { method: "POST", json: { email, code: sent.body.demoCode } })).status, 200);

  const me = await s.api("/api/account");
  assert.equal(me.body.signedIn, true);
  assert.equal(me.body.customer.email, email);
  assert.ok(me.body.customer.referralCode);

  assert.equal((await s.api("/api/account", { method: "PATCH", json: { name: "Guest", phone: "9555555555", birthday: "02-14" } })).status, 200);
  assert.equal((await s.api("/api/account", { method: "PATCH", json: { birthday: "03-01" } })).status, 400, "birthday can only be set once");

  const o = await order({ name: "Guest", phone: "9555555555", lines: [{ itemId: "cookie", qty: 1 }] });
  const after = await s.api("/api/account");
  assert.ok(after.body.orders.some((x: { code: string }) => x.code === o.body.code));
  assert.equal(after.body.stamps.count, 1);

  await s.api("/api/account/logout", { method: "POST" });
  assert.equal((await s.api("/api/account")).body.signedIn, false);
});

test("accounts: codes expire after too many wrong tries", async () => {
  const email = "tries@example.com";
  const sent = await s.api("/api/account/code", { method: "POST", json: { email } });
  for (let i = 0; i < 5; i++) await s.api("/api/account/verify", { method: "POST", json: { email, code: "999999" === sent.body.demoCode ? "888888" : "999999" } });
  assert.equal((await s.api("/api/account/verify", { method: "POST", json: { email, code: sent.body.demoCode } })).status, 400);
});

async function signIn(email: string) {
  const sent = await s.api("/api/account/code", { method: "POST", json: { email } });
  const r = await s.api("/api/account/verify", { method: "POST", json: { email, code: sent.body.demoCode } });
  assert.equal(r.status, 200);
  return (await s.api("/api/account")).body;
}

test("live updates arrive instantly over SSE", async () => {
  await s.login();
  const o = await order({ name: "Live", phone: "9666666666", lines: [{ itemId: "cookie", qty: 1 }] });
  const ctrl = new AbortController();
  const res = await fetch(`${s.url}/api/live?topic=order&code=${o.body.code}`, { signal: ctrl.signal });
  const reader = res.body!.getReader();
  await reader.read(); // the "retry" line
  await s.api(`/api/orders/${o.body.code}`, { method: "PATCH", json: { status: "brewing" } });
  const { value } = await reader.read();
  ctrl.abort();
  assert.match(new TextDecoder().decode(value), /brewing/);
});

test("tables can call staff", async () => {
  assert.equal((await s.api("/api/tables/call", { method: "POST", json: { table: 7, reason: "water" } })).status, 200);
  await s.api("/api/tables/call", { method: "POST", json: { table: 7, reason: "water" } }); // pressed twice
  assert.equal((await s.api("/api/tables/call", { method: "POST", json: { table: 99, reason: "water" } })).status, 400);
  await s.login();
  const calls = (await s.api("/api/tables/call")).body.filter((c: { table_no: number }) => c.table_no === 7);
  assert.equal(calls.length, 1);
  await s.api("/api/tables/call", { method: "PATCH", json: { id: calls[0].id } });
  assert.equal((await s.api("/api/tables/call")).body.filter((c: { table_no: number }) => c.table_no === 7).length, 0);
});

test("tips are added and split bills settle in shares", async () => {
  const o = await order({ name: "Friends", table: 2, tipPercent: 10, lines: [{ itemId: "tiramisu", qty: 2 }, { itemId: "matcha", qty: 1 }] });
  assert.equal(o.status, 200);
  assert.equal(o.body.due, Math.round(840 * 1.1));
  const code = o.body.code;
  assert.equal((await s.api(`/api/orders/${code}/split`, { method: "POST", json: { count: 3 } })).status, 200);
  for (let i = 0; i < 3; i++) {
    const st = await s.api("/api/payments/start", { method: "POST", json: { kind: "share", code } });
    assert.equal(st.status, 200, JSON.stringify(st.body));
    await s.api("/api/payments/verify", { method: "POST", json: { kind: "share", code, shareId: st.body.shareId, demo: true } });
  }
  const after = await s.api(`/api/orders/${code}`);
  assert.equal(after.body.pay_status, "paid");
  assert.ok(after.body.paidShares >= o.body.due);
  assert.equal((await s.api("/api/payments/start", { method: "POST", json: { kind: "share", code } })).status, 409);
});

test("delivery adds a fee and needs an address", async () => {
  const noAddr = await order({ name: "D", phone: "9777777777", delivery: { address: "x" }, lines: [{ itemId: "tiramisu", qty: 1 }] });
  assert.equal(noAddr.status, 400);
  const r = await order({ name: "D", phone: "9777777777", delivery: { address: "Flat 2, Rose Apartments, Willow Lane" }, lines: [{ itemId: "tiramisu", qty: 1 }] });
  if (r.status === 400 && /opening hours/.test(r.body.error)) return; // café closed while the tests run
  assert.equal(r.status, 200);
  assert.equal(r.body.due, 290 + 40);
  const small = await order({ name: "D", phone: "9777777777", delivery: { address: "Flat 2, Rose Apartments, Willow Lane" }, lines: [{ itemId: "cookie", qty: 1 }] });
  assert.equal(small.status, 400, "minimum order for delivery");
});

test("coffee pass: one free drink a day", async () => {
  await signIn("pass@example.com");
  const p = await s.api("/api/pass", { method: "POST" });
  await s.api("/api/payments/verify", { method: "POST", json: { kind: "pass", code: p.body.code, demo: true } });
  const acc = (await s.api("/api/account")).body;
  assert.equal(acc.pass.active, true);
  const first = await order({ name: "Pass", phone: "9888888888", lines: [{ itemId: "matcha", qty: 1 }] });
  assert.equal(first.body.total, 0);
  const second = await order({ name: "Pass", phone: "9888888888", lines: [{ itemId: "matcha", qty: 1 }] });
  assert.equal(second.body.total, 260, "only one pass drink per day");
  await s.api("/api/account/logout", { method: "POST" });
});

test("invite a friend: both get credit", async () => {
  const a = await signIn("inviter@example.com");
  const inviteCode = a.customer.referralCode;
  await s.api("/api/account/logout", { method: "POST" });

  await signIn("newfriend@example.com");
  assert.equal((await s.api("/api/account/referral", { method: "POST", json: { code: "NOPE123" } })).status, 404);
  assert.equal((await s.api("/api/account/referral", { method: "POST", json: { code: inviteCode } })).body.credit, 100);
  assert.equal((await s.api("/api/account/referral", { method: "POST", json: { code: inviteCode } })).status, 409, "only once");
  const o = await order({ name: "Friend", phone: "9123456780", lines: [{ itemId: "tiramisu", qty: 1 }] });
  assert.equal(o.body.total, 290);
  assert.equal(o.body.due, 190, "₹100 credit used");
  await s.api("/api/account/logout", { method: "POST" });

  const inviterNow = await signIn("inviter@example.com");
  assert.equal(inviterNow.customer.credit, 100);
  await s.api("/api/account/logout", { method: "POST" });
});

test("waitlist: a cancelled booking frees a spot", async () => {
  const date = tomorrow();
  const slots = (await s.api(`/api/bookings/availability?date=${date}`)).body;
  const time = slots[slots.length - 1].time;
  let last = "";
  for (let i = 0; i < 6; i++) {
    const b = await s.api("/api/bookings", { method: "POST", json: { name: `Full ${i}`, phone: "9000000001", date, time, guests: 2 } });
    if (b.status === 200) last = b.body.code;
  }
  assert.equal((await s.api("/api/bookings", { method: "POST", json: { name: "Late", phone: "9000000002", date, time, guests: 2 } })).status, 409);
  const w = await s.api("/api/waitlist", { method: "POST", json: { name: "Late", phone: "9000000002", email: "late@example.com", date, time, guests: 2 } });
  assert.equal(w.body.position, 1);
  await s.login();
  await s.api("/api/bookings", { method: "PATCH", json: { code: last, status: "cancelled" } });
  const waiting = (await s.api("/api/waitlist")).body.filter((x: { time: string; date: string }) => x.date === date && x.time === time);
  assert.equal(waiting.length, 0, "first in line was offered the table");
  const emails = (await s.api("/api/admin/emails")).body.emails;
  assert.ok(emails.some((e: { to_email: string; subject: string }) => e.to_email === "late@example.com" && /table just opened/i.test(e.subject)));
});

test("staff roles: baristas run the counter, owners see the money", async () => {
  await s.login(); // owner
  assert.equal((await s.api("/api/admin/staff", { method: "POST", json: { name: "Riya", username: "riya", password: "short", role: "barista" } })).status, 400);
  assert.equal((await s.api("/api/admin/staff", { method: "POST", json: { name: "Riya", username: "riya", password: "latte-art-1", role: "barista" } })).status, 200);
  assert.equal((await s.api("/api/admin/staff", { method: "POST", json: { name: "Riya 2", username: "riya", password: "latte-art-1" } })).status, 409);

  assert.equal((await s.api("/api/admin/login", { method: "POST", json: { username: "riya", password: "wrong-pass" } })).status, 401);
  const r = await s.api("/api/admin/login", { method: "POST", json: { username: "riya", password: "latte-art-1" } });
  assert.equal(r.body.staff.role, "barista");
  assert.equal((await s.api("/api/admin/me")).body.name, "Riya");
  assert.equal((await s.api("/api/orders?active=1")).status, 200, "baristas see the queue");
  assert.equal((await s.api("/api/admin/stats")).status, 403, "but not the money");
  assert.equal((await s.api("/api/admin/analytics")).status, 403);
  assert.equal((await s.api("/api/admin/emails")).status, 403);
  assert.equal((await s.api("/api/menu", { method: "POST", json: { name: "Sneaky", cat: "coffee", price: 1, img: "abc" } })).status, 403);
  assert.equal((await s.api("/api/menu", { method: "PATCH", json: { itemId: "donut", soldOut: true } })).status, 200, "stock switch is fine");
  await s.api("/api/menu", { method: "PATCH", json: { itemId: "donut", soldOut: false } });

  // Owner switches Riya off: her session stops working straight away
  await s.login();
  const team = (await s.api("/api/admin/staff")).body;
  const riya = team.find((m: { username: string }) => m.username === "riya");
  await s.api("/api/admin/staff", { method: "PATCH", json: { id: riya.id, active: false } });
  assert.equal((await s.api("/api/admin/login", { method: "POST", json: { username: "riya", password: "latte-art-1" } })).status, 401);
});

test("analytics add up", async () => {
  await s.login();
  const a = await s.api("/api/admin/analytics?days=7");
  assert.equal(a.status, 200);
  assert.ok(a.body.orders > 0);
  assert.equal(a.body.heat.length, 7);
  assert.equal(a.body.heat.flat().reduce((x: number, y: number) => x + y, 0), a.body.orders);
  const ch = a.body.channels;
  assert.equal(ch.pickup.orders + ch.table.orders + ch.delivery.orders, a.body.orders);
});

test("stock: running out of oat milk blocks oat drinks; no beans sells out coffee", async () => {
  await s.login();
  await s.api("/api/admin/stock", { method: "PATCH", json: { id: "milk-oat", qty: 0 } });
  const oat = await order({ name: "Oaty", phone: "9012345678", lines: [{ itemId: "cappuccino", qty: 1, opts: { milk: "oat" } }] });
  assert.equal(oat.status, 409);
  assert.match(oat.body.error, /oat milk/);
  assert.equal((await order({ name: "Whole", phone: "9012345678", lines: [{ itemId: "cappuccino", qty: 1 }] })).status, 200, "whole milk still fine");
  await s.api("/api/admin/stock", { method: "PATCH", json: { id: "milk-oat", add: 5000 } });

  const before = (await s.api("/api/admin/stock")).body.find((i: { id: string }) => i.id === "espresso-beans").qty;
  await s.api("/api/admin/stock", { method: "PATCH", json: { id: "espresso-beans", qty: 10 } });
  const menu = (await s.api("/api/menu")).body.items;
  assert.equal(menu.find((m: { id: string }) => m.id === "cappuccino").soldOut, true, "auto sold out");
  assert.equal(menu.find((m: { id: string }) => m.id === "matcha").soldOut, false, "matcha doesn't need beans");
  await s.api("/api/admin/stock", { method: "PATCH", json: { id: "espresso-beans", qty: before } });
});

test("seasonal items only show in season", async () => {
  await s.login();
  const past = await s.api("/api/menu", { method: "POST", json: { name: "Pumpkin Latte", cat: "coffee", price: 260, img: "1541167760496-1628856ab772", from: "2020-10-01", until: "2020-11-30" } });
  assert.equal(past.status, 200);
  assert.equal((await s.api("/api/menu")).body.items.some((m: { id: string }) => m.id === past.body.item.id), false);
  assert.equal((await order({ name: "A", phone: "9876543210", lines: [{ itemId: past.body.item.id, qty: 1 }] })).status, 400);
  assert.equal((await s.api("/api/menu", { method: "POST", json: { name: "Backwards", cat: "coffee", price: 1, img: "abc", from: "2030-02-01", until: "2030-01-01" } })).status, 400);
});

test("owner can switch the demo barista on and off", async () => {
  await s.login();
  assert.equal((await s.api("/api/admin/settings")).body.demoBarista, false, "tests start with it off");
  const on = await s.api("/api/admin/settings", { method: "PATCH", json: { demoBarista: true } });
  assert.equal(on.body.demoBarista, true);
  const off = await s.api("/api/admin/settings", { method: "PATCH", json: { demoBarista: false } });
  assert.equal(off.body.demoBarista, false);
});

test("group orders: friends add drinks, host checks out, each pays their part", async () => {
  const g = await s.api("/api/groups", { method: "POST", json: { name: "Asha" } });
  assert.equal(g.status, 200);
  const { code, hostToken } = g.body as { code: string; hostToken: string };
  assert.match(code, /^GR-/);

  assert.equal((await s.api(`/api/groups/${code}/items`, { method: "POST", json: { person: "Asha", lines: [{ itemId: "cookie", qty: 2 }] } })).status, 200);
  const added = await s.api(`/api/groups/${code}/items`, { method: "POST", json: { person: "Ravi", lines: [{ itemId: "cookie", qty: 1 }, { itemId: "nope", qty: 1 }] } });
  assert.equal(added.status, 200);
  const sum = added.body as { people: { person: string; subtotal: number; items: { id: number }[] }[]; subtotal: number };
  assert.equal(sum.people.length, 2);
  assert.equal(sum.people[0].subtotal, sum.people[1].subtotal * 2, "unknown items are skipped");

  // Ravi can't remove Asha's item, but the host can remove anything
  const ashaItem = sum.people[0].items[0].id;
  assert.equal((await s.api(`/api/groups/${code}/items`, { method: "DELETE", json: { id: ashaItem, person: "Ravi" } })).status, 403);

  // Only the host can check out
  const order = { name: "Asha", phone: "9123456780", lines: [{ itemId: "cookie", qty: 3 }], groupCode: code };
  assert.equal((await s.api("/api/orders", { method: "POST", json: { ...order, hostToken: "wrong-token-123" } })).status, 403);
  const placed = await s.api("/api/orders", { method: "POST", json: { ...order, hostToken } });
  assert.equal(placed.status, 200);
  const orderCode = (placed.body as { code: string }).code;

  const after = (await s.api(`/api/groups/${code}`)).body as { status: string; orderCode: string; due: number; people: { person: string; share: number }[] };
  assert.equal(after.status, "placed");
  assert.equal(after.orderCode, orderCode);
  assert.ok(after.people.reduce((t, p) => t + p.share, 0) >= after.due, "shares cover the bill");
  assert.equal((await s.api(`/api/groups/${code}/items`, { method: "POST", json: { person: "Late", lines: [{ itemId: "cookie", qty: 1 }] } })).status, 409);

  // Ravi pays exactly his part (demo payments)
  const ravi = after.people.find((p) => p.person === "Ravi")!;
  const start = await s.api("/api/payments/start", { method: "POST", json: { kind: "share", code: orderCode, person: "Ravi" } });
  assert.equal(start.status, 200);
  assert.equal((start.body as { amount: number }).amount, ravi.share);
  const shareId = (start.body as { shareId: number }).shareId;
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "share", code: orderCode, shareId, demo: true } })).status, 200);
  const paid = (await s.api(`/api/groups/${code}`)).body as { people: { person: string; paid: number }[] };
  assert.equal(paid.people.find((p) => p.person === "Ravi")!.paid, ravi.share);
  assert.equal((await s.api("/api/payments/start", { method: "POST", json: { kind: "share", code: orderCode, person: "Ravi" } })).status, 409, "can't pay twice");
});

test("busy meter reports a level and today's forecast", async () => {
  const r = await s.api("/api/busy");
  assert.equal(r.status, 200);
  const b = r.body as { open: boolean; level: string | null; forecast: { hour: number }[] };
  assert.ok(b.forecast.length > 5);
  if (b.open) assert.ok(["quiet", "cosy", "packed"].includes(String(b.level)));
  else assert.equal(b.level, null);
});

test("my usual: the drink you order most, how you like it", async () => {
  const codes: string[] = [];
  const place = async (lines: unknown[]) => {
    const r = await s.api("/api/orders", { method: "POST", json: { name: "Usual", phone: "9000011111", lines } });
    codes.push((r.body as { code: string }).code);
  };
  await place([{ itemId: "rose-latte", qty: 1, opts: { milk: "oat", temp: "iced" } }, { itemId: "cookie", qty: 1 }]);
  await place([{ itemId: "rose-latte", qty: 2, opts: { milk: "oat", temp: "iced" } }]);
  await place([{ itemId: "chai", qty: 1 }]);
  const r = await s.api(`/api/usual?codes=${codes.join(",")}`);
  const u = (r.body as { usual: { itemId: string; opts: { milk: string; temp: string }; orders: number } }).usual;
  assert.equal(u.itemId, "rose-latte");
  assert.equal(u.opts.milk, "oat");
  assert.equal(u.opts.temp, "iced");
  assert.equal(u.orders, 2);
  assert.equal(((await s.api("/api/usual")).body as { usual: null }).usual, null, "no history, no usual");
});

test("seasonal drinks appear only in their season", async () => {
  await s.login();
  const ids = async () => ((await s.api("/api/menu")).body as { items: { id: string }[] }).items.map((m) => m.id);
  assert.equal((await s.api("/api/admin/settings", { method: "PATCH", json: { season: "off" } })).status, 200);
  assert.ok(!(await ids()).includes("gingerbread-latte"));
  await s.api("/api/admin/settings", { method: "PATCH", json: { season: "christmas" } });
  const xmas = await ids();
  assert.ok(xmas.includes("gingerbread-latte"));
  assert.ok(!xmas.includes("saffron-pista-latte"), "other festivals stay hidden");
  assert.equal((await s.api("/api/admin/settings", { method: "PATCH", json: { season: "summer" } })).status, 400);
  await s.api("/api/admin/settings", { method: "PATCH", json: { season: "auto" } });
});

test("paid event tickets: reserve, pay, check in once", async () => {
  const ev = ((await s.api("/api/events")).body as { id: string; price: number; spotsLeft: number }[]).find((e) => e.price > 0)!;
  assert.ok(ev, "there is a paid event");
  assert.equal((await s.api("/api/events", { method: "POST", json: { eventId: ev.id, name: "A", email: "a@example.com" } })).status, 400, "paid events need a ticket");
  assert.equal((await s.api("/api/tickets", { method: "POST", json: { eventId: ev.id, name: "Tara", email: "tara@example.com", qty: 9 } })).status, 400);
  const r = await s.api("/api/tickets", { method: "POST", json: { eventId: ev.id, name: "Tara", email: "tara@example.com", qty: 2 } });
  assert.equal(r.status, 200);
  const { code, amount } = r.body as { code: string; amount: number };
  assert.equal(amount, ev.price * 2);
  // Held seats count straight away
  const after = ((await s.api("/api/events")).body as { id: string; spotsLeft: number }[]).find((e) => e.id === ev.id)!;
  assert.equal(after.spotsLeft, ev.spotsLeft - 2);

  const start = await s.api("/api/payments/start", { method: "POST", json: { kind: "ticket", code } });
  assert.equal((start.body as { amount: number }).amount, amount, "price comes from the server");
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "ticket", code, demo: true } })).status, 200);
  const t = (await s.api(`/api/tickets/${code}`)).body as { paid: boolean; checkedIn: boolean; email?: string };
  assert.equal(t.paid, true);
  assert.equal(t.email, undefined, "email stays private");
  assert.equal((await s.api(`/api/tickets/${code}/qr`)).status, 200);

  await s.login();
  assert.equal((await s.api(`/api/tickets/${code}`, { method: "PATCH" })).status, 200);
  assert.equal((await s.api(`/api/tickets/${code}`, { method: "PATCH" })).status, 409, "only once");
});

test("nightly summary: owner email settings, preview and send", async () => {
  await s.login();
  assert.equal((await s.api("/api/admin/settings", { method: "PATCH", json: { ownerEmail: "not-an-email" } })).status, 400);
  const set = await s.api("/api/admin/settings", { method: "PATCH", json: { ownerEmail: "owner@example.com", dailySummary: true } });
  assert.equal((set.body as { ownerEmail: string }).ownerEmail, "owner@example.com");
  const p = await s.api("/api/admin/summary");
  assert.equal(p.status, 200);
  assert.match((p.body as { subject: string }).subject, /orders/);
  assert.equal((await s.api("/api/admin/summary", { method: "POST" })).status, 200);
  const mail = (await s.api("/api/admin/emails")).body as { emails: { to_email: string; subject: string }[] };
  assert.ok(mail.emails.some((e) => e.to_email === "owner@example.com" && /Today at Moss/.test(e.subject)), "summary lands in the outbox");
});

test("refunds: owner refunds part, then the rest, never more than was paid", async () => {
  const placed = await s.api("/api/orders", { method: "POST", json: { name: "Refund", phone: "9000022222", payMethod: "online", lines: [{ itemId: "cookie", qty: 3 }] } });
  const { code, due } = placed.body as { code: string; due: number };
  await s.api("/api/payments/start", { method: "POST", json: { kind: "order", code } });
  await s.api("/api/payments/verify", { method: "POST", json: { kind: "order", code, demo: true } });

  const counter = await s.api("/api/orders", { method: "POST", json: { name: "Cash", phone: "9000033333", payMethod: "counter", lines: [{ itemId: "cookie", qty: 1 }] } });
  const refund = (c: string, json: unknown) => s.api(`/api/orders/${c}/refund`, { method: "POST", json });

  const anon = await fetch(`${s.url}/api/orders/${code}/refund`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(anon.status, 401, "owners only");
  await s.login();
  assert.equal((await refund((counter.body as { code: string }).code, {})).status, 409, "counter payments are refunded in cash");
  assert.equal((await refund(code, { amount: due + 1 })).status, 400);
  const part = await refund(code, { amount: 50, reason: "Cookie was cold" });
  assert.equal(part.status, 200);
  assert.equal((part.body as { left: number }).left, due - 50);
  const rest = await refund(code, {});
  assert.equal((rest.body as { refunded: number }).refunded, due - 50);
  assert.equal((await refund(code, {})).status, 409, "nothing left to refund");
  const o = (await s.api(`/api/orders/${code}`)).body as { pay_status: string; refund_amount: number };
  assert.equal(o.pay_status, "refunded");
  assert.equal(o.refund_amount, due);
});

test("receipts: PDF download and an email when the order is collected", async () => {
  const placed = await s.api("/api/orders", { method: "POST", json: { name: "Receipt", phone: "9000044444", email: "receipt@example.com", lines: [{ itemId: "rose-latte", qty: 1, opts: { milk: "oat" } }, { itemId: "cookie", qty: 2 }] } });
  const code = (placed.body as { code: string }).code;
  const pdf = await fetch(`${s.url}/api/orders/${code}/receipt`);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
  await s.login();
  await s.api(`/api/orders/${code}`, { method: "PATCH", json: { status: "collected" } });
  await new Promise((r) => setTimeout(r, 300));
  const mail = (await s.api("/api/admin/emails")).body as { emails: { to_email: string; subject: string }[] };
  assert.ok(mail.emails.some((e) => e.to_email === "receipt@example.com" && e.subject.includes("receipt")), "receipt email sent");
});

test("rota: owner plans shifts, no double-booking, baristas see their next shift", async () => {
  await s.login();
  await s.api("/api/admin/staff", { method: "POST", json: { name: "Mira", username: "mira", password: "steam-wand-9", role: "barista" } });
  const rota = (await s.api("/api/admin/shifts")).body as { team: { id: number; name: string }[]; days: string[] };
  const mira = rota.team.find((t) => t.name === "Mira")!;
  const day = rota.days[6];
  assert.equal((await s.api("/api/admin/shifts", { method: "POST", json: { staffId: mira.id, day, start: "13:00", end: "09:00" } })).status, 400);
  assert.equal((await s.api("/api/admin/shifts", { method: "POST", json: { staffId: mira.id, day, start: "07:00", end: "13:00" } })).status, 200);
  assert.equal((await s.api("/api/admin/shifts", { method: "POST", json: { staffId: mira.id, day, start: "12:00", end: "16:00" } })).status, 409, "no overlaps");
  const week = (await s.api(`/api/admin/shifts?week=${day}`)).body as { shifts: { name: string; start: string }[] };
  assert.ok(week.shifts.some((x) => x.name === "Mira" && x.start === "07:00"));
});

test("backups: back up, download, restore (and reject junk)", async () => {
  await s.login();
  const before = await s.api("/api/orders", { method: "POST", json: { name: "Kept", phone: "9000055555", lines: [{ itemId: "cookie", qty: 1 }] } });
  const kept = (before.body as { code: string }).code;
  assert.equal((await s.api("/api/admin/backup", { method: "POST" })).status, 200);
  const list = (await s.api("/api/admin/backup")).body as { backups: { name: string }[] };
  assert.ok(list.backups.length >= 1);

  const cookie = s.cookie();
  const file = await fetch(`${s.url}/api/admin/backup?file=${encodeURIComponent(list.backups[0].name)}`, { headers: { cookie } });
  const bytes = Buffer.from(await file.arrayBuffer());
  assert.equal(bytes[0], 0x1f, "gzipped");

  const after = await s.api("/api/orders", { method: "POST", json: { name: "Gone", phone: "9000066666", lines: [{ itemId: "cookie", qty: 1 }] } });
  const gone = (after.body as { code: string }).code;

  const junk = await fetch(`${s.url}/api/admin/backup`, { method: "PUT", headers: { cookie }, body: Buffer.from("not a database") });
  assert.equal(junk.status, 400);
  const restored = await fetch(`${s.url}/api/admin/backup`, { method: "PUT", headers: { cookie }, body: bytes });
  assert.equal(restored.status, 200);

  assert.equal((await s.api(`/api/orders/${kept}`)).status, 200, "data from the backup is back");
  assert.equal((await s.api(`/api/orders/${gone}`)).status, 404, "later data is replaced");
  const again = (await s.api("/api/admin/backup")).body as { backups: { name: string }[] };
  assert.ok(again.backups.some((b) => b.name.includes("before-restore")), "a safety copy was made first");
});

test("error alerts: browser errors are logged, grouped and emailed to the owner once", async () => {
  await s.login();
  await s.api("/api/admin/settings", { method: "PATCH", json: { ownerEmail: "owner@example.com", errorAlerts: true } });
  assert.equal((await s.api("/api/health")).status, 200);
  const report = (message: string) => s.api("/api/errors", { method: "POST", json: { message, stack: "at Menu (menu.js:1)", url: "/" } });
  await report("Cannot read properties of undefined (reading 'price') 123");
  await report("Cannot read properties of undefined (reading 'price') 456");
  await report("ResizeObserver loop limit exceeded"); // browser noise, ignored
  await new Promise((r) => setTimeout(r, 300));
  const list = (await s.api("/api/errors")).body as { errors: { source: string; message: string; count: number }[] };
  const ours = list.errors.filter((e) => e.source === "browser");
  assert.equal(ours.length, 1, "same problem is grouped");
  assert.equal(ours[0].count, 2);
  const mail = (await s.api("/api/admin/emails")).body as { emails: { to_email: string; subject: string }[] };
  assert.equal(mail.emails.filter((e) => e.subject.includes("Something went wrong")).length, 1, "only one alert email");
  assert.equal((await s.api("/api/errors", { method: "DELETE" })).status, 200);
  assert.equal(((await s.api("/api/errors")).body as { errors: unknown[] }).errors.length, 0);
});

test("promo codes: owner creates them, limits and dates are enforced", async () => {
  await s.login();
  assert.equal((await s.api("/api/promo", { method: "POST", json: { code: "bloom10" } })).status, 200, "starting codes still work");
  assert.equal((await s.api("/api/admin/promos", { method: "POST", json: { code: "x", kind: "percent", value: 10 } })).status, 400);
  assert.equal((await s.api("/api/admin/promos", { method: "POST", json: { code: "TWICE", kind: "amount", value: 30, maxUses: 1 } })).status, 200);
  const old = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  await s.api("/api/admin/promos", { method: "POST", json: { code: "OLDCODE", kind: "percent", value: 20, expires: old } });

  const order = (promo: string, phone = "9000077777") => s.api("/api/orders", { method: "POST", json: { name: "Promo", phone, promo, lines: [{ itemId: "cookie", qty: 2 }] } });
  const first = await order("TWICE");
  assert.equal(first.status, 200);
  assert.equal((first.body as { total: number }).total, 220 - 30);
  assert.equal((await order("TWICE")).status, 400, "used up");
  assert.equal((await order("OLDCODE")).status, 400, "expired");
  assert.equal((await order("FIRSTSIP", "9000088888")).status, 200);
  const again = await s.api("/api/promo", { method: "POST", json: { code: "FIRSTSIP", phone: "9000088888" } });
  assert.equal(again.status, 404, "once per guest");

  await s.api("/api/admin/promos", { method: "PATCH", json: { code: "BLOOM10", active: false } });
  assert.equal((await s.api("/api/promo", { method: "POST", json: { code: "BLOOM10" } })).status, 404, "switched off");
  await s.api("/api/admin/promos", { method: "PATCH", json: { code: "BLOOM10", active: true } });
  const list = (await s.api("/api/admin/promos")).body as { code: string; uses: number }[];
  assert.equal(list.find((p) => p.code === "TWICE")!.uses, 1);
});

test("buy a friend a coffee: pay once, claim once, straight into the queue", async () => {
  assert.equal((await s.api("/api/drink-gifts", { method: "POST", json: { itemId: "cookie", fromName: "A", toName: "B" } })).status, 400, "drinks only");
  const r = await s.api("/api/drink-gifts", { method: "POST", json: { itemId: "rose-latte", opts: { milk: "oat", size: "large" }, fromName: "Asha", toName: "Ravi", toEmail: "ravi@example.com", message: "For Monday" } });
  assert.equal(r.status, 200);
  const { code, amount } = r.body as { code: string; amount: number };
  assert.equal(amount, 250 + 30 + 40, "price includes oat milk and large");
  assert.equal((await s.api(`/api/drink-gifts/${code}/redeem`, { method: "POST", json: {} })).status, 404, "unpaid gifts can't be claimed");
  await s.api("/api/payments/start", { method: "POST", json: { kind: "drinkgift", code } });
  await s.api("/api/payments/verify", { method: "POST", json: { kind: "drinkgift", code, demo: true } });

  const g = (await s.api(`/api/drink-gifts/${code}`)).body as { paid: boolean; fromName: string; to_email?: string };
  assert.equal(g.paid, true);
  assert.equal(g.to_email, undefined, "emails stay private");
  const claim = await s.api(`/api/drink-gifts/${code}/redeem`, { method: "POST", json: { name: "Ravi" } });
  assert.equal(claim.status, 200);
  const orderCode = (claim.body as { orderCode: string }).orderCode;
  const o = (await s.api(`/api/orders/${orderCode}`)).body as { pay_status: string; lines: { name: string; opts: { milk: string } }[] };
  assert.equal(o.pay_status, "paid");
  assert.equal(o.lines[0].opts.milk, "oat");
  assert.equal((await s.api(`/api/drink-gifts/${code}/redeem`, { method: "POST", json: {} })).status, 409, "only once");
  await s.login();
  const mail = (await s.api("/api/admin/emails")).body as { emails: { to_email: string }[] };
  assert.ok(mail.emails.some((e) => e.to_email === "ravi@example.com"), "friend got an email");
});

test("reviews from a visit are verified, once per order; insights work without AI", async () => {
  const placed = await s.api("/api/orders", { method: "POST", json: { name: "Rev", phone: "9000099999", email: "rev@example.com", lines: [{ itemId: "cookie", qty: 1 }] } });
  const code = (placed.body as { code: string }).code;
  const review = (rating: number) => s.api("/api/reviews", { method: "POST", json: { name: "Rev", rating, text: "Lovely cookie, warm and gooey", orderCode: code } });
  assert.equal((await review(5)).status, 200);
  assert.equal((await review(4)).status, 409, "once per visit");
  const list = (await s.api("/api/reviews")).body as { reviews: { name: string; verified: number }[] };
  assert.ok(list.reviews.some((r) => r.name === "Rev" && r.verified));

  await s.login();
  const rv = await s.api("/api/admin/insights?kind=reviews", { method: "POST" });
  assert.equal(rv.status, 200);
  assert.equal((rv.body as { provider: string }).provider, "simple", "no AI key in tests");
  assert.ok((rv.body as { data: { count: number } }).data.count >= 1);
  const biz = await s.api("/api/admin/insights?kind=business", { method: "POST" });
  assert.equal(biz.status, 200);
  assert.ok((biz.body as { data: { suggestions: unknown[] } }).data.suggestions.length >= 1);
  assert.equal((await s.api("/api/admin/insights?kind=business", { method: "POST" })).status, 429, "not too often");
});

test("profit: costs are saved with each order and add up", async () => {
  await s.login();
  await s.api("/api/admin/stock", { method: "PATCH", json: { id: "espresso-beans", cost: 2 } });
  const placed = await s.api("/api/orders", { method: "POST", json: { name: "Profit", phone: "9000012121", lines: [{ itemId: "americano", qty: 2 }] } });
  assert.equal(placed.status, 200);
  const code = (placed.body as { code: string }).code;
  const saved = (await s.api(`/api/orders/${code}`)).body as { lines: { cost: number }[] };
  assert.equal(saved.lines[0].cost, 84, "18 g of beans at ₹2/g + ₹6 cup = ₹42 a cup, × 2");
  const rep = (await s.api("/api/admin/profit?days=7")).body as { revenue: number; cost: number; profit: number; items: { name: string; cost: number; qty: number }[] };
  assert.ok(rep.items.find((i) => i.name === "Long Black")!.qty >= 2);
  assert.equal(rep.profit, rep.revenue - rep.cost - ((rep as unknown as { waste: number }).waste ?? 0));
  assert.equal((await s.api("/api/admin/stock", { method: "PATCH", json: { id: "espresso-beans", cost: -1 } })).status, 400);
});

test("waste log: staff log leftovers, see the cost and tomorrow's bake plan", async () => {
  await s.login();
  assert.equal((await s.api("/api/admin/waste", { method: "POST", json: { entries: [{ itemId: "croissant", qty: 0 }] } })).status, 400);
  const r = await s.api("/api/admin/waste", { method: "POST", json: { entries: [{ itemId: "croissant", qty: 3, reason: "leftover" }, { itemId: "nope", qty: 2 }] } });
  assert.equal((r.body as { logged: number }).logged, 1);
  const d = (await s.api("/api/admin/waste")).body as { entries: { id: number; item_name: string; qty: number; cost: number }[]; plan: { itemId: string }[] };
  const e = d.entries.find((x) => x.item_name === "Butter Croissant")!;
  assert.equal(e.qty, 3);
  assert.ok(Math.abs(e.cost - 3 * 150 * 0.35) < 0.01, "no cost set, so 35% of the price");
  assert.ok(d.plan.some((p) => p.itemId === "croissant"));
  assert.equal((await s.api("/api/admin/waste", { method: "DELETE", json: { id: e.id } })).status, 200);
});

test("badges: a signed-in guest earns them as they order", async () => {
  const email = "badges@example.com";
  const sent = await s.api("/api/account/code", { method: "POST", json: { email } });
  await s.api("/api/account/verify", { method: "POST", json: { email, code: (sent.body as { demoCode: string }).demoCode } });
  const first = await s.api("/api/orders", { method: "POST", json: { name: "Badger", phone: "9000013131", lines: [{ itemId: "matcha", qty: 1 }] } });
  const got = (first.body as { newBadges: { id: string }[] }).newBadges.map((b) => b.id);
  assert.ok(got.includes("first-sip"), "first order earns First sip");
  const second = await s.api("/api/orders", { method: "POST", json: { name: "Badger", phone: "9000013131", lines: [{ itemId: "matcha", qty: 1 }] } });
  assert.ok(!(second.body as { newBadges: { id: string }[] }).newBadges.some((b) => b.id === "first-sip"), "only announced once");
  const b = (await s.api("/api/account/badges")).body as { badges: { id: string; earned: boolean }[]; streak: { current: number } };
  assert.equal(b.streak.current, 1);
  assert.ok(b.badges.find((x) => x.id === "first-sip")!.earned);
  await s.api("/api/account/logout", { method: "POST" });
});

test("regular orders: set up, skip, pause, and they place themselves", async () => {
  const email = "regular@example.com";
  const sent = await s.api("/api/account/code", { method: "POST", json: { email } });
  await s.api("/api/account/verify", { method: "POST", json: { email, code: (sent.body as { demoCode: string }).demoCode } });
  await s.api("/api/account", { method: "PATCH", json: { name: "Reg", phone: "9000014141" } });
  const lines = [{ itemId: "rose-latte", qty: 1, opts: { milk: "oat" } }];
  assert.equal((await s.api("/api/account/schedules", { method: "POST", json: { lines, days: [0], time: "21:00" } })).status, 400, "closed on Sunday evening");
  assert.equal((await s.api("/api/account/schedules", { method: "POST", json: { lines, days: [], time: "08:30" } })).status, 400);

  // Pickup at the next quarter hour today, so the job places it straight away (only while the café is open)
  const now = new Date();
  const t = new Date(Math.ceil((now.getTime() + 60_000) / (15 * 60_000)) * 15 * 60_000);
  const time = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  const made = await s.api("/api/account/schedules", { method: "POST", json: { lines, days: [now.getDay()], time } });
  if (made.status === 200 && t.getDate() === now.getDate() && (t.getTime() - now.getTime()) / 60_000 <= 15) {
    let list: { id: number; lastOrder: string | null; summary: string }[] = [];
    for (let i = 0; i < 30 && !list[0]?.lastOrder; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      list = (await s.api("/api/account/schedules")).body;
    }
    assert.match(String(list[0].lastOrder), /^MM-/, "placed by itself");
    assert.match(list[0].summary, /Rose Pistachio Latte/);
    const o = (await s.api(`/api/orders/${list[0].lastOrder}`)).body as { pickup: string; note: string };
    assert.equal(o.pickup, time);
  }

  const weekday = await s.api("/api/account/schedules", { method: "POST", json: { lines, days: [1, 2, 3, 4, 5], time: "08:30" } });
  assert.equal(weekday.status, 200);
  const id = (weekday.body as { id: number }).id;
  const get = async () => ((await s.api("/api/account/schedules")).body as { id: number; next: string | null; active: boolean; skipDate: string | null }[]).find((x) => x.id === id)!;
  const before = await get();
  assert.ok(before.next);
  await s.api("/api/account/schedules", { method: "PATCH", json: { id, skip: before.next } });
  const skipped = await get();
  assert.notEqual(skipped.next, before.next, "skipping moves to the next day");
  await s.api("/api/account/schedules", { method: "PATCH", json: { id, active: false } });
  assert.equal((await get()).next, null, "paused");
  assert.equal((await s.api("/api/account/schedules", { method: "DELETE", json: { id } })).status, 200);
  await s.api("/api/account/logout", { method: "POST" });
});

test("voice order endpoint returns tray lines with full options", async () => {
  const r = await s.api("/api/voice-order", { method: "POST", json: { text: "two iced honey oat lattes and a butter croissant" } });
  assert.equal(r.status, 200);
  const d = r.body as { by: string; lines: { itemId: string; qty: number; opts: { temp?: string; size?: string } }[] };
  assert.equal(d.by, "simple");
  assert.equal(d.lines[0].itemId, "honey-oat-latte");
  assert.equal(d.lines[0].qty, 2);
  assert.equal(d.lines[0].opts.temp, "iced");
  assert.equal(d.lines[0].opts.size, "regular", "defaults filled in");
  assert.equal(d.lines[1].itemId, "croissant");
});

test("menu items come with allergens and calories", async () => {
  const items = ((await s.api("/api/menu")).body as { items: { id: string; allergens?: string[]; kcal?: number }[] }).items;
  const croissant = items.find((i) => i.id === "croissant")!;
  assert.deepEqual(croissant.allergens, ["gluten", "milk", "egg"]);
  assert.equal(croissant.kcal, 280);
  assert.ok(items.filter((i) => i.kcal !== undefined).length >= 20);
});

test("noticeboard: notes wait for a barista, no links, max 3 a day", async () => {
  const pin = (text: string) => s.api("/api/notices", { method: "POST", json: { kind: "lost", name: "Tara", text } });
  assert.equal((await pin("short")).status, 400);
  assert.equal((await pin("See my site https://spam.example for deals")).status, 400, "no links");
  assert.equal((await pin("Found a blue umbrella by the window seat")).status, 200);
  const publicBefore = (await s.api("/api/notices")).body as { text: string }[];
  assert.ok(!publicBefore.some((n) => n.text.includes("blue umbrella")), "hidden until approved");
  await pin("Looking for a study buddy for exams");
  await pin("Swapping a copy of Norwegian Wood");
  assert.equal((await pin("A fourth note on the same day")).status, 429);
  await s.login();
  const all = (await s.api("/api/notices?all=1")).body as { id: number; text: string; status: string }[];
  const umbrella = all.find((n) => n.text.includes("blue umbrella"))!;
  assert.equal(umbrella.status, "pending");
  await s.api("/api/notices", { method: "PATCH", json: { id: umbrella.id, status: "approved" } });
  assert.ok(((await s.api("/api/notices")).body as { text: string }[]).some((n) => n.text.includes("blue umbrella")));
});

test("visitor stats: counted once a day, no bots or staff pages", async () => {
  const hit = (path: string, ua: string, ip = "10.1.1.1", ref = "") => fetch(`${s.url}/api/stats`, { method: "POST", headers: { "Content-Type": "application/json", "user-agent": ua, "x-forwarded-for": ip }, body: JSON.stringify({ path, ref }) });
  const phone = "Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36";
  await hit("/", phone, "10.1.1.1", "https://www.instagram.com/mossandmoon");
  await hit("/order/MM-ABCD", phone, "10.1.1.1");
  await hit("/order/MM-WXYZ", phone, "10.1.1.1");
  await hit("/", "Mozilla/5.0 (Macintosh) Safari/605", "10.1.1.2");
  await hit("/", "Googlebot/2.1", "10.1.1.3");
  await hit("/admin", phone, "10.1.1.4");
  await s.login();
  const r = (await s.api("/api/admin/visitors?days=7")).body as { visitors: number; views: number; pages: { path: string; n: number }[]; referrers: { ref: string }[]; devices: { device: string }[] };
  assert.equal(r.visitors, 2, "two real visitors; the bot and the staff page don't count");
  assert.equal(r.views, 4);
  assert.equal(r.pages.find((p) => p.path === "/order/[code]")!.n, 2, "order pages are grouped");
  assert.deepEqual(r.referrers.map((x) => x.ref), ["instagram.com"]);
  assert.ok(r.devices.some((d) => d.device === "phone"));
});

test("two-step login: set up, codes required, no reuse, backup codes work once", async () => {
  const { codeAt, stepNow } = await import("../src/lib/totp.ts");
  await s.login();
  const start = await s.api("/api/admin/2fa", { method: "POST", json: { action: "start" } });
  const secret = (start.body as { secret: string }).secret;
  assert.match((start.body as { qr: string }).qr, /<svg/);
  assert.equal((await s.api("/api/admin/2fa", { method: "POST", json: { action: "confirm", code: "000000" } })).status, 400);
  const on = await s.api("/api/admin/2fa", { method: "POST", json: { action: "confirm", code: codeAt(secret, stepNow()) } });
  assert.equal(on.status, 200);
  const backup = (on.body as { backupCodes: string[] }).backupCodes;
  assert.equal(backup.length, 8);

  const login = (body: object) => fetch(`${s.url}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.9.9.9" }, body: JSON.stringify({ passcode: "test-passcode", ...body }) });
  const noCode = await login({});
  assert.equal(noCode.status, 401);
  assert.equal(((await noCode.json()) as { needCode: boolean }).needCode, true);
  assert.equal((await login({ code: codeAt(secret, stepNow()) })).status, 401, "the code used to switch it on can't be reused");
  assert.equal((await login({ code: codeAt(secret, stepNow() + 1) })).status, 200, "the next code works");
  assert.equal((await login({ code: backup[0] })).status, 200, "a backup code works");
  assert.equal((await login({ code: backup[0] })).status, 401, "but only once");

  assert.equal((await s.api("/api/admin/2fa", { method: "POST", json: { action: "off", code: backup[1] } })).status, 200);
  assert.equal((await login({})).status, 200, "off again");
});

test("security: cross-site changes are blocked, headers are set, codes are long", async () => {
  const evil = await fetch(`${s.url}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: JSON.stringify({ name: "X", phone: "9000016161", lines: [{ itemId: "cookie", qty: 1 }] }) });
  assert.equal(evil.status, 403, "another site can't post here");
  const same = await fetch(`${s.url}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", Origin: s.url }, body: JSON.stringify({ name: "Ok", phone: "9000016161", lines: [{ itemId: "cookie", qty: 1 }] }) });
  assert.equal(same.status, 200);
  assert.match(((await same.json()) as { code: string }).code, /^MM-[A-Z0-9]{6}$/);

  const home = await fetch(`${s.url}/`);
  assert.match(home.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.equal(home.headers.get("x-powered-by"), null);

  const card = (await s.api("/api/loyalty?phone=9000016161")).body as { name: string };
  assert.equal(card.name, "O.", "only an initial");

  await s.login();
  const sec = (await s.api("/api/admin/security")).body as { checks: { label: string; ok: boolean }[] };
  assert.ok(sec.checks.some((c) => c.label.includes("Two-step") && !c.ok));
});

test("new menu: cold drinks and food with add-ons, priced on the server", async () => {
  const items = ((await s.api("/api/menu")).body as { items: { id: string; cat: string; addons?: { id: string }[] }[] }).items;
  assert.ok(items.filter((i) => i.cat === "cold").length >= 10);
  assert.ok(items.filter((i) => i.cat === "food").length >= 11);
  assert.ok(items.find((i) => i.id === "cheese-toastie")!.addons!.some((a) => a.id === "gf-bread"));

  const placed = await s.api("/api/orders", { method: "POST", json: { name: "Menu", phone: "9000017171", lines: [
    { itemId: "cheese-toastie", qty: 1, opts: { addons: ["egg", "gf-bread", "gold-leaf"] }, price: 1 },
    { itemId: "oreo-frappe", qty: 1, opts: { temp: "hot", milk: "soy", toppings: ["whipped"], ice: "light" } },
    { itemId: "mango-smoothie", qty: 1, opts: { milk: "oat", syrup: "vanilla" } },
  ] } });
  assert.equal(placed.status, 200);
  const o = (await s.api(`/api/orders/${(placed.body as { code: string }).code}`)).body as { lines: { itemId: string; total: number; note: string; opts: { temp?: string; milk?: string } }[] };
  const [toastie, frappe, smoothie] = o.lines;
  assert.equal(toastie.total, 220 + 40 + 50, "egg + gluten-free bread; unknown add-ons ignored, browser price ignored");
  assert.match(toastie.note, /fried egg.*Gluten-free bread/);
  assert.equal(frappe.opts.temp, "iced", "cold drinks stay iced");
  assert.equal(frappe.total, 260 + 30 + 30, "soy milk + whipped cream");
  assert.equal(smoothie.opts.milk, undefined, "smoothies have no milk choice");
  assert.equal(smoothie.total, 220);
});

test("hours & holidays: a closure stops orders and bookings; golden hour is editable", async () => {
  await s.login();
  const today = new Date();
  const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const before = (await s.api("/api/admin/cafe-config")).body as { hours: Record<string, unknown>; closures: unknown[] };
  assert.equal((await s.api("/api/admin/cafe-config", { method: "PUT", json: { hours: { 1: [10, 9] } } })).status, 400, "closing before opening");
  const put = await s.api("/api/admin/cafe-config", { method: "PUT", json: { closures: [{ date: ds, note: "Deep clean" }], happyHour: { on: true, from: 14, to: 16, off: 25, cats: ["bakes", "food"], days: [1, 2, 3, 4, 5] } } });
  assert.equal(put.status, 200);

  const order = await s.api("/api/orders", { method: "POST", json: { name: "Closed", phone: "9000021212", lines: [{ itemId: "cookie", qty: 1 }] } });
  assert.equal(order.status, 409);
  assert.match((order.body as { error: string }).error, /closed today \(Deep clean\)/);
  assert.deepEqual((await s.api(`/api/bookings/availability?date=${ds}`)).body, []);
  assert.equal(((await s.api("/api/busy")).body as { open: boolean }).open, false);
  const home = await (await fetch(`${s.url}/`)).text();
  assert.match(home, /25% off food &amp; bakes, 2–4pm on weekdays|25% off bakes &amp; food/, "golden hour label follows the settings");

  // Back to normal
  await s.api("/api/admin/cafe-config", { method: "PUT", json: { closures: [], hours: before.hours, happyHour: { on: true, from: 15, to: 17, off: 20, cats: ["bakes"], days: [0, 1, 2, 3, 4, 5, 6] } } });
  assert.equal((await s.api("/api/orders", { method: "POST", json: { name: "Open", phone: "9000021212", lines: [{ itemId: "cookie", qty: 1 }] } })).status, 200);
});

test("events editor: owner adds, edits and deletes events", async () => {
  await s.login();
  const d = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  assert.equal((await s.api("/api/events", { method: "PUT", json: { title: "", date: d, time: "18:00", capacity: 10 } })).status, 400);
  const add = await s.api("/api/events", { method: "PUT", json: { title: "Poetry & Pour-overs", date: d, time: "18:30", capacity: 8, price: 299, desc: "Bring a poem.", img: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=900" } });
  assert.equal(add.status, 200);
  const ev = add.body as { id: string; img: string };
  assert.equal(ev.img, "1501339847302-ac426a4a7cbb", "an Unsplash link becomes its photo id");
  const pub = (await s.api("/api/events")).body as { id: string; title: string; spotsLeft: number }[];
  assert.ok(pub.some((e) => e.id === ev.id && e.spotsLeft === 8));
  // Ticket sold, so it can't be deleted
  const t = await s.api("/api/tickets", { method: "POST", json: { eventId: ev.id, name: "Poet", email: "poet@example.com", qty: 1 } });
  const code = (t.body as { code: string }).code;
  await s.api("/api/payments/verify", { method: "POST", json: { kind: "ticket", code, demo: true } });
  assert.equal((await s.api("/api/events", { method: "PUT", json: { id: ev.id, title: "Poetry & Pour-overs", date: d, time: "19:00", capacity: 12, price: 299 } })).status, 200);
  assert.equal((await s.api("/api/events", { method: "DELETE", json: { id: ev.id } })).status, 409);
  const free = await s.api("/api/events", { method: "PUT", json: { title: "Board games night", date: d, time: "20:00", capacity: 20, price: 0 } });
  assert.equal((await s.api("/api/events", { method: "DELETE", json: { id: (free.body as { id: string }).id } })).status, 200);
});

test("GST: paid orders get running tax invoice numbers and a monthly report", async () => {
  await s.login();
  assert.equal((await s.api("/api/admin/gst", { method: "PUT", json: { on: true, gstin: "bad", legalName: "Moss & Moon Cafe LLP" } })).status, 400);
  assert.equal((await s.api("/api/admin/gst", { method: "PUT", json: { on: true, gstin: "30ABCDE1234F1Z5", legalName: "Moss & Moon Cafe LLP", address: "14 Willow Lane, Goa", rate: 5 } })).status, 200);
  const make = async () => {
    const r = await s.api("/api/orders", { method: "POST", json: { name: "Tax", phone: "9000022323", payMethod: "online", lines: [{ itemId: "cookie", qty: 2 }] } });
    const code = (r.body as { code: string }).code;
    await s.api("/api/payments/verify", { method: "POST", json: { kind: "order", code, demo: true } });
    return code;
  };
  const a = await make();
  const b = await make();
  const pdf = (code: string) => fetch(`${s.url}/api/orders/${code}/receipt`).then((r) => r.arrayBuffer()).then((x) => Buffer.from(x).toString("latin1"));
  await pdf(a);
  await pdf(b);
  const month = new Date().toISOString().slice(0, 7);
  const csv = await (await fetch(`${s.url}/api/admin/gst?report=${month}`, { headers: { cookie: s.cookie() } })).text();
  const fy = (() => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; })();
  const nums = [...csv.matchAll(new RegExp(`MM/${fy}/(\\d{4})`, "g"))].map((m) => Number(m[1]));
  assert.ok(nums.length >= 2, "each paid order has an invoice number");
  assert.equal(nums[nums.length - 1] - nums[nums.length - 2], 1, "numbers run in order");
  // ₹220 incl. 5% GST → taxable 209.52, CGST 5.24, SGST 5.24
  assert.match(csv, /"209\.52","5\.24","5\.24","220\.00"/);
  await s.api("/api/admin/gst", { method: "PUT", json: { on: false } });
});

test("newsletter: draft, test, send to subscribers, one-click unsubscribe", async () => {
  await s.login();
  await s.api("/api/admin/settings", { method: "PATCH", json: { ownerEmail: "owner@example.com" } });
  for (const e of ["reader1@example.com", "reader2@example.com"]) await s.api("/api/newsletter", { method: "POST", json: { email: e } });
  const dr = (await s.api("/api/admin/newsletter/draft", { method: "POST", json: { idea: "the new frappé" } })).body as { subject: string; body: string };
  assert.ok(dr.subject && dr.body.length > 40, "a starting draft without AI");
  const saved = await s.api("/api/admin/newsletter", { method: "POST", json: { subject: "Frappé season ✿", body: "Hello!\n\n**New:** the frappé." } });
  const id = (saved.body as { id: number }).id;
  assert.equal((await s.api("/api/admin/newsletter/send", { method: "POST", json: { id, test: true } })).status, 200);
  const sent = await s.api("/api/admin/newsletter/send", { method: "POST", json: { id } });
  assert.ok((sent.body as { recipients: number }).recipients >= 2);
  let n: { status: string; sent_count: number } | undefined;
  for (let i = 0; i < 40 && n?.status !== "sent"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    n = ((await s.api("/api/admin/newsletter")).body as { newsletters: { id: number; status: string; sent_count: number }[] }).newsletters.find((x) => x.id === id);
  }
  assert.equal(n?.status, "sent");
  const mail = (await s.api("/api/admin/emails")).body as { emails: { to_email: string; subject: string; html: string }[] };
  const r1 = mail.emails.find((e) => e.to_email === "reader1@example.com" && e.subject === "Frappé season ✿")!;
  assert.ok(r1, "subscriber got it");
  assert.ok(mail.emails.some((e) => e.to_email === "owner@example.com" && e.subject.startsWith("[Test]")));
  // The unsubscribe link in their email works, and a wrong token doesn't
  const link = /href="(http[^"]+unsubscribe[^"]+)"/.exec(r1.html)![1].replace(/&amp;/g, "&");
  const u = new URL(link);
  assert.match(await (await fetch(`${s.url}${u.pathname}?e=${u.searchParams.get("e")}&t=wrong`)).text(), /didn't work/);
  assert.match(await (await fetch(`${s.url}${u.pathname}${u.search}`)).text(), /unsubscribed/);
  const after = (await s.api("/api/admin/newsletter")).body as { unsubscribed: number };
  assert.ok(after.unsubscribed >= 1);
});

test("guest list: visits and spend grouped by person, VIP stars show on the barista queue", async () => {
  for (let i = 0; i < 3; i++) await s.api("/api/orders", { method: "POST", json: { name: "Regular Rhea", phone: "9000023434", lines: [{ itemId: "rose-latte", qty: 1 }] } });
  await s.login();
  const d = (await s.api("/api/admin/guests?q=rhea")).body as { guests: { key: string; name: string; visits: number; spend: number; favourite: string }[] };
  const g = d.guests[0];
  assert.equal(g.visits, 3);
  assert.equal(g.spend, 750);
  assert.equal(g.favourite, "Rose Pistachio Latte");
  await s.api("/api/admin/guests", { method: "PATCH", json: { key: g.key, vip: true, note: "Oat milk, extra hot" } });
  const again = (await s.api("/api/admin/guests?vip=1")).body as { guests: { key: string; note: string }[] };
  assert.equal(again.guests.find((x) => x.key === g.key)?.note, "Oat milk, extra hot");
  const queue = (await s.api("/api/orders?active=1")).body as { name: string; vip: boolean }[];
  assert.ok(queue.some((o) => o.name === "Regular Rhea" && o.vip));
  const csv = await (await fetch(`${s.url}/api/admin/guests?format=csv`, { headers: { cookie: s.cookie() } })).text();
  assert.match(csv, /Regular Rhea/);
});

test("café shop: grind choices are priced, stock counts down and sells out", async () => {
  await s.login();
  await s.api("/api/menu", { method: "PATCH", json: { itemId: "moss-mug", stock: 2 } });
  const buy = (qty: number, variant = "blush") => s.api("/api/orders", { method: "POST", json: { name: "Shopper", phone: "9000024545", lines: [{ itemId: "moss-mug", qty, opts: { variant } }] } });
  assert.equal((await buy(3)).status, 409, "only 2 left");
  const ok = await buy(2);
  assert.equal(ok.status, 200);
  const o = (await s.api(`/api/orders/${(ok.body as { code: string }).code}`)).body as { lines: { note: string; total: number }[] };
  assert.equal(o.lines[0].note, "Blush pink");
  const menu = ((await s.api("/api/menu")).body as { items: { id: string; soldOut: boolean; stock?: number }[] }).items;
  const mug = menu.find((m) => m.id === "moss-mug")!;
  assert.equal(mug.stock, 0);
  assert.equal(mug.soldOut, true);
  // South Indian filter grind costs a little more
  const beans = await s.api("/api/orders", { method: "POST", json: { name: "Shopper", phone: "9000024545", lines: [{ itemId: "house-blend-beans", qty: 1, opts: { variant: "south-indian" } }] } });
  assert.equal((beans.body as { total: number }).total, 680);
  await s.api("/api/menu", { method: "PATCH", json: { itemId: "moss-mug", stock: 30 } });
});

test("journal: posts publish to their own page, drafts stay hidden", async () => {
  const list = await (await fetch(`${s.url}/journal`)).text();
  assert.match(list, /18-hour cold brew/, "starter posts");
  await s.login();
  const d = await s.api("/api/admin/posts", { method: "POST", json: { title: "Why our chai has rose petals", body: "It started as a happy accident.\n\n## The rose\nDried petals from **Kannauj**.", status: "draft" } });
  const slug = (d.body as { slug: string }).slug;
  assert.equal(slug, "why-our-chai-has-rose-petals");
  assert.equal((await fetch(`${s.url}/journal/${slug}`)).status, 404, "drafts aren't public");
  await s.api("/api/admin/posts", { method: "POST", json: { slug, title: "Why our chai has rose petals", body: "It started as a happy accident.\n\n## The rose\nDried petals from **Kannauj**. <script>x</script>", status: "published" } });
  const page = await fetch(`${s.url}/journal/${slug}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<strong>Kannauj<\/strong>/);
  assert.ok(!html.includes("<script>x</script>"), "post text is escaped");
  assert.match(await (await fetch(`${s.url}/sitemap.xml`)).text(), new RegExp(`/journal/${slug}`));
});

test("surprise wheel lands on a real drink; at most one discount a day", async () => {
  let codes = 0;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${s.url}/api/surprise`, { method: "POST", headers: { "x-forwarded-for": "10.7.7.7" } });
    const d = (await r.json()) as { wheel: { id: string }[]; index: number; code: string | null };
    assert.ok(d.wheel[d.index], "lands on a slice");
    if (d.code) {
      codes++;
      assert.equal((await s.api("/api/promo", { method: "POST", json: { code: d.code } })).status, 200, "the code works");
    }
  }
  assert.ok(codes <= 1, "one discount per visitor per day");
});

test("timesheets: staff clock in and out; tips are split by hours worked", async () => {
  await s.login();
  await s.api("/api/admin/staff", { method: "POST", json: { name: "Tara", username: "tara", password: "flat-white-7", role: "barista" } });
  const staffLogin = async () => {
    const r = await fetch(`${s.url}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.5.5.5" }, body: JSON.stringify({ username: "tara", password: "flat-white-7" }) });
    return r.headers.get("set-cookie")!.split(";")[0];
  };
  const cookie = await staffLogin();
  const clock = (action: string) => fetch(`${s.url}/api/staff/clock`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ action }) });
  assert.equal((await clock("in")).status, 200);
  assert.equal((await clock("in")).status, 409, "already clocked in");
  assert.equal((await clock("out")).status, 200);
  // Owner view: a pretend 4-hour shift for the tip split
  const db = new (await import("node:sqlite")).DatabaseSync((await import("node:path")).join(s.dataDir, "cafe.db"));
  const id = (db.prepare("SELECT id FROM staff WHERE username = 'tara'").get() as { id: number }).id;
  db.prepare("UPDATE timesheets SET clock_in = datetime('now','localtime','-4 hours'), clock_out = datetime('now','localtime') WHERE staff_id = ?").run(id);
  db.close();
  await s.api("/api/orders", { method: "POST", json: { name: "Tipper", phone: "9000025656", payMethod: "online", tipAmount: 60, lines: [{ itemId: "cookie", qty: 1 }] } }).then(async (r) => {
    await s.api("/api/payments/verify", { method: "POST", json: { kind: "order", code: (r.body as { code: string }).code, demo: true } });
  });
  const rep = (await s.api("/api/admin/timesheets")).body as { tips: number; people: { name: string; worked: number; tip: number }[] };
  const tara = rep.people.find((p) => p.name === "Tara")!;
  assert.ok(Math.abs(tara.worked - 4) < 0.05);
  assert.ok(rep.tips >= 60);
  assert.equal(rep.people.reduce((t, p) => t + p.tip, 0), rep.tips, "every rupee of tips is shared out");
});

test("supplier reorders: low stock makes a draft; approving emails the supplier; receiving restocks", async () => {
  await s.login();
  await s.api("/api/admin/stock", { method: "PATCH", json: { id: "matcha", supplier_name: "Uji Tea Co", supplier_email: "orders@uji.example", reorder_qty: 1000 } });
  const draft = await s.api("/api/admin/reorders", { method: "POST", json: { ingredientId: "matcha" } });
  assert.equal(draft.status, 200);
  assert.equal((await s.api("/api/admin/reorders", { method: "POST", json: { ingredientId: "matcha" } })).status, 409, "one open order at a time");
  const id = (draft.body as { id: number }).id;
  const before = ((await s.api("/api/admin/stock")).body as { id: string; qty: number }[]).find((i) => i.id === "matcha")!.qty;
  assert.equal((await s.api("/api/admin/reorders", { method: "PATCH", json: { id, action: "receive" } })).status, 400, "send it first");
  assert.equal((await s.api("/api/admin/reorders", { method: "PATCH", json: { id, action: "send", qty: 2000 } })).status, 200);
  const mail = (await s.api("/api/admin/emails")).body as { emails: { to_email: string; subject: string }[] };
  assert.ok(mail.emails.some((e) => e.to_email === "orders@uji.example" && e.subject.includes("2 kg Matcha powder")));
  assert.equal((await s.api("/api/admin/reorders", { method: "PATCH", json: { id, action: "receive" } })).status, 200);
  const after = ((await s.api("/api/admin/stock")).body as { id: string; qty: number }[]).find((i) => i.id === "matcha")!.qty;
  assert.equal(after - before, 2000);
});

test("wi-fi: owner sets it; staff get the QR; it's not public", async () => {
  await s.login();
  assert.equal((await s.api("/api/admin/wifi", { method: "PUT", json: { ssid: "Moss", password: "short", security: "WPA" } })).status, 400);
  assert.equal((await s.api("/api/admin/wifi", { method: "PUT", json: { ssid: "MossAndMoon-Guest", password: "pinklatte123", security: "WPA", onReceipts: true, onTables: true } })).status, 200);
  const qr = await fetch(`${s.url}/api/admin/wifi/qr`, { headers: { cookie: s.cookie() } });
  assert.equal(qr.headers.get("content-type"), "image/svg+xml");
  assert.equal((await fetch(`${s.url}/api/admin/wifi/qr`)).status, 401, "not on the public site");
});

test("dietary profile is saved; silver members get a free size upgrade", async () => {
  const email = "tier@example.com";
  const sent = await s.api("/api/account/code", { method: "POST", json: { email } });
  await s.api("/api/account/verify", { method: "POST", json: { email, code: (sent.body as { demoCode: string }).demoCode } });
  await s.api("/api/account", { method: "PATCH", json: { name: "Tia", phone: "9000026767", diet: { vegan: true, avoid: ["nuts", "plutonium"] } } });
  const acc = (await s.api("/api/account")).body as { customer: { diet: { vegan: boolean; avoid: string[] } }; tier: { id: string } };
  assert.deepEqual(acc.customer.diet.avoid, ["nuts"], "only real allergens");
  assert.equal(acc.tier.id, "bronze");
  // Ten past visits → silver
  const { DatabaseSync } = await import("node:sqlite");
  const path = await import("node:path");
  const db = new DatabaseSync(path.join(s.dataDir, "cafe.db"));
  const cid = (db.prepare("SELECT id FROM customers WHERE email = ?").get(email) as { id: number }).id;
  for (let i = 0; i < 10; i++) db.prepare("INSERT INTO orders (code, name, phone, pickup, note, lines, subtotal, discount, total, customer_id) VALUES (?, 'Tia', '9000026767', 'asap', '', '[]', 0, 0, 0, ?)").run(`MM-TIER${i}`, cid);
  db.close();
  assert.equal(((await s.api("/api/account")).body as { tier: { id: string } }).tier.id, "silver");
  const r = await s.api("/api/orders", { method: "POST", json: { name: "Tia", phone: "9000026767", lines: [{ itemId: "rose-latte", qty: 1, opts: { size: "large", milk: "oat" } }] } });
  assert.equal((r.body as { total: number }).total, 250 + 40 + 30 - 40, "large for free");
  await s.api("/api/account/logout", { method: "POST" });
});

test("retention: new guests per month and how many came back", async () => {
  await s.login();
  const r = (await s.api("/api/admin/retention")).body as { months: { month: string; newGuests: number; returned: number; rate: number }[] };
  assert.ok(r.months.length >= 1);
  const m = r.months.at(-1)!;
  assert.ok(m.newGuests >= 1 && m.rate >= 0 && m.rate <= 100);
});

test("cash-up: expected counter takings vs what was counted", async () => {
  await s.login();
  const before = (await s.api("/api/admin/cashup")).body as { expected: number };
  const r = await s.api("/api/admin/cashup", { method: "POST", json: { float: 2000, cash: 2000 + before.expected - 30, upi: 0, card: 0, note: "short 30" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.cashup.difference, -30);
  const bad = await s.api("/api/admin/cashup", { method: "POST", json: { cash: -5 } });
  assert.equal(bad.status, 400);
  const again = (await s.api("/api/admin/cashup")).body as { cashup: { difference: number }; history: unknown[] };
  assert.equal(again.cashup.difference, -30);
  assert.equal(again.history.length, 1);
});

test("P&L: expenses (one-off and every month) come off the profit", async () => {
  await s.login();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const base = (await s.api(`/api/admin/pnl?month=${month}`)).body as { net: number; gross: number };
  assert.equal((await s.api("/api/admin/pnl", { method: "POST", json: { month, category: "rent", amount: 30000, recurring: true } })).status, 200);
  assert.equal((await s.api("/api/admin/pnl", { method: "POST", json: { month, category: "repairs", label: "Grinder", amount: 1500 } })).status, 200);
  assert.equal((await s.api("/api/admin/pnl", { method: "POST", json: { month, amount: 0 } })).status, 400);
  const p = (await s.api(`/api/admin/pnl?month=${month}`)).body as { net: number; expenses: number; byCategory: Record<string, number>; trend: unknown[] };
  assert.equal(p.expenses, 31500);
  assert.equal(p.net, base.gross - 31500);
  assert.equal(p.byCategory.rent, 30000);
  assert.equal(p.trend.length, 6);
});

test("booking a table from the floor plan, with a pre-order", async () => {
  const day = new Date(Date.now() + 2 * 86_400_000);
  let date = "", time = "";
  for (let i = 2; i < 10 && !time; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const slots = (await s.api(`/api/bookings/availability?date=${date}`)).body as { time: string }[];
    time = slots[2]?.time ?? "";
  }
  void day;
  assert.ok(time, "found an open day");
  const plan = (await s.api(`/api/bookings/tables?date=${date}&time=${time}&guests=2`)).body as { tables: { no: number; seats: number; free: boolean; fits: boolean }[] };
  assert.ok(plan.tables.length >= 6 && plan.tables.every((t) => t.free));
  const base = { name: "Tara", phone: "9876500011", date, time, guests: 2 };
  // Too small a table for the group
  assert.equal((await s.api("/api/bookings", { method: "POST", json: { ...base, guests: 4, table: 1 } })).status, 409);
  const ok = await s.api("/api/bookings", { method: "POST", json: { ...base, table: 1, preorder: [{ itemId: "cookie", qty: 2 }, { itemId: "nope", qty: 1 }] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.table, 1);
  assert.equal(ok.body.preorder.length, 1);
  assert.match(ok.body.preorder[0], /^2 × /);
  // Same table 30 minutes later clashes; a different table is fine
  const [h, m] = time.split(":").map(Number);
  const later = `${String(h + (m === 30 ? 1 : 0)).padStart(2, "0")}:${m === 30 ? "00" : "30"}`;
  assert.equal((await s.api("/api/bookings", { method: "POST", json: { ...base, time: later, table: 1 } })).status, 409);
  const after = (await s.api(`/api/bookings/tables?date=${date}&time=${later}&guests=2`)).body as { tables: { no: number; free: boolean }[] };
  assert.equal(after.tables.find((t) => t.no === 1)!.free, false);
  assert.equal((await s.api("/api/bookings", { method: "POST", json: { ...base, time: later, table: 2 } })).status, 200);
  await s.login();
  const list = (await s.api("/api/bookings")).body as { code: string; table_no: number; preorder: string | null }[];
  assert.ok(list.some((b) => b.code === ok.body.code && b.table_no === 1 && b.preorder?.includes("×")));
});

test("bean subscriptions: start, skip, pause, resume and cancel", async () => {
  await signIn("beans@example.com");
  const list = (await s.api("/api/account/beans")).body as { beans: { id: string; variants: { id: string }[] }[]; subs: unknown[] };
  assert.ok(list.beans.length >= 1 && list.subs.length === 0);
  const bean = list.beans[0];
  assert.equal((await s.api("/api/account/beans", { method: "POST", json: { itemId: bean.id, every: 28 } })).status, 400, "needs a phone first");
  await s.api("/api/account", { method: "PATCH", json: { phone: "9811122233" } });
  assert.equal((await s.api("/api/account/beans", { method: "POST", json: { itemId: bean.id, every: 10 } })).status, 400);
  assert.equal((await s.api("/api/account/beans", { method: "POST", json: { itemId: bean.id, every: 28, method: "delivery", address: "x" } })).status, 400);
  const d = new Date(Date.now() + 5 * 86_400_000);
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const made = await s.api("/api/account/beans", { method: "POST", json: { itemId: bean.id, variant: bean.variants.at(-1)?.id, qty: 2, every: 14, start } });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const id = made.body.id;
  const skip = await s.api("/api/account/beans", { method: "PATCH", json: { id, action: "skip" } });
  const next = new Date(d.getTime() + 14 * 86_400_000);
  assert.equal(skip.body.sub.next_date, `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`);
  assert.equal((await s.api("/api/account/beans", { method: "PATCH", json: { id, action: "pause" } })).body.sub.status, "paused");
  assert.equal((await s.api("/api/account/beans", { method: "PATCH", json: { id, action: "resume" } })).body.sub.status, "active");
  const mine = (await s.api("/api/account/beans")).body as { subs: { label: string; price: number }[] };
  assert.match(mine.subs[0].label, /^2 × /);
  assert.ok(mine.subs[0].price > 0);
  assert.equal((await s.api("/api/account/beans", { method: "PATCH", json: { id, action: "cancel" } })).status, 200);
  assert.equal(((await s.api("/api/account/beans")).body as { subs: unknown[] }).subs.length, 0);
});

test("catering: request, quote, accept and pay", async () => {
  const d = new Date(Date.now() + 5 * 86_400_000);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const base = { name: "Nisha", email: "nisha@example.com", phone: "9800011122", date, time: "11:00", guests: 25, kind: "office", method: "pickup", details: "Coffee and croissants for the team" };
  assert.equal((await s.api("/api/catering", { method: "POST", json: { ...base, guests: 4 } })).status, 400);
  assert.equal((await s.api("/api/catering", { method: "POST", json: { ...base, date: "2020-01-01" } })).status, 400);
  const made = await s.api("/api/catering", { method: "POST", json: base });
  assert.equal(made.status, 200);
  const code = made.body.code as string;
  // Nothing to pay or accept before a quote
  assert.equal((await s.api(`/api/catering/${code}`, { method: "POST", json: { action: "accept" } })).status, 409);
  assert.equal((await s.api("/api/payments/start", { method: "POST", json: { kind: "catering", code } })).status, 409);
  // Only the owner can quote
  const anon = await fetch(`${s.url}/api/catering/${code}`, { method: "PATCH", headers: { "Content-Type": "application/json", Origin: s.url }, body: JSON.stringify({ amount: 1 }) });
  assert.equal(anon.status, 401);
  await s.login();
  assert.equal((await s.api(`/api/catering/${code}`, { method: "PATCH", json: { amount: 7500, note: "25 coffees and 25 croissants" } })).status, 200);
  const view = (await s.api(`/api/catering/${code}`)).body as { status: string; amount: number; quoteNote: string };
  assert.equal(view.status, "quoted");
  assert.equal(view.amount, 7500);
  const start = await s.api("/api/payments/start", { method: "POST", json: { kind: "catering", code } });
  assert.equal(start.status, 200);
  assert.equal(start.body.amount, 7500);
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "catering", code, demo: true } })).status, 200);
  assert.equal(((await s.api(`/api/catering/${code}`)).body as { status: string; paid: boolean }).paid, true);
  // Shows up in the owner's list and in P&L for the month it was paid
  const list = (await s.api("/api/catering")).body as { code: string; status: string }[];
  assert.equal(list.find((c) => c.code === code)?.status, "paid");
  const p = (await s.api("/api/admin/pnl")).body as { catering: number };
  assert.ok(p.catering >= 7500);
  assert.equal((await s.api(`/api/catering/${code}`, { method: "PATCH", json: { status: "done" } })).body.status, "done");
});

test("talk to a person: guest and staff chat, guests only see their own", async () => {
  const anon = { "Content-Type": "application/json", Origin: s.url };
  const start = await fetch(`${s.url}/api/support`, { method: "POST", headers: anon, body: JSON.stringify({ name: "Ira", email: "ira@example.com", text: "Is the brownie gluten-free?", context: [{ role: "user", content: "gluten free?" }, { role: "assistant", content: "Try the brownie" }] }) });
  assert.equal(start.status, 200);
  const { code, token } = await start.json();
  // Wrong token: nothing
  assert.equal((await fetch(`${s.url}/api/support/${code}?token=nope`)).status, 404);
  assert.equal((await fetch(`${s.url}/api/support/${code}`, { method: "POST", headers: anon, body: JSON.stringify({ token: "x".repeat(token.length), text: "hi" }) })).status, 404);
  assert.equal((await fetch(`${s.url}/api/live?topic=support&code=${code}&token=bad`)).status, 404);
  await s.login();
  const inbox = (await s.api("/api/support")).body as { code: string; unread: number }[];
  assert.equal(inbox.find((c) => c.code === code)?.unread, 1);
  const staffView = (await s.api(`/api/support/${code}`)).body as { context: string; messages: unknown[] };
  assert.match(staffView.context, /Guest: gluten free\?/);
  assert.equal((await s.api(`/api/support/${code}`, { method: "POST", json: { text: "Yes! It's made with almond flour." } })).status, 200);
  assert.equal(((await s.api("/api/support")).body as { code: string; unread: number }[]).find((c) => c.code === code)?.unread, 0);
  const guest = await (await fetch(`${s.url}/api/support/${code}?token=${encodeURIComponent(token)}`)).json();
  assert.deepEqual(guest.messages.map((m: { sender: string }) => m.sender), ["guest", "staff"]);
  assert.equal(guest.context, undefined, "guests don't get staff-only fields");
  assert.equal((await fetch(`${s.url}/api/support/${code}`, { method: "POST", headers: anon, body: JSON.stringify({ token, text: "Thank you!" }) })).status, 200);
  assert.equal((await s.api(`/api/support/${code}`, { method: "PATCH", json: { status: "closed" } })).status, 200);
  const after = await (await fetch(`${s.url}/api/support/${code}?token=${encodeURIComponent(token)}`)).json();
  assert.equal(after.status, "closed");
  assert.equal(after.messages.at(-1).sender, "system");
});

test("kiosk orders need a staff-signed-in tablet, but no phone", async () => {
  const anon = await fetch(`${s.url}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", Origin: s.url }, body: JSON.stringify({ kiosk: true, name: "Walk-in", lines: [{ itemId: "cookie", qty: 1 }] }) });
  assert.equal(anon.status, 401);
  await s.login();
  const r = await s.api("/api/orders", { method: "POST", json: { kiosk: true, name: "Walk-in", payMethod: "online", lines: [{ itemId: "cookie", qty: 2 }] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.needsPayment, false, "kiosk orders are always paid at the counter");
  const o = (await s.api(`/api/orders/${r.body.code}`)).body as { note: string; pay_method: string; pickup: string };
  assert.match(o.note, /Kiosk/);
  assert.equal(o.pay_method, "counter");
});

test("second branch: own hours, its own bookings, and items sold only at one café", async () => {
  await s.login();
  const allDay = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [0, 24]]));
  const put = await s.api("/api/admin/cafe-config", { method: "PUT", json: { branches: [{ id: "main", name: "Willow Lane", address: "14 Willow Lane" }, { name: "Fontainhas", address: "3 Rua de Ourem", hours: allDay }] } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const b = (put.body as { branches: { id: string; name: string }[] }).branches;
  assert.deepEqual(b.map((x) => x.id), ["main", "fontainhas"]);
  // Bad branch hours are refused
  assert.equal((await s.api("/api/admin/cafe-config", { method: "PUT", json: { branches: [{ id: "main", name: "Main" }, { name: "X", hours: { 1: [10, 9] } }] } })).status, 400);
  // An order at the new branch is tagged with it (open 24h, so it works whatever the time)
  const r = await s.api("/api/orders", { method: "POST", json: { name: "Branch", phone: "9876512345", branch: "fontainhas", lines: [{ itemId: "cookie", qty: 1 }] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const o = (await s.api(`/api/orders/${r.body.code}`)).body as { branch: string };
  assert.equal(o.branch, "fontainhas");
  assert.equal((await s.api("/api/orders", { method: "POST", json: { name: "B", phone: "9876512345", branch: "nowhere", lines: [{ itemId: "cookie", qty: 1 }] } })).status, 400);
  // Booking slots are per branch, and the floor plan is only at the main café
  const d = new Date(Date.now() + 3 * 86_400_000);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const slots = (await s.api(`/api/bookings/availability?date=${date}&branch=fontainhas`)).body as { time: string }[];
  assert.equal(slots[0].time, "00:00");
  assert.equal(((await s.api(`/api/bookings/tables?date=${date}&time=10:00&branch=fontainhas`)).body as { tables: unknown[] }).tables.length, 0);
  const bk = await s.api("/api/bookings", { method: "POST", json: { name: "Rui", phone: "9876512399", date, time: "01:00", guests: 2, branch: "fontainhas" } });
  assert.equal(bk.status, 200, JSON.stringify(bk.body));
  // Put back to one café so other tests see the usual setup
  assert.equal((await s.api("/api/admin/cafe-config", { method: "PUT", json: { branches: [{ id: "main", name: "Willow Lane", address: "14 Willow Lane" }] } })).status, 200);
});

test("coffee wallet top-up adds the bonus; student discount needs a college email", async () => {
  await signIn("wallet@example.com");
  const before = (await s.api("/api/account/wallet")).body as { balance: number };
  assert.equal((await s.api("/api/account/wallet", { method: "POST", json: { amount: 123 } })).status, 400);
  const t = await s.api("/api/account/wallet", { method: "POST", json: { amount: 1000 } });
  assert.equal(t.status, 200);
  assert.equal((await s.api("/api/payments/start", { method: "POST", json: { kind: "wallet", code: t.body.code } })).body.amount, 1000);
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "wallet", code: t.body.code, demo: true } })).status, 200);
  await s.api("/api/payments/verify", { method: "POST", json: { kind: "wallet", code: t.body.code, demo: true } }); // a double tap adds nothing
  assert.equal(((await s.api("/api/account/wallet")).body as { balance: number }).balance, before.balance + 1075);

  assert.equal((await s.api("/api/account/student", { method: "POST", json: { email: "me@gmail.com" } })).status, 400);
  const sent = await s.api("/api/account/student", { method: "POST", json: { email: "me@goa.bits-pilani.ac.in" } });
  assert.equal(sent.status, 200);
  assert.equal((await s.api("/api/account/student", { method: "POST", json: { code: "000000" === sent.body.demoCode ? "111111" : "000000" } })).status, 400);
  const ok = await s.api("/api/account/student", { method: "POST", json: { code: sent.body.demoCode } });
  assert.equal(ok.body.verified, true);
  assert.equal(((await s.api("/api/account")).body as { perks: { student: boolean } }).perks.student, true);
});

test("we miss you: regulars who stopped coming are counted, unsubscribed ones aren't", async () => {
  await s.login();
  const { DatabaseSync } = await import("node:sqlite");
  const path = await import("node:path");
  const db = new DatabaseSync(path.join(s.dataDir, "cafe.db"));
  const old = "datetime('now','localtime','-40 days')";
  for (const [email, n] of [["gone@example.com", 3], ["once@example.com", 1], ["optout@example.com", 3]] as const)
    for (let i = 0; i < n; i++) db.prepare(`INSERT INTO orders (code, name, phone, email, pickup, note, lines, subtotal, discount, total, created_at) VALUES (?, 'Gone', '9000011111', ?, 'asap', '', '[]', 0, 0, 0, ${old})`).run(`MM-WB${email.slice(0, 4)}${i}`, email);
  db.prepare("INSERT INTO no_marketing (email) VALUES ('optout@example.com')").run();
  db.close();
  const st = (await s.api("/api/admin/winback")).body as { on: boolean; waiting: number };
  assert.equal(st.on, true);
  assert.equal(st.waiting, 1, "only the regular who hasn't opted out");
  assert.equal(((await s.api("/api/admin/winback", { method: "PUT", json: { on: false } })).body as { on: boolean }).on, false);
  await s.api("/api/admin/winback", { method: "PUT", json: { on: true } });
});

test("recipes: staff can read them, only the owner can change them, and they're not on the public menu", async () => {
  assert.equal((await fetch(`${s.url}/api/admin/recipes`)).status, 401);
  await s.login();
  const r = (await s.api("/api/admin/recipes")).body as { recipes: Record<string, string> };
  assert.match(r.recipes["cappuccino"], /Double shot/);
  assert.equal((await s.api("/api/admin/recipes", { method: "PUT", json: { itemId: "cappuccino", text: "Step one\nStep two" } })).status, 200);
  assert.equal(((await s.api("/api/admin/recipes")).body as { recipes: Record<string, string> }).recipes["cappuccino"], "Step one\nStep two");
  assert.equal((await s.api("/api/admin/recipes", { method: "PUT", json: { itemId: "nope", text: "x" } })).status, 404);
  const menu = JSON.stringify((await fetch(`${s.url}/api/menu`).then((x) => x.json())));
  assert.ok(!menu.includes("Step one"));
});
