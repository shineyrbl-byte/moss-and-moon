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
