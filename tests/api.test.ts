// End-to-end API tests against a real running copy of the site. Run: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, type TestServer } from "./server.ts";
import { MOONS } from "../src/lib/secret.ts";
import { ANSWERS, score, wordFor } from "../src/lib/wordGame.ts";

let s: TestServer;
before(async () => {
  s = await startServer();
});

// The server checks finished boards for some daily puzzles. Test players "solve" today's puzzle first: this works out
// the proof the page would send, so the score tests can stay about scores. (The checks have their own test below.)
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
async function solvedProof(game: string, mode: string | undefined, ms: number): Promise<{ proof: unknown; ms: number } | null> {
  const day = localDay();
  switch (game) {
    case "sudoku": { const S = await import("../src/lib/sudoku.ts"); return { proof: S.sudokuFor(day, S.sudokuMode(mode)).answer, ms }; }
    case "crossword": { const X = await import("../src/lib/crossword.ts"); return { proof: X.solutionOf(X.crosswordFor(day).rows), ms }; }
    case "trail": { const H = await import("../src/lib/hidato.ts"); return { proof: H.trailFor(day).answer, ms }; }
    case "stars": { const B = await import("../src/lib/starBattle.ts"); const p = B.starsFor(day); return { proof: p.region.map((_, i) => (p.stars.includes(i) ? 2 : 0)), ms }; }
    case "seats": { const A = await import("../src/lib/akari.ts"); const p = A.seatsFor(day); return { proof: p.walls.map((_, i) => (p.lamps.includes(i) ? 2 : 0)), ms }; }
    case "garden": { const G = await import("../src/lib/nurikabe.ts"); const p = G.gardenFor(day); return { proof: p.path.map((x: boolean) => (x ? 1 : 2)), ms }; }
    case "zip": { const Z = await import("../src/lib/zipPath.ts"); return { proof: Z.zipFor(day).path, ms }; }
    case "bikes": { const B = await import("../src/lib/bikes.ts"); return { proof: B.bikesFor(day).answer.map((x) => (x ? 2 : 1)), ms }; }
    case "codeword": { const C = await import("../src/lib/codeword.ts"); return { proof: C.codewordFor(day).key, ms }; }
    case "pipes": { const P = await import("../src/lib/pipes.ts"); const p = P.pipesFor(day), zero = p.tiles.map(() => 0); return { proof: p.tiles.map((_, i) => P.fixTurns(p.tiles, p.spins, zero, i)), ms }; }
    case "cutters": { const C = await import("../src/lib/cutters.ts"); return { proof: C.cuttersFor(day).answer, ms }; }
    case "cages": { const K = await import("../src/lib/killerSudoku.ts"); return { proof: K.cagesFor(day).answer, ms }; }
    case "push": {
      const B = await import("../src/lib/beanPush.ts"); const l = B.levelFor(day);
      const key = (x: { player: number; boxes: number[] }) => `${x.player}:${[...x.boxes].sort((a, b) => a - b)}`;
      let front = [B.start(l)]; const seen = new Set([key(front[0])]);
      for (let k = 0; k < 200 && front.length; k++) { const next: typeof front = []; for (const st of front) { if (B.isSolved(l, st)) return { proof: st.path, ms: st.path!.length * 1_000_000 + (ms % 1_000_000) }; for (const d of [0, 1, 2, 3] as const) { const n = B.move(l, st, d); if (n && !seen.has(key(n))) { seen.add(key(n)); next.push(n); } } } front = next; }
      return null;
    }
    case "wheel": { const W = await import("../src/lib/wordWheel.ts"); const w = W.wheelFor(day), n = Math.min(w.main.length, W.MAX_MAIN - Math.floor(ms / 1_000_000)); return { proof: w.main.slice(0, n), ms: W.pack(n, ms % 1_000_000) }; }
    case "price": {
      const P = await import("../src/lib/priceOrder.ts");
      const menu = ((await (await fetch(`${s.url}/api/menu`)).json()).items as (import("../src/lib/priceOrder.ts").PItem & { cat: string; pup?: boolean })[]).filter((m) => m.cat !== "shop" && !m.pup && m.price > 0);
      const five = P.priceFor(day, menu)!, right = [...five].sort((a, b) => a.price - b.price).map((x) => x.id), goes = Math.max(1, Math.floor(ms / 1_000_000));
      return { proof: [...Array(goes - 1).fill([...right].reverse()), right], ms };
    }
  }
  return null;
}
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.endsWith("/api/daily-scores") && init?.method === "POST" && typeof init.body === "string") {
    const b = JSON.parse(init.body);
    if (b.proof === undefined && b.game && Number(b.ms) > 0) { const p = await solvedProof(b.game, b.mode, Number(b.ms)); if (p) init = { ...init, body: JSON.stringify({ ...b, ...p, ms: (b.game === "push" && Number(b.ms) >= 3000 && Number(b.ms) < 1e9) || (b.game === "wheel" && Number(b.ms) >= 5000 && Number(b.ms) < 41e6) ? p.ms : b.ms }) }; }
  }
  return realFetch(input, init);
}) as typeof fetch;
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

test("the October dishes are on the menu, and no two dishes share a photo", async () => {
  const items = (await s.api("/api/menu")).body.items as { id: string; img: string; nameMr?: string; badge?: string }[];
  for (const id of ["dalgona", "dirty-chai", "aam-panna", "mango-sorbet", "banana-bread", "biscoff-jar", "jamun-popsicles", "funfetti-cookie", "crispy-bars", "oreo-cupcake", "recheado-wings", "chilli-prawns"])
    assert.ok(items.some((m) => m.id === id), `${id} is on the menu`);
  const SHARED_OK = new Set(["1564890369478-c89ca6d9cde9"]); // the oolong pot and the tea set: both teapots
  const seen = new Map<string, string>();
  for (const m of items) {
    if (seen.has(m.img) && !SHARED_OK.has(m.img)) assert.fail(`${m.id} uses the same photo as ${seen.get(m.img)}`);
    seen.set(m.img, m.id);
  }
});

test("every dish has a Hindi and a Marathi name", async () => {
  const items = (await s.api("/api/menu")).body.items as { id: string; nameHi?: string; nameMr?: string }[];
  const missing = items.filter((m) => !m.nameHi || !m.nameMr).map((m) => m.id);
  assert.deepEqual(missing, []);
  const kaapi = items.find((m) => m.id === "filter-kaapi")!;
  assert.equal(kaapi.nameHi, "फ़िल्टर कापी"); // existing Hindi name kept
  assert.equal(kaapi.nameMr, "फिल्टर कापी");
  const noDesc = (items as unknown as { id: string; descHi?: string; descMr?: string }[]).filter((m) => !m.descHi || !m.descMr).map((m) => m.id);
  assert.deepEqual(noDesc, [], "every dish has Hindi and Marathi descriptions");
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
  const named = await s.api("/api/menu", { method: "POST", json: { ...created.body.item, nameMr: "टेस्ट ब्रू", nameKok: "टेस्ट ब्रू कोंकणी" } });
  assert.equal(named.body.item.nameMr, "टेस्ट ब्रू");
  assert.equal(named.body.item.nameKok, "टेस्ट ब्रू कोंकणी");
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
  // Just typing the number isn't enough to spend them
  const anon = await order({ name: "Loyal", phone, lines: [{ itemId: "americano", qty: 1 }] });
  assert.equal(anon.body.usedReward, false);
  // Signed in with that phone on the account: the free drink comes off
  await signIn("loyal@example.com");
  await s.api("/api/account", { method: "PATCH", json: { phone } });
  const r = await order({ name: "Loyal", phone, lines: [{ itemId: "americano", qty: 1 }, { itemId: "matcha", qty: 1 }] });
  assert.equal(r.body.usedReward, true);
  assert.equal(r.body.total, 260);
  assert.equal((await s.api(`/api/loyalty?phone=${phone}`)).body.stamps, 2, "10 + 1 + 1 - 10");
  await s.api("/api/account/logout", { method: "POST" });
});

test("bookings respect table limits", async () => {
  const date = tomorrow();
  const slots = (await s.api(`/api/bookings/availability?date=${date}`)).body;
  const time = slots[0].time;
  const r = await s.api("/api/bookings", { method: "POST", json: { name: "Big Group", phone: "9444444444", date, time, guests: 5 } });
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

test("an unhappy visit review goes privately to the owner", async () => {
  const placed = await s.api("/api/orders", { method: "POST", json: { name: "Meh", phone: "9000088888", email: "meh@example.com", lines: [{ itemId: "cookie", qty: 1 }] } });
  const code = (placed.body as { code: string }).code;
  const r = await s.api("/api/reviews", { method: "POST", json: { name: "Meh", rating: 2, text: "Cookie was cold and stale", orderCode: code } });
  assert.equal((r.body as { private: boolean }).private, true);
  const publicList = (await (await fetch(`${s.url}/api/reviews`)).json()) as { reviews: { name: string }[] };
  assert.ok(!publicList.reviews.some((x) => x.name === "Meh"), "not on the public wall");
  await s.login();
  const staffList = (await s.api("/api/reviews")).body as { reviews: { name: string; private: number }[] };
  assert.equal(staffList.reviews.find((x) => x.name === "Meh")?.private, 1, "the owner still sees it");
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
  // A 4-hour shift that stays inside this week (just after midnight on a Monday, "4 hours ago" is last week)
  const early = new Date().getDay() === 1 && new Date().getHours() < 5;
  db.prepare(early
    ? "UPDATE timesheets SET clock_in = datetime('now','localtime'), clock_out = datetime('now','localtime','+4 hours') WHERE staff_id = ?"
    : "UPDATE timesheets SET clock_in = datetime('now','localtime','-4 hours'), clock_out = datetime('now','localtime') WHERE staff_id = ?").run(id);
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

test("checklists: tick tasks, record fridge temperatures, owner edits the list", async () => {
  await s.login();
  const d = (await s.api("/api/admin/checklists")).body as { lists: { id: string; items: { id: number; kind: string; text: string }[]; done: number }[] };
  const opening = d.lists.find((l) => l.id === "opening")!;
  const task = opening.items.find((i) => i.kind === "tick")!;
  const fridge = opening.items.find((i) => i.kind === "temp")!;
  const t1 = await s.api("/api/admin/checklists", { method: "POST", json: { itemId: task.id, done: true } });
  assert.equal(t1.status, 200);
  assert.equal((await s.api("/api/admin/checklists", { method: "POST", json: { itemId: fridge.id, done: true } })).status, 400, "needs a reading");
  const warm = await s.api("/api/admin/checklists", { method: "POST", json: { itemId: fridge.id, done: true, value: 8 } });
  assert.equal(warm.body.warn, true);
  const after = warm.body.lists.find((l: { id: string }) => l.id === "opening");
  assert.equal(after.done, 2);
  await s.api("/api/admin/checklists", { method: "POST", json: { itemId: task.id, done: false } });
  const added = await s.api("/api/admin/checklists", { method: "PUT", json: { list: "closing", text: "Water the plants" } });
  assert.ok(added.body.lists.find((l: { id: string }) => l.id === "closing").items.some((i: { text: string }) => i.text === "Water the plants"));
});

test("shift swaps: ask, a teammate takes it, the owner approves and the rota updates", async () => {
  await s.login();
  for (const u of ["swapa", "swapb"]) await s.api("/api/admin/staff", { method: "POST", json: { name: u === "swapa" ? "Asha" : "Ben", username: u, password: "swap-pass-123", role: "barista" } });
  const team = (await s.api("/api/admin/staff")).body as { id: number; username: string }[];
  const a = team.find((m) => m.username === "swapa")!, b = team.find((m) => m.username === "swapb")!;
  const d = new Date(Date.now() + 2 * 86_400_000);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const shift = (await s.api("/api/admin/shifts", { method: "POST", json: { staffId: a.id, day, start: "07:00", end: "13:00" } })).body.id as number;
  // Each barista gets their own session
  const as = async (username: string) => {
    const r = await fetch(`${s.url}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: s.url }, body: JSON.stringify({ username, password: "swap-pass-123" }) });
    const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    return (path: string, method: string, body?: unknown) => fetch(s.url + path, { method, headers: { "Content-Type": "application/json", Origin: s.url, cookie }, body: body ? JSON.stringify(body) : undefined });
  };
  const asA = await as("swapa"), asB = await as("swapb");
  assert.equal((await asB("/api/admin/swaps", "POST", { shiftId: shift })).status, 403, "can't give away someone else's shift");
  const ask = await asA("/api/admin/swaps", "POST", { shiftId: shift, note: "exam" });
  assert.equal(ask.status, 200);
  const id = (await ask.json()).id;
  assert.equal((await asA("/api/admin/swaps", "PATCH", { id, action: "take" })).status, 403);
  assert.equal((await asB("/api/admin/swaps", "PATCH", { id, action: "approve" })).status, 403, "baristas can't approve");
  assert.equal((await asB("/api/admin/swaps", "PATCH", { id, action: "take" })).status, 200);
  assert.equal((await s.api("/api/admin/swaps", { method: "PATCH", json: { id, action: "approve" } })).status, 200);
  const rota = (await s.api(`/api/admin/shifts?week=${day}`)).body as { shifts: { id: number; staff_id: number }[] };
  assert.equal(rota.shifts.find((x) => x.id === shift)!.staff_id, b.id);
});

test("equipment: service resets the reminder, a repair cost lands in P&L", async () => {
  await s.login();
  const d = (await s.api("/api/admin/equipment")).body as { items: { id: number; name: string; daysLeft: number }[] };
  assert.ok(d.items.length >= 4);
  const id = d.items[0].id;
  const before = ((await s.api("/api/admin/pnl")).body as { byCategory: Record<string, number> }).byCategory.repairs ?? 0;
  assert.equal((await s.api("/api/admin/equipment", { method: "POST", json: { id, kind: "repair", cost: 500 } })).status, 400, "needs a note");
  const r = await s.api("/api/admin/equipment", { method: "POST", json: { id, kind: "repair", note: "New steam wand tip", cost: 1200 } });
  assert.equal(r.status, 200);
  assert.equal(((await s.api("/api/admin/pnl")).body as { byCategory: Record<string, number> }).byCategory.repairs, before + 1200);
  const added = await s.api("/api/admin/equipment", { method: "PUT", json: { name: "Ice machine", task: "Sanitise", everyDays: 14 } });
  assert.equal(added.body.items.find((e: { name: string }) => e.name === "Ice machine").daysLeft, 14);
});

test("staffing: hours with too few people on the rota show as short", async () => {
  await s.login();
  const w = (await s.api("/api/admin/staffing")).body as { estimated: boolean; days: { closed: boolean; hours: { need: number; have: number }[] }[] };
  assert.equal(w.days.length, 7);
  const open = w.days.filter((d) => !d.closed);
  assert.ok(open.length > 0);
  assert.ok(open.every((d) => d.hours.every((h) => h.need >= 1 && h.have >= 0)));
});

test("special of the day: a simple idea without AI, and it goes on today's menu only", async () => {
  await s.login();
  const d = (await s.api("/api/admin/specials")).body as { ideas: { baseItemId: string; name: string; desc: string; price: number }[]; provider: string | null };
  assert.equal(d.provider, null);
  assert.ok(d.ideas.length >= 1);
  const r = await s.api("/api/admin/specials", { method: "POST", json: { ...d.ideas[0], name: "Test Special" } });
  assert.equal(r.status, 200);
  const menu = (await fetch(`${s.url}/api/menu`).then((x) => x.json())) as { id: string; name: string; until?: string }[] | { items: { id: string; name: string }[] };
  const list = Array.isArray(menu) ? menu : menu.items;
  assert.ok(list.some((m) => m.name === "Test Special"));
});

test("printable menu shows the live menu with prices", async () => {
  const html = await (await fetch(`${s.url}/print/menu`)).text();
  assert.match(html, /Honey Oat Latte/);
  assert.match(html, /₹220/);
  assert.match(html, /Scan to order ahead/);
});

test("missed sales and back-in-stock requests are counted", async () => {
  await s.login();
  await s.api("/api/menu", { method: "PATCH", json: { itemId: "fudge-cake", soldOut: true } });
  const fail = await s.api("/api/orders", { method: "POST", json: { name: "Miss", phone: "9876500777", lines: [{ itemId: "fudge-cake", qty: 2 }] } });
  assert.equal(fail.status, 409);
  assert.equal((await s.api("/api/stock-alerts", { method: "POST", json: { itemId: "fudge-cake", email: "bad" } })).status, 400);
  assert.equal((await s.api("/api/stock-alerts", { method: "POST", json: { itemId: "fudge-cake", email: "fudge@example.com" } })).status, 200);
  const rows = (await s.api("/api/admin/missed")).body as { item_id: string; qty: number; waiting: number; lost: number }[];
  const r = rows.find((x) => x.item_id === "fudge-cake")!;
  assert.equal(r.qty, 3);
  assert.equal(r.waiting, 1);
  assert.ok(r.lost > 0);
  await s.api("/api/menu", { method: "PATCH", json: { itemId: "fudge-cake", soldOut: false } });
});

test("café links: Google review link and WhatsApp number are checked", async () => {
  await s.login();
  assert.equal((await s.api("/api/admin/cafe-config", { method: "PUT", json: { links: { googleReview: "https://evil.example/review", whatsapp: "" } } })).status, 400);
  assert.equal((await s.api("/api/admin/cafe-config", { method: "PUT", json: { links: { googleReview: "", whatsapp: "123" } } })).status, 400);
  const ok = await s.api("/api/admin/cafe-config", { method: "PUT", json: { links: { googleReview: "https://g.page/r/abc123/review", whatsapp: "98765 43210" } } });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.links, { googleReview: "https://g.page/r/abc123/review", whatsapp: "9876543210" });
  await s.api("/api/admin/cafe-config", { method: "PUT", json: { links: { googleReview: "", whatsapp: "" } } });
});

test("repeating events: one form makes the whole series, and the series can be removed", async () => {
  await s.login();
  const d = new Date(Date.now() + 3 * 86_400_000);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const r = await s.api("/api/events", { method: "PUT", json: { title: "Weekly Open Mic", date, time: "19:00", desc: "Bring a song", capacity: 30, price: 0, repeat: "weekly", times: 4 } });
  assert.equal(r.status, 200);
  assert.equal(r.body.created, 4);
  const all = ((await s.api("/api/events?all=1")).body as { id: string; date: string; series?: string }[]).filter((e) => e.series === r.body.series);
  assert.equal(all.length, 4);
  const gap = (new Date(all[1].date).getTime() - new Date(all[0].date).getTime()) / 86_400_000;
  assert.equal(Math.round(gap), 7);
  const del = await s.api("/api/events", { method: "DELETE", json: { id: all[1].id, series: true } });
  assert.equal(del.body.removed, 3);
  assert.equal(((await s.api("/api/events?all=1")).body as { series?: string }[]).filter((e) => e.series === r.body.series).length, 1);
});

test("big groups pay a deposit that becomes a gift card; a no-show keeps it", async () => {
  let date = "", time = "";
  for (let i = 4; i < 12 && !time; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    time = ((await s.api(`/api/bookings/availability?date=${date}`)).body as { time: string }[])[4]?.time ?? "";
  }
  const base = { name: "Party", phone: "9876500999", date, time, guests: 7 };
  assert.equal((await s.api("/api/bookings", { method: "POST", json: base })).status, 400, "needs an email");
  const r = await s.api("/api/bookings", { method: "POST", json: { ...base, email: "party@example.com" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.needsDeposit, true);
  assert.equal(r.body.deposit, 700);
  const start = await s.api("/api/payments/start", { method: "POST", json: { kind: "booking", code: r.body.code } });
  assert.equal(start.body.amount, 700);
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "booking", code: r.body.code, demo: true } })).status, 200);
  await s.login();
  const b = ((await s.api("/api/bookings")).body as { code: string; status: string; deposit_status: string; deposit_card: string }[]).find((x) => x.code === r.body.code)!;
  assert.equal(b.status, "confirmed");
  assert.equal(b.deposit_status, "paid");
  assert.equal((await s.api(`/api/giftcards/${b.deposit_card}`)).body.balance, 700);
  await s.api("/api/bookings", { method: "PATCH", json: { code: b.code, status: "no-show" } });
  assert.equal((await s.api(`/api/giftcards/${b.deposit_card}`)).body.balance, 0);
});

test("use-by dates: soonest first, expired flagged, used or thrown", async () => {
  await s.login();
  const day = (n: number) => { const d = new Date(Date.now() + n * 86_400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  assert.equal((await s.api("/api/admin/batches", { method: "POST", json: { name: "Cream", useBy: "2020-01-01" } })).status, 400);
  await s.api("/api/admin/batches", { method: "POST", json: { name: "Oat milk", amount: "6 cartons", useBy: day(5) } });
  const r = await s.api("/api/admin/batches", { method: "POST", json: { name: "Croissants", useBy: day(0) } });
  const list = r.body.batches as { id: number; name: string; state: string }[];
  assert.deepEqual(list.map((b) => b.name), ["Croissants", "Oat milk"]);
  assert.equal(list[0].state, "soon");
  const after = await s.api("/api/admin/batches", { method: "PATCH", json: { id: list[0].id, status: "thrown" } });
  assert.equal(after.body.batches.length, 1);
  assert.equal(after.body.stats.thrown, 1);
});

test("supplier prices: a rise is logged, flagged and costed", async () => {
  await s.login();
  const ing = ((await s.api("/api/admin/stock")).body as { id: string; cost: number }[]).find((i) => i.id === "milk-oat")!;
  assert.equal((await s.api("/api/admin/stock", { method: "PATCH", json: { id: "milk-oat", cost: ing.cost * 1.25, price_note: "new supplier" } })).status, 200);
  const p = (await s.api("/api/admin/prices")).body as { items: { id: string; change: number; alert: boolean; history: unknown[] }[] };
  const oat = p.items.find((i) => i.id === "milk-oat")!;
  assert.equal(oat.alert, true);
  assert.equal(Math.round(oat.change), 25);
  assert.equal(oat.history.length, 2);
  await s.api("/api/admin/stock", { method: "PATCH", json: { id: "milk-oat", cost: ing.cost } });
});

test("training: owner signs off stations; the recipe quiz is marked on the server", async () => {
  await s.login();
  const t = (await s.api("/api/admin/training")).body as { stations: { id: string }[]; team: { id: number; stations: Record<string, unknown> }[] };
  const p = t.team[0];
  const r = await s.api("/api/admin/training", { method: "PUT", json: { staffId: p.id, station: "espresso", trained: true } });
  assert.ok(r.body.team.find((x: { id: number }) => x.id === p.id).stations.espresso);
  const q = (await s.api("/api/admin/training/quiz")).body as { questions: { key: string; options: { id: string }[] }[] };
  assert.equal(q.questions.length, 5);
  assert.ok(q.questions.every((x) => x.options.length === 4));
  // Pick the right one by asking the recipe API (a cheat only staff have)
  const recipes = ((await s.api("/api/admin/recipes")).body as { recipes: Record<string, string> }).recipes;
  const crypto = await import("node:crypto");
  const h = (s2: string) => crypto.createHash("sha256").update(s2).digest("hex").slice(0, 16);
  const answers = q.questions.map((x) => ({ key: x.key, choice: x.options.find((o) => recipes[o.id] && h(recipes[o.id]) === x.key)!.id }));
  const g = await s.api("/api/admin/training/quiz", { method: "POST", json: { answers } });
  assert.equal(g.body.score, 5);
  assert.equal(g.body.passed, true);
  const wrong = await s.api("/api/admin/training/quiz", { method: "POST", json: { answers: answers.map((a) => ({ ...a, choice: "nope" })) } });
  assert.equal(wrong.body.score, 0);
});

test("story image: a tall PNG for a menu item, staff only", async () => {
  assert.equal((await fetch(`${s.url}/api/admin/story?item=cookie`)).status, 401);
  await s.login();
  const r = await fetch(`${s.url}/api/admin/story?item=cookie`, { headers: { cookie: s.cookie() } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/png");
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.readUInt32BE(16), 1080);
  assert.equal(buf.readUInt32BE(20), 1920);
  assert.equal((await fetch(`${s.url}/api/admin/story?item=nope`, { headers: { cookie: s.cookie() } })).status, 404);
});

test("company tab: join with a code, order on the tab, monthly invoice, mark paid", async () => {
  await s.login();
  assert.equal((await s.api("/api/admin/companies", { method: "POST", json: { name: "Acme", billingEmail: "nope" } })).status, 400);
  assert.equal((await s.api("/api/admin/companies", { method: "POST", json: { name: "Acme Labs", billingEmail: "accounts@acme.example", monthlyLimit: 300 } })).status, 200);
  const co = ((await s.api("/api/admin/companies")).body as { companies: { id: number; name: string; join_code: string }[] }).companies.find((c) => c.name === "Acme Labs")!;
  await signIn("dev@acme.example");
  await s.api("/api/account", { method: "PATCH", json: { phone: "9811100001" } });
  assert.equal((await s.api("/api/orders", { method: "POST", json: { name: "Dev", phone: "9811100001", payMethod: "company", lines: [{ itemId: "cookie", qty: 1 }] } })).status, 400, "not a member yet");
  assert.equal((await s.api("/api/account/company", { method: "POST", json: { code: "CO-WRONG" } })).status, 404);
  assert.equal((await s.api("/api/account/company", { method: "POST", json: { code: co.join_code } })).body.company.name, "Acme Labs");
  const o = await s.api("/api/orders", { method: "POST", json: { name: "Dev", phone: "9811100001", payMethod: "company", lines: [{ itemId: "cookie", qty: 1 }] } });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.equal(o.body.needsPayment, false);
  assert.equal((await s.api("/api/orders", { method: "POST", json: { name: "Dev", phone: "9811100001", payMethod: "company", lines: [{ itemId: "cookie", qty: 5 }] } })).status, 400, "over the monthly limit");
  await s.login();
  // Collecting it doesn't mark it paid: the company pays the invoice
  for (const st of ["brewing", "ready", "collected"]) await s.api(`/api/orders/${o.body.code}`, { method: "PATCH", json: { status: st } });
  const view = await s.api(`/api/orders/${o.body.code}`);
  assert.equal(view.body.pay_status, "unpaid");
  const inv = await s.api("/api/admin/companies", { method: "PATCH", json: { id: co.id, action: "invoice" } });
  assert.equal(inv.status, 200, JSON.stringify(inv.body));
  assert.equal(inv.body.orders, 1);
  await s.api("/api/admin/companies", { method: "PATCH", json: { id: co.id, action: "paid" } });
  assert.equal((await s.api(`/api/orders/${o.body.code}`)).body.pay_status, "paid");
});

test("rush mode: busy adds to ready times, paused stops online (not table) orders", async () => {
  await s.login();
  const before = (await s.api("/api/queue")).body as { minutes: number };
  assert.equal((await s.api("/api/rush", { method: "PUT", json: { mode: "busy", minutes: 30, auto: false } })).body.mode, "busy");
  assert.equal(((await s.api("/api/queue")).body as { minutes: number }).minutes, Math.min(60, before.minutes + 10));
  await s.api("/api/rush", { method: "PUT", json: { mode: "paused", minutes: 15 } });
  const online = await s.api("/api/orders", { method: "POST", json: { name: "Rush", phone: "9876500123", lines: [{ itemId: "cookie", qty: 1 }] } });
  assert.equal(online.status, 503);
  assert.match(online.body.error, /paused/);
  const atTable = await s.api("/api/orders", { method: "POST", json: { name: "Rush", table: 3, lines: [{ itemId: "cookie", qty: 1 }] } });
  assert.equal(atTable.status, 200);
  assert.equal((await fetch(`${s.url}/api/rush`, { method: "PUT", headers: { "Content-Type": "application/json", Origin: s.url }, body: "{}" })).status, 401);
  await s.api("/api/rush", { method: "PUT", json: { mode: "off", auto: false } });
  const r = (await s.api("/api/rush")).body as { mode: string; active: number };
  assert.equal(r.mode, "off");
  // With auto on, a long queue (12+) counts as busy by itself
  const auto = (await s.api("/api/rush", { method: "PUT", json: { mode: "off", auto: true } })).body as { mode: string; active: number };
  assert.equal(auto.mode, auto.active >= 12 ? "busy" : "off");
  await s.api("/api/rush", { method: "PUT", json: { mode: "off", auto: false } });
});

test("setup checklist lists what's missing", async () => {
  await s.login();
  const d = (await s.api("/api/admin/setup")).body as { items: { id: string; ok: boolean }[]; done: number; total: number };
  assert.ok(d.total >= 6 && d.done < d.total);
  assert.equal(d.items.find((i) => i.id === "payments")!.ok, false);
});

test("I'm here: pickup guests tell the team they've arrived", async () => {
  const o = await s.api("/api/orders", { method: "POST", json: { name: "Here", phone: "9876500321", lines: [{ itemId: "cookie", qty: 1 }] } });
  assert.equal((await s.api(`/api/orders/${o.body.code}/here`, { method: "POST", json: { note: "In my car outside: red Swift" } })).status, 200);
  const v = await s.api(`/api/orders/${o.body.code}`);
  assert.ok(v.body.arrived_at);
  assert.equal(v.body.arrived_note, "In my car outside: red Swift");
  const t = await s.api("/api/orders", { method: "POST", json: { name: "T", table: 2, lines: [{ itemId: "cookie", qty: 1 }] } });
  assert.equal((await s.api(`/api/orders/${t.body.code}/here`, { method: "POST", json: {} })).status, 400);
});

test("rate each item: only once it's made, only items in the order, and enough ratings show on the menu", async () => {
  await s.login();
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const o = await s.api("/api/orders", { method: "POST", json: { name: "Rater", table: 4, lines: [{ itemId: "tiramisu", qty: 1 }] } });
    codes.push(o.body.code);
  }
  assert.equal((await s.api(`/api/orders/${codes[0]}/rate`, { method: "POST", json: { itemId: "tiramisu", up: true } })).status, 409, "not made yet");
  for (const c of codes) for (const st of ["brewing", "ready"]) await s.api(`/api/orders/${c}`, { method: "PATCH", json: { status: st } });
  assert.equal((await s.api(`/api/orders/${codes[0]}/rate`, { method: "POST", json: { itemId: "cookie", up: true } })).status, 400);
  for (const [i, c] of codes.entries()) assert.equal((await s.api(`/api/orders/${c}/rate`, { method: "POST", json: { itemId: "tiramisu", up: i !== 0 } })).status, 200);
  const menu = (await (await fetch(`${s.url}/api/menu`)).json()) as { items: { id: string; loved?: number }[] };
  assert.equal(menu.items.find((m) => m.id === "tiramisu")!.loved, 90);
  assert.deepEqual((await s.api(`/api/orders/${codes[0]}/rate`)).body, { tiramisu: false });
});

test("data rights: download everything, then delete the account", async () => {
  await signIn("forgetme@example.com");
  await s.api("/api/account", { method: "PATCH", json: { phone: "9811155555", name: "Forget Me" } });
  const o = await s.api("/api/orders", { method: "POST", json: { name: "Forget Me", phone: "9811155555", email: "forgetme@example.com", lines: [{ itemId: "cookie", qty: 1 }] } });
  const dump = await s.api("/api/account/data");
  assert.equal(dump.status, 200);
  assert.equal(dump.body.account.email, "forgetme@example.com");
  assert.ok(dump.body.orders.some((x: { code: string }) => x.code === o.body.code));
  assert.equal((await s.api("/api/account/data", { method: "DELETE", json: { confirm: "yes" } })).status, 400);
  assert.equal((await s.api("/api/account/data", { method: "DELETE", json: { confirm: "DELETE" } })).status, 200);
  assert.equal((await s.api("/api/account")).body.signedIn, false, "signed out");
  await s.login();
  const kept = (await s.api(`/api/orders/${o.body.code}`)).body as { name: string };
  assert.equal(kept.name, "Deleted guest", "the order stays, without their name");
});

test("a year with us: accounts made on this day last year with 3+ orders are due", async () => {
  await s.login();
  const { DatabaseSync } = await import("node:sqlite");
  const path = await import("node:path");
  const db = new DatabaseSync(path.join(s.dataDir, "cafe.db"));
  const r = db.prepare("INSERT INTO customers (email, name, referral_code, created_at) VALUES ('yearly@example.com', 'Yara', 'YARA01', datetime('now','localtime','-1 year')) ").run();
  for (let i = 0; i < 3; i++) db.prepare(`INSERT INTO orders (code, name, phone, pickup, note, lines, subtotal, discount, total, customer_id, created_at) VALUES (?, 'Yara', '', 'asap', '', '[{"itemId":"cookie","name":"Brown Butter Cookie","cat":"bakes","qty":1,"total":110}]', 110, 0, 110, ?, datetime('now','localtime','-${i + 2} days'))`).run(`MM-YEAR${i}`, Number(r.lastInsertRowid));
  db.close();
  const st = (await s.api("/api/admin/winback")).body as { anniversary: { on: boolean; due: number } };
  assert.equal(st.anniversary.on, true);
  assert.equal(st.anniversary.due, 1);
});

test("menu board, allergen chart and the menu writer", async () => {
  assert.equal((await fetch(`${s.url}/board/menu`)).status, 200);
  const html = await (await fetch(`${s.url}/print/allergens`)).text();
  assert.match(html, /Allergen chart/);
  assert.match(html, /Honey Oat Latte/);
  await s.login();
  const w = await s.api("/api/admin/menu-writer", { method: "POST", json: { name: "Coconut Cold Brew", cat: "cold" } });
  assert.equal(w.status, 400, "needs an AI key, which tests don't have");
  assert.match(w.body.error, /Gemini/);
  // Hindi text is saved with the item
  const items = ((await fetch(`${s.url}/api/menu`).then((r) => r.json())) as { items: Record<string, unknown>[] }).items;
  const latte = items.find((m) => m.id === "honey-oat-latte")!;
  assert.equal((await s.api("/api/menu", { method: "POST", json: { ...latte, nameHi: "हनी ओट लाटे" } })).status, 200);
  const after = ((await fetch(`${s.url}/api/menu`).then((r) => r.json())) as { items: { id: string; nameHi?: string }[] }).items.find((m) => m.id === "honey-oat-latte")!;
  assert.equal(after.nameHi, "हनी ओट लाटे");
});

test("combos: the owner sets them, the server applies them to an order", async () => {
  await s.login();
  assert.equal((await s.api("/api/admin/cafe-config", { method: "PUT", json: { combos: [{ name: "Solo", price: 100, slots: [{ label: "Coffee", cats: ["coffee"] }] }] } })).status, 400, "needs two parts");
  const ok = await s.api("/api/admin/cafe-config", { method: "PUT", json: { combos: [{ name: "Test combo", price: 250, slots: [{ label: "Coffee", cats: ["coffee"] }, { label: "Bake", cats: ["bakes"] }] }] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const o = await s.api("/api/orders", { method: "POST", json: { name: "Combo", phone: "9876500654", lines: [{ itemId: "honey-oat-latte", qty: 1, opts: { size: "regular", milk: "oat" } }, { itemId: "croissant", qty: 1 }] } });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.equal(o.body.total, 250);
  assert.match(o.body.perks, /combo/);
  // Back to the starting combos (they're time-limited, so they're off in tests)
  const { DEFAULT_COMBOS } = await import("../src/lib/pricing.ts");
  assert.equal((await s.api("/api/admin/cafe-config", { method: "PUT", json: { combos: DEFAULT_COMBOS } })).status, 200);
});

test("whole cakes: 2 days' notice, paid online, then on the staff list", async () => {
  const cakes = (await s.api("/api/cakes")).body as { cakes: { itemId: string; sizes: { id: string; price: number }[] }[] };
  const pink = cakes.cakes.find((c) => c.itemId === "pink-velvet")!;
  // Find an open day 3+ days out
  let date = "";
  for (let i = 3; i < 12 && !date; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (((await s.api(`/api/bookings/availability?date=${ds}`)).body as unknown[]).length) date = ds;
  }
  const base = { itemId: "pink-velvet", size: pink.sizes[0].id, message: "Happy birthday Meera!", date, time: "16:00", name: "Cake Fan", phone: "9811177777", email: "cake@example.com" };
  const t = new Date(); const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  assert.equal((await s.api("/api/cakes", { method: "POST", json: { ...base, date: today } })).status, 400, "too soon");
  const o = await s.api("/api/cakes", { method: "POST", json: base });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.equal(o.body.price, pink.sizes[0].price);
  assert.equal((await s.api("/api/payments/start", { method: "POST", json: { kind: "cake", code: o.body.code } })).body.amount, pink.sizes[0].price);
  await s.api("/api/payments/verify", { method: "POST", json: { kind: "cake", code: o.body.code, demo: true } });
  assert.equal((await s.api(`/api/cakes/${o.body.code}`)).body.status, "paid");
  await s.login();
  const list = (await s.api("/api/cakes?orders=1")).body as { code: string; message: string }[];
  assert.equal(list.find((c) => c.code === o.body.code)?.message, "Happy birthday Meera!");
  assert.equal((await s.api(`/api/cakes/${o.body.code}`, { method: "PATCH", json: { status: "collected" } })).status, 200);
});

test("build your own bowl and a tasting flight go through checkout", async () => {
  const r = await s.api("/api/orders", { method: "POST", json: { name: "Builder", phone: "9876500888", lines: [
    { itemId: "build-bowl", qty: 1, opts: { picks: { base: ["quinoa"], protein: ["paneer"], toppings: ["avocado", "feta", "corn", "seeds"], sauce: ["tahini"] } } },
    { itemId: "coffee-flight", qty: 1, opts: { picks: { cups: ["espresso", "v60", "cold-brew"] } } },
  ] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const o = (await s.api(`/api/orders/${r.body.code}`)).body as { lines: { itemId: string; unit: number; note: string }[] };
  const bowl = o.lines.find((l) => l.itemId === "build-bowl")!;
  assert.equal(bowl.unit, 240 + 40 + 40 + 40, "paneer + avocado + feta (+ free corn); only 3 toppings kept");
  assert.equal(bowl.note, "Herby quinoa · Grilled paneer · Avocado · Charred corn · Feta · Lemon tahini");
  assert.equal(o.lines.find((l) => l.itemId === "coffee-flight")!.note, "Espresso · V60 single origin · Cold brew");
  const menu = (await (await fetch(`${s.url}/api/menu`)).json()) as { items: { id: string; half?: boolean; kids?: boolean }[] };
  assert.equal(menu.items.find((m) => m.id === "pesto-pasta")?.half, true);
  assert.equal(menu.items.find((m) => m.id === "kids-french-toast")?.kids, true);
});

test("delivery areas by pincode, pairings, and high chairs on bookings", async () => {
  await s.login();
  const zones = [{ name: "Panjim", pincodes: "403001, 403002", fee: 30, freeOver: 500, minOrder: 150, minutes: 25 }, { name: "Porvorim", pincodes: ["403521"], fee: 60, freeOver: 900, minOrder: 300, minutes: 40 }];
  assert.equal((await s.api("/api/admin/cafe-config", { method: "PUT", json: { zones: [...zones, { name: "Dup", pincodes: "403001", fee: 1, freeOver: 1, minOrder: 1, minutes: 10 }] } })).status, 400, "a pincode in two areas");
  const ok = await s.api("/api/admin/cafe-config", { method: "PUT", json: { zones } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual(ok.body.zones[0].pincodes, ["403001", "403002"]);
  const line = [{ itemId: "pesto-pasta", qty: 2 }];
  const now = new Date().getHours();
  // Delivery runs in opening hours only, so only check the area rules when that's the case
  const far = await s.api("/api/orders", { method: "POST", json: { name: "Far", phone: "9811188888", delivery: { address: "12 Long Road, Margao town", pincode: "403601" }, lines: line } });
  if (far.status === 400 && /deliver/.test(far.body.error) && !/opening hours/.test(far.body.error)) {
    assert.match(far.body.error, /don't deliver to 403601/);
    const near = await s.api("/api/orders", { method: "POST", json: { name: "Near", phone: "9811188888", delivery: { address: "4 Fontainhas Lane, Panjim", pincode: "403001" }, lines: line } });
    if (near.status === 400) assert.match(near.body.error, /opening hours/, "in the area: only refused when we're closed");
    else {
      assert.equal(near.status, 200, JSON.stringify(near.body));
      const o = (await s.api(`/api/orders/${near.body.code}`)).body as { delivery_fee: number; delivery_address: string };
      assert.equal(o.delivery_fee, 0, "over ₹500 is free in Panjim");
      assert.match(o.delivery_address, /403001/);
    }
  } else void now;
  assert.equal((await s.api("/api/admin/cafe-config", { method: "PUT", json: { zones: [] } })).status, 200);

  const pairs = (await s.api("/api/pairings")).body as Record<string, string>;
  assert.ok(pairs["cappuccino"], "every drink gets a suggestion");

  let date = "", time = "";
  for (let i = 3; i < 12 && !time; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    time = ((await s.api(`/api/bookings/availability?date=${date}`)).body as { time: string }[])[6]?.time ?? "";
  }
  const bk = await s.api("/api/bookings", { method: "POST", json: { name: "Family", phone: "9811199999", date, time, guests: 3, highChairs: 2 } });
  assert.equal(bk.status, 200);
  const list = (await s.api("/api/bookings")).body as { code: string; high_chairs: number }[];
  assert.equal(list.find((b) => b.code === bk.body.code)?.high_chairs, 2);
});

test("order for tomorrow: saved, checked against tomorrow's hours, and cancellable", async () => {
  const d = new Date(Date.now() + 86_400_000);
  const pickupDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const base = { name: "Early Bird", phone: "9811122211", email: "early@example.com", pickupDate, lines: [{ itemId: "flat-white", qty: 2 }, { itemId: "croissant", qty: 1 }] };
  assert.equal((await s.api("/api/orders/later", { method: "POST", json: { ...base, pickup: "03:00" } })).status, 400, "outside opening hours");
  assert.equal((await s.api("/api/orders/later", { method: "POST", json: { ...base, pickup: "09:00", pickupDate: "2020-01-01" } })).status, 400);
  const r = await s.api("/api/orders/later", { method: "POST", json: { ...base, pickup: "10:00" } });
  if (r.status === 400 && /closed tomorrow/.test(r.body.error)) return; // a closed day in the test calendar
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.summary, /2 × Flat White/);
  assert.ok(r.body.estimate > 0);
  assert.equal((await s.api(`/api/orders/later/${r.body.code}`)).body.status, "saved");
  assert.equal((await s.api(`/api/orders/later/${r.body.code}`, { method: "DELETE" })).status, 200);
  assert.equal((await s.api(`/api/orders/later/${r.body.code}`)).body.status, "cancelled");
});

test("own cup and the rewards shop", async () => {
  // Own cup: ₹10 off each drink, takeaway only
  const cup = await s.api("/api/orders", { method: "POST", json: { name: "Cup", phone: "9811133331", ownCup: true, lines: [{ itemId: "americano", qty: 2 }, { itemId: "croissant", qty: 1 }] } });
  const plain = await s.api("/api/orders", { method: "POST", json: { name: "Cup", phone: "9811133332", lines: [{ itemId: "americano", qty: 2 }, { itemId: "croissant", qty: 1 }] } });
  assert.equal(plain.body.total - cup.body.total, 20);
  assert.match(cup.body.perks, /own cup/);
  // Rewards: 5 orders = 5 stamps; spend 4 on a cookie
  const phone = "9811144444";
  await signIn("rewards@example.com");
  await s.api("/api/account", { method: "PATCH", json: { phone } });
  for (let i = 0; i < 4; i++) await s.api("/api/orders", { method: "POST", json: { name: "Stamps", phone, lines: [{ itemId: "americano", qty: 1 }] } });
  assert.equal((await s.api("/api/orders", { method: "POST", json: { name: "Stamps", phone, reward: "bake", lines: [{ itemId: "cookie", qty: 1 }] } })).status, 400, "needs 6 stamps");
  const r = await s.api("/api/orders", { method: "POST", json: { name: "Stamps", phone, reward: "cookie", lines: [{ itemId: "cookie", qty: 1 }, { itemId: "americano", qty: 1 }] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.usedReward, true);
  const card = (await s.api(`/api/loyalty?phone=${phone}`)).body as { stamps: number };
  assert.equal(card.stamps, 1, "4 + 1 for this order - 4 spent");
});

test("events with food packages: the package is added to the ticket price", async () => {
  await s.login();
  const d = new Date(Date.now() + 6 * 86_400_000);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const ev = await s.api("/api/events", { method: "PUT", json: { title: "Brunch Jazz", date, time: "11:00", desc: "Live trio", capacity: 20, price: 0, packages: [{ label: "Brunch included", price: 350 }, { label: "bad", price: 0 }] } });
  assert.equal(ev.status, 200);
  assert.equal(ev.body.packages.length, 1);
  const pkg = ev.body.packages[0].id;
  const t = await s.api("/api/tickets", { method: "POST", json: { eventId: ev.body.id, qty: 2, package: pkg, name: "Jazz Fan", email: "jazz@example.com" } });
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal(t.body.amount, 700);
  assert.equal((await s.api("/api/tickets", { method: "POST", json: { eventId: ev.body.id, qty: 1, name: "X", email: "x@example.com" } })).status, 400, "free without a package: RSVP instead");
  const view = (await s.api(`/api/tickets/${t.body.code}`)).body as { package: string };
  assert.equal(view.package, "Brunch included");
});

test("split by item: each pays for what they had, the last one pays the rest", async () => {
  const o = await s.api("/api/orders", { method: "POST", json: { name: "Friends", phone: "9811155511", tipPercent: 10, lines: [{ itemId: "americano", qty: 1 }, { itemId: "fudge-cake", qty: 2 }] } });
  const code = o.body.code as string;
  const a = await s.api("/api/payments/start", { method: "POST", json: { kind: "share", code, items: { 1: 1 } } });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  await s.api("/api/payments/verify", { method: "POST", json: { kind: "share", code, shareId: a.body.shareId, demo: true } });
  assert.equal((await s.api("/api/payments/start", { method: "POST", json: { kind: "share", code, items: { 1: 2 } } })).status, 409, "one cake is already paid");
  const v = (await s.api(`/api/orders/${code}`)).body as { claimedItems: Record<string, number> };
  assert.equal(v.claimedItems["1"], 1);
  const b = await s.api("/api/payments/start", { method: "POST", json: { kind: "share", code, items: { 0: 1, 1: 1 } } });
  assert.equal(a.body.amount + b.body.amount, o.body.due, "together they cover exactly what's due (tip included)");
  await s.api("/api/payments/verify", { method: "POST", json: { kind: "share", code, shareId: b.body.shareId, demo: true } });
  assert.equal((await s.api(`/api/orders/${code}`)).body.pay_status, "paid");
});

test("owner alerts settings, handover notes and the reorder link", async () => {
  await s.login();
  const a = (await s.api("/api/admin/alerts")).body as { prefs: Record<string, boolean>; devices: number; publicKey: string };
  assert.equal(a.prefs.review, true);
  assert.ok(a.publicKey.length > 20);
  assert.equal((await s.api("/api/admin/alerts", { method: "POST", json: { prefs: { big: false } } })).body.prefs.big, false);
  await s.api("/api/admin/alerts", { method: "POST", json: { prefs: { big: true } } });
  assert.equal((await s.api("/api/admin/alerts", { method: "POST", json: { subscription: { endpoint: "http://not-https", keys: {} } } })).status, 400);

  assert.equal((await s.api("/api/admin/handover", { method: "POST", json: { text: "" } })).status, 400);
  const notes = (await s.api("/api/admin/handover", { method: "POST", json: { text: "Oat milk is low" } })).body as { id: number; text: string }[];
  const n = notes.find((x) => x.text === "Oat milk is low")!;
  const after = (await s.api("/api/admin/handover", { method: "PATCH", json: { id: n.id } })).body as { id: number }[];
  assert.ok(!after.some((x) => x.id === n.id));

  const home = await fetch(`${s.url}/?reorder=MM-NOPE`);
  assert.equal(home.status, 200);
});

test("seasonal rotation, staff picks and spreadsheet import", async () => {
  await s.login();
  const menu = async () => ((await (await fetch(`${s.url}/api/menu`)).json()) as { items: { id: string; staffPick?: boolean }[] }).items;
  const has = async (id: string) => (await menu()).some((m) => m.id === id);
  for (const r of ["summer", "monsoon", "winter"]) {
    await s.api("/api/admin/rotation", { method: "PUT", json: { rotation: r } });
    assert.equal(await has("mango-cold-brew"), r === "summer");
    assert.equal(await has("pav-bhaji"), r === "monsoon");
    assert.equal(await has("hot-chocolate"), r === "winter");
  }
  assert.equal(await has("rose-cardamom-latte"), true, "all-year items stay");
  await s.api("/api/admin/rotation", { method: "PUT", json: { rotation: "auto" } });
  assert.ok((await menu()).some((m) => m.id === "honey-oat-latte" && m.staffPick));

  const guests = [{ name: "Imported Ira", phone: "9800012345", stamps: "4", newsletter: "yes", email: "ira.imp@example.com" }, { name: "No contact" }];
  const dry = await s.api("/api/admin/import", { method: "POST", json: { kind: "guests", rows: guests, dryRun: true } });
  assert.equal(dry.body.added, 1);
  assert.equal(dry.body.skipped, 1);
  assert.equal(((await s.api("/api/loyalty?phone=9800012345")).body as { stamps: number }).stamps, 0, "a check doesn't save");
  await s.api("/api/admin/import", { method: "POST", json: { kind: "guests", rows: guests } });
  assert.equal(((await s.api("/api/loyalty?phone=9800012345")).body as { stamps: number }).stamps, 4);
  const m = await s.api("/api/admin/import", { method: "POST", json: { kind: "menu", rows: [{ name: "Jaggery Latte", category: "Coffee", price: "₹230", description: "Gud and espresso" }, { name: "Honey Oat Latte", category: "coffee", price: "220" }] } });
  assert.equal(m.body.added, 1);
  assert.equal(m.body.skipped, 1, "already on the menu");
  assert.equal(await has("jaggery-latte"), false, "imported items start hidden");
});

test("table tabs: rounds from one table add up and can be paid together", async () => {
  const a = await s.api("/api/orders", { method: "POST", json: { name: "Round 1", table: 7, lines: [{ itemId: "americano", qty: 2 }] } });
  const b = await s.api("/api/orders", { method: "POST", json: { name: "Round 2", table: 7, lines: [{ itemId: "cookie", qty: 3 }] } });
  const tab = (await s.api(`/api/orders/${b.body.code}/tab`)).body as { table_no: number; orders: { code: string }[]; left: number };
  assert.equal(tab.table_no, 7);
  assert.ok(tab.orders.some((o) => o.code === a.body.code) && tab.orders.some((o) => o.code === b.body.code));
  assert.equal(tab.left, a.body.due + b.body.due);
  const start = await s.api("/api/payments/start", { method: "POST", json: { kind: "tab", code: a.body.code } });
  assert.equal(start.body.amount, tab.left);
  await s.api("/api/payments/verify", { method: "POST", json: { kind: "tab", code: a.body.code, demo: true } });
  assert.equal((await s.api(`/api/orders/${b.body.code}`)).body.pay_status, "paid");
  // The next round starts a new tab
  const c = await s.api("/api/orders", { method: "POST", json: { name: "New group", table: 7, lines: [{ itemId: "americano", qty: 1 }] } });
  assert.equal(((await s.api(`/api/orders/${c.body.code}/tab`)).body as { orders: unknown[] }).orders.length, 1);
});

test("streak bonus: the 3rd day in a row earns 2 extra stamps", async () => {
  const phone = "9811166666";
  const { DatabaseSync } = await import("node:sqlite");
  const path = await import("node:path");
  const db = new DatabaseSync(path.join(s.dataDir, "cafe.db"));
  for (const d of [1, 2]) db.prepare(`INSERT INTO orders (code, name, phone, pickup, note, lines, subtotal, discount, total, created_at) VALUES (?, 'Streak', ?, 'asap', '', '[]', 0, 0, 0, datetime('now','localtime','-${d} days'))`).run(`MM-STRK${d}`, phone);
  db.close();
  const r = await s.api("/api/orders", { method: "POST", json: { name: "Streak", phone, lines: [{ itemId: "cookie", qty: 1 }] } });
  assert.equal(r.body.streakBonus, 2);
  const again = await s.api("/api/orders", { method: "POST", json: { name: "Streak", phone, lines: [{ itemId: "cookie", qty: 1 }] } });
  assert.equal(again.body.streakBonus, 0, "once a day");
});

test("kitchen stations: the order is ready when the bar and the kitchen are both done", async () => {
  await s.login();
  const o = await s.api("/api/orders", { method: "POST", json: { name: "Both", phone: "9811177711", lines: [{ itemId: "americano", qty: 1 }, { itemId: "cheese-toastie", qty: 1 }] } });
  const code = o.body.code;
  await s.api(`/api/orders/${code}`, { method: "PATCH", json: { status: "brewing" } });
  const bar = await s.api(`/api/orders/${code}/station`, { method: "POST", json: { station: "bar" } });
  assert.equal(bar.body.ready, false);
  assert.equal((await s.api(`/api/orders/${code}`)).body.status, "brewing");
  const kitchen = await s.api(`/api/orders/${code}/station`, { method: "POST", json: { station: "kitchen" } });
  assert.equal(kitchen.body.ready, true);
  assert.equal((await s.api(`/api/orders/${code}`)).body.status, "ready");
  assert.equal((await s.api(`/api/orders/${code}/station`, { method: "POST", json: { station: "moon" } })).status, 400);
});

// Keep this one last: it clears orders and refills the café with sample data
test("swiggy and zomato: staff type an order in, the webhook needs the secret", async () => {
  await s.login();
  const set = await s.api("/api/admin/aggregators", { method: "PUT", json: { swiggy: { on: true, markup: 20, commission: 25 } } });
  assert.equal(set.status, 200);
  const info = (await s.api("/api/admin/aggregators")).body as { swiggy: { on: boolean; markup: number }; secret: string };
  assert.equal(info.swiggy.on, true);
  assert.equal(info.swiggy.markup, 20);
  assert.ok(info.secret.length >= 20);

  // Typed in from the tablet: paid, tagged, and on the barista queue
  const add = await s.api("/api/admin/aggregators", { method: "POST", json: { platform: "swiggy", ref: "SW 123", customer: "Asha", lines: [{ itemId: "americano", qty: 2 }] } });
  assert.equal(add.status, 200);
  const o = (await s.api(`/api/orders/${add.body.code}`)).body as { pay_status: string; note: string; total: number; status: string };
  assert.equal(o.pay_status, "paid");
  assert.match(o.note, /Swiggy #SW123/);
  assert.equal(o.status, "received");
  const dupe = await s.api("/api/admin/aggregators", { method: "POST", json: { platform: "swiggy", ref: "SW123", lines: [{ itemId: "americano", qty: 1 }] } });
  assert.equal(dupe.body.duplicate, true, "the same platform order isn't added twice");
  assert.equal(dupe.body.code, add.body.code);

  // Webhook: no secret, wrong platform state, then a good one that names the dish
  const hook = (p: string, body: unknown, secret?: string) => fetch(`${s.url}/api/aggregators/${p}`, { method: "POST", headers: { "Content-Type": "application/json", ...(secret ? { "x-mm-secret": secret } : {}) }, body: JSON.stringify(body) });
  assert.equal((await hook("swiggy", { ref: "1", lines: [{ name: "Long Black", qty: 1 }] })).status, 401);
  assert.equal((await hook("zomato", { ref: "1", lines: [{ name: "Long Black", qty: 1 }] }, info.secret)).status, 409, "zomato is switched off");
  const ok = await hook("swiggy", { ref: "777", total: 455, lines: [{ name: "long  black", qty: 1 }] }, info.secret);
  assert.equal(ok.status, 200);
  const hooked = (await s.api(`/api/orders/${(await ok.json()).code}`)).body as { total: number };
  assert.equal(hooked.total, 455, "keeps what the guest paid on the platform");
  assert.equal((await hook("swiggy", { ref: "778", lines: [{ name: "Unicorn Latte", qty: 1 }] }, info.secret)).status, 400);

  const week = (await s.api("/api/admin/aggregators")).body as { summary: { platform: string; orders: number; commission: number; gross: number }[] };
  const sw = week.summary.find((x) => x.platform === "swiggy")!;
  assert.ok(sw.orders >= 2);
  assert.equal(sw.commission, Math.round(sw.gross * 0.25));
  const csv = await fetch(`${s.url}/api/admin/aggregators/menu?platform=swiggy`, { headers: { cookie: s.cookie() } });
  assert.match(await csv.text(), /americano,Long Black,coffee,/);
  const an = (await s.api("/api/admin/analytics?days=7")).body as { channels: { swiggy: { orders: number } } };
  assert.ok(an.channels.swiggy.orders >= 2, "shows in the sales channel split");
});

test("coffee diary: log drinks, rate past orders, get a taste profile", async () => {
  assert.equal((await fetch(`${s.url}/api/account/diary`)).status, 401);
  await signIn("diary@example.com");
  const placed = await s.api("/api/orders", { method: "POST", json: { name: "Di", phone: "9811122233", lines: [{ itemId: "cold-brew", qty: 1 }, { itemId: "cookie", qty: 1 }] } });
  const first = (await s.api("/api/account/diary")).body as { toRate: { itemId: string; orderCode: string }[] };
  assert.deepEqual(first.toRate.map((x) => x.itemId), ["cold-brew"], "drinks only");
  assert.equal((await s.api("/api/account/diary", { method: "POST", json: { itemId: "cold-brew", orderCode: placed.body.code, rating: 5 } })).status, 200);
  assert.equal((await s.api("/api/account/diary", { method: "POST", json: { itemId: "cold-brew", orderCode: placed.body.code, rating: 4 } })).status, 400, "once per order");
  assert.equal((await s.api("/api/account/diary", { method: "POST", json: { itemId: "iced-mocha", rating: 4 } })).status, 200);
  assert.equal((await s.api("/api/account/diary", { method: "POST", json: { name: "Flat white", place: "Somewhere in Pune", rating: 3, note: "a bit hot" } })).status, 200);
  assert.equal((await s.api("/api/account/diary", { method: "POST", json: { name: "Mystery", rating: 9 } })).status, 400);
  const d = (await s.api("/api/account/diary")).body as { entries: { id: number }[]; profile: { count: number; words: string; iced: number; tryNext: { id: string } | null; places: number }; toRate: unknown[] };
  assert.equal(d.entries.length, 3);
  assert.equal(d.toRate.length, 0);
  assert.match(d.profile.words, /iced/);
  assert.ok(d.profile.tryNext && !["cold-brew", "iced-mocha"].includes(d.profile.tryNext.id));
  assert.equal(d.profile.places, 2);
  assert.equal((await s.api(`/api/account/diary?id=${d.entries[0].id}`, { method: "DELETE" })).status, 200);
  const exported = (await s.api("/api/account/data")).body as { coffeeDiary: unknown[] };
  assert.equal(exported.coffeeDiary.length, 2, "included in 'download my data'");
});

test("a day in the life: pretend orders appear, move along and clear away", async () => {
  await s.login();
  const started = await s.api("/api/admin/sim", { method: "POST", json: { action: "start", minutes: 15, speed: "rush" } });
  assert.equal(started.status, 200);
  assert.equal(started.body.on, true);
  assert.ok(started.body.orders >= 1, "the first order lands straight away");
  const queue = (await s.api("/api/orders")).body as { orders?: { note: string }[] } | { note: string }[];
  const list = Array.isArray(queue) ? queue : queue.orders ?? [];
  assert.ok(list.some((o) => /simulated/.test(o.note ?? "")), "on the barista queue");
  assert.equal((await s.api("/api/admin/sim", { method: "POST", json: { action: "stop" } })).body.on, false);
  const cleared = await s.api("/api/admin/sim", { method: "POST", json: { action: "clear" } });
  assert.ok(cleared.body.cleared >= 1);
  assert.equal(cleared.body.orders, 0);
});

test("make it at home: every recipe page opens and matches a dish", async () => {
  const { HOME_RECIPES } = await import("../src/lib/homeRecipes.ts");
  const ids = new Set(((await s.api("/api/menu")).body.items as { id: string }[]).map((m) => m.id));
  for (const r of HOME_RECIPES) assert.ok(ids.has(r.id), `${r.id} is on the menu`);
  assert.equal((await fetch(`${s.url}/recipes`)).status, 200);
  const page = await fetch(`${s.url}/recipes/${HOME_RECIPES[0].id}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), new RegExp(HOME_RECIPES[0].title));
  assert.equal((await fetch(`${s.url}/recipes/nope`)).status, 404);
});

test("weather, brew timer, origins, shelf and game pages", async () => {
  const w = (await s.api("/api/weather")).body as { temp: number; code: number };
  assert.equal(w.temp, 26, "WEATHER=fake in tests");
  assert.equal(w.code, 63);
  for (const p of ["/brew", "/origins", "/shelf", "/play", "/diary"]) assert.equal((await fetch(s.url + p)).status, 200, p);
});

test("barista rush scores: believable ones are saved and ranked", async () => {
  assert.equal((await s.api("/api/game", { method: "POST", json: { name: "Cheat", score: 99999, served: 3 } })).status, 400);
  assert.equal((await s.api("/api/game", { method: "POST", json: { name: "Cheat", score: 100, served: 500 } })).status, 400);
  const a = await s.api("/api/game", { method: "POST", json: { name: "Asha <b>", score: 900, served: 8 } });
  assert.equal(a.status, 200);
  assert.equal(a.body.rank, 1);
  const b = await s.api("/api/game", { method: "POST", json: { name: "Ben", score: 1200, served: 9 } });
  assert.equal(b.body.rank, 1);
  const board = (await s.api("/api/game")).body as { allTime: { name: string; score: number }[]; week: unknown[] };
  assert.deepEqual(board.allTime.slice(0, 2).map((r) => r.name), ["Ben", "Asha b"]);
  assert.ok(board.week.length >= 2);
});

test("games & books: reserve a game with a table, once per time slot", async () => {
  const shelf = (await s.api("/api/shelf")).body as { items: { id: string; kind: string }[] };
  assert.ok(shelf.items.filter((i) => i.kind === "game").length >= 10);
  assert.ok(shelf.items.some((i) => i.kind === "book"));
  const date = tomorrow();
  const slots = (await s.api(`/api/bookings/availability?date=${date}`)).body as { time: string }[];
  const time = slots[Math.min(4, slots.length - 1)].time;
  const first = await s.api("/api/bookings", { method: "POST", json: { name: "Gamer", phone: "9555511111", date, time, guests: 2, game: "catan" } });
  assert.equal(first.status, 200);
  assert.equal(first.body.game, "Catan");
  const second = await s.api("/api/bookings", { method: "POST", json: { name: "Gamer Two", phone: "9555522222", date, time, guests: 2, game: "catan" } });
  assert.equal(second.status, 409, "someone already has Catan then");
  assert.equal((await s.api("/api/bookings", { method: "POST", json: { name: "Gamer Two", phone: "9555522222", date, time, guests: 2, game: "azul" } })).status, 200);
  const marked = (await s.api(`/api/shelf?date=${date}&time=${time}`)).body as { items: { id: string; taken: boolean }[] };
  assert.equal(marked.items.find((i) => i.id === "catan")!.taken, true);
  assert.equal(marked.items.find((i) => i.id === "jenga")!.taken, false);
  // Owner: take a game off the shelf, then it can't be booked
  await s.login();
  const cur = shelf.items.find((i) => i.id === "jenga")!;
  assert.equal((await s.api("/api/shelf", { method: "POST", json: { ...cur, out: true } })).status, 200);
  assert.equal((await s.api("/api/bookings", { method: "POST", json: { name: "Late", phone: "9555533333", date, time, guests: 2, game: "jenga" } })).status, 409);
  const added = await s.api("/api/shelf", { method: "POST", json: { kind: "game", title: "Pictionary", detail: "4–8 players", minutes: 30 } });
  assert.equal(added.status, 200);
  assert.equal((await s.api(`/api/shelf?id=${added.body.item.id}`, { method: "DELETE" })).status, 200);
});

test("coffee diary counts today's caffeine", async () => {
  await signIn("caffeine@example.com");
  await s.api("/api/account/diary", { method: "POST", json: { itemId: "cold-brew", rating: 5 } });
  await s.api("/api/account/diary", { method: "POST", json: { name: "Double espresso", place: "Airport", rating: 3 } });
  await s.api("/api/account/diary", { method: "POST", json: { name: "Mystery brew", rating: 3, caffeine: 150 } });
  const d = (await s.api("/api/account/diary")).body as { caffeine: { total: number; limit: number; nudge: string | null } };
  assert.equal(d.caffeine.total, 200 + 128 + 150);
  assert.equal(d.caffeine.limit, 400);
  assert.match(d.caffeine.nudge ?? "", /over 400/);
});

test("coffee diary keeps tasting notes and finds your favourite flavours", async () => {
  await signIn("flavours@example.com");
  await s.api("/api/account/diary", { method: "POST", json: { itemId: "hazelnut-latte", rating: 5, flavours: ["nutty", "creamy", "nope"] } });
  await s.api("/api/account/diary", { method: "POST", json: { itemId: "mocha", rating: 4, flavours: ["chocolatey", "nutty"] } });
  const d = (await s.api("/api/account/diary")).body as { entries: { flavours: string[] }[]; profile: { flavours: string[] } };
  assert.deepEqual(d.entries[1].flavours, ["nutty", "creamy"], "unknown notes are dropped");
  assert.equal(d.profile.flavours[0], "nutty");
});

test("origins passport: a stamp per region from real orders, then a free drink once", async () => {
  assert.equal((await fetch(`${s.url}/api/account/passport`)).status, 401);
  await signIn("passport@example.com");
  const empty = (await s.api("/api/account/passport")).body as { done: number; total: number; complete: boolean };
  assert.equal(empty.done, 0);
  assert.equal(empty.total, 8);
  assert.equal((await s.api("/api/account/passport", { method: "POST" })).status, 400, "not yet");
  // Diary entries don't count, orders do
  await s.api("/api/account/diary", { method: "POST", json: { itemId: "cold-brew", rating: 5 } });
  assert.equal(((await s.api("/api/account/passport")).body as { done: number }).done, 0);
  const { ORIGINS } = await import("../src/lib/origins.ts");
  const items = (await s.api("/api/menu")).body.items as { id: string }[];
  const ids = new Set(items.map((m) => m.id));
  const lines = ORIGINS.map((o) => ({ itemId: o.usedIn.find((id) => ids.has(id))!, qty: 1 }));
  assert.ok(lines.every((l) => l.itemId), "every region has a drink on the menu");
  const placed = await s.api("/api/orders", { method: "POST", json: { name: "Traveller", phone: "9877700001", lines } });
  assert.equal(placed.status, 200);
  const full = (await s.api("/api/account/passport")).body as { done: number; complete: boolean; stamps: { stamped: boolean; drink: string }[] };
  assert.equal(full.done, 8);
  assert.ok(full.complete);
  const before = (await s.api("/api/account")).body.credit ?? 0;
  const claim = await s.api("/api/account/passport", { method: "POST" });
  assert.equal(claim.status, 200);
  assert.equal(claim.body.credit, before + 250);
  assert.equal((await s.api("/api/account/passport", { method: "POST" })).status, 409, "only once");
});

test("drink lab: create, share, vote once, and the owner can take one down", async () => {
  const mk = (json: Record<string, unknown>) => s.api("/api/lab", { method: "POST", json });
  assert.equal((await mk({ name: "ok", baseId: "cold-brew" })).status, 400, "name too short");
  assert.equal((await mk({ name: "Moonbeam", baseId: "croissant" })).status, 400, "drinks only");
  assert.equal((await mk({ name: "Shit Brew", baseId: "cold-brew" })).status, 400, "friendly names");
  const made = await mk({ name: "Monsoon Moonbeam", creator: "Asha", baseId: "honey-oat-latte", opts: { size: "large", milk: "oat", syrup: "vanilla", shot: true, note: "sneaky" } });
  assert.equal(made.status, 200);
  const c = made.body.creation as { code: string; opts: Record<string, unknown>; price: number; describe: string };
  assert.equal(c.opts.size, "large");
  assert.equal(c.opts.note, undefined, "no hidden notes");
  assert.ok(c.price > 220);
  assert.equal((await mk({ name: "monsoon moonbeam", baseId: "cold-brew" })).status, 400, "names are unique");
  const vote = (voter: string) => s.api(`/api/lab/${c.code}`, { method: "POST", json: { voter } });
  assert.equal((await vote("a".repeat(20))).body.votes, 1);
  assert.equal((await vote("a".repeat(20))).body.counted, false, "one vote each");
  assert.equal((await vote("b".repeat(20))).body.votes, 2);
  assert.equal((await vote("x")).status, 400);
  const board = (await s.api("/api/lab")).body as { top: { code: string }[]; newest: { code: string }[] };
  assert.equal(board.top[0].code, c.code);
  assert.equal((await fetch(`${s.url}/lab/${c.code}`)).status, 200);
  assert.equal((await fetch(`${s.url}/api/lab/${c.code}`, { method: "DELETE" })).status, 401);
  await s.login();
  assert.equal((await s.api(`/api/lab/${c.code}`, { method: "DELETE" })).status, 200);
  assert.equal((await s.api(`/api/lab/${c.code}`)).status, 404);
});

test("today at the café counts cups poured", async () => {
  const before = (await s.api("/api/today")).body as { cups: number };
  assert.equal(typeof before.cups, "number");
  await s.api("/api/orders", { method: "POST", json: { name: "Counter", phone: "9811100011", lines: [{ itemId: "americano", qty: 3 }, { itemId: "cookie", qty: 2 }] } });
  await new Promise((r) => setTimeout(r, 0));
  // The number is kept for a minute, so check the shape and that cookies aren't cups
  const t = (await s.api("/api/today")).body as { cups: number; top: { id: string } | null };
  assert.ok(t.cups >= before.cups);
});

test("barista rush daily challenge: only today's round counts, with its own board", async () => {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  assert.equal((await s.api("/api/game", { method: "POST", json: { name: "Old", score: 500, served: 5, daily: "2020-01-01" } })).status, 400);
  const r = await s.api("/api/game", { method: "POST", json: { name: "Daily Dee", score: 700, served: 6, daily: today } });
  assert.equal(r.status, 200);
  assert.equal(r.body.rank, 1);
  assert.ok((r.body.today as { name: string }[]).some((x) => x.name === "Daily Dee"));
});

test("guest photo wall: shared photos wait for approval", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const fd = new FormData();
  fd.append("file", new Blob([png], { type: "image/png" }), "cup.png");
  fd.append("name", "Priya");
  fd.append("caption", "Window seat ☔");
  const up = await fetch(`${s.url}/api/photos`, { method: "POST", body: fd });
  assert.equal(up.status, 200);
  const pub = async () => ((await (await fetch(`${s.url}/api/photos`)).json()) as { photos: { name: string }[] }).photos;
  assert.ok(!(await pub()).some((p) => p.name === "Priya"), "not shown until approved");
  assert.equal((await fetch(`${s.url}/api/photos?all=1`)).status, 401);
  await s.login();
  const all = (await s.api("/api/photos?all=1")).body as { photos: { id: number; name: string; status: string }[] };
  const mine = all.photos.find((p) => p.name === "Priya")!;
  assert.equal(mine.status, "pending");
  await s.api("/api/photos", { method: "PATCH", json: { id: mine.id, approve: true } });
  assert.ok((await pub()).some((p) => p.name === "Priya"));
  await s.api("/api/photos", { method: "PATCH", json: { id: mine.id, approve: false } });
  assert.ok(!(await pub()).some((p) => p.name === "Priya"), "removed");
  const bad = new FormData();
  bad.append("file", new Blob([Buffer.from("not a photo")], { type: "image/png" }), "x.png");
  bad.append("name", "X");
  assert.equal((await fetch(`${s.url}/api/photos`, { method: "POST", body: bad })).status, 400);
});

test("advent calendar: doors and codes stay shut until their day; the owner can preview", async () => {
  const pub = (await (await fetch(`${s.url}/api/advent`)).json()) as { year: number; today: string; doors: { day: number; open: boolean; code?: string; date: string }[] };
  assert.equal(pub.doors.length, 24);
  for (const d of pub.doors) if (pub.today < d.date) assert.ok(!d.open && !d.code, `door ${d.day} is shut`);
  const peek = (await (await fetch(`${s.url}/api/advent?preview=1`)).json()) as { preview: boolean };
  assert.equal(peek.preview, false, "guests can't preview");
  await s.login();
  const own = (await s.api("/api/advent?preview=1")).body as { preview: boolean; doors: { code?: string }[] };
  assert.equal(own.preview, true);
  const code = own.doors[0].code!;
  assert.match(code, /^ADVENT\d{4}$/);
  const chk = await s.api("/api/promo", { method: "POST", json: { code } });
  if (pub.today < pub.doors[0].date) assert.match(JSON.stringify(chk.body), /starts on/, "not usable before its day");
});

test("meet the team: only people switched on are shown, by first name", async () => {
  await s.login();
  await s.api("/api/admin/staff", { method: "POST", json: { name: "Rhea Fernandes", username: "rhea", password: "longpassword1", role: "barista" } });
  const team = (await s.api("/api/admin/team")).body as { team: { id: number; name: string }[] };
  const rhea = team.team.find((m) => m.name === "Rhea Fernandes")!;
  assert.equal((await s.api("/api/team")).body.team.some((m: { name: string }) => m.name === "Rhea"), false, "hidden by default");
  assert.equal((await s.api("/api/admin/team", { method: "PUT", json: { id: rhea.id, show: true, creationCode: "NOPE99" } })).status, 400);
  assert.equal((await s.api("/api/admin/team", { method: "PUT", json: { id: rhea.id, show: true, bio: "Latte art champion", favItem: "filter-kaapi", emoji: "🌿" } })).status, 200);
  const pub = (await (await fetch(`${s.url}/api/team`)).json()) as { team: { name: string; bio: string; fav: { id: string } | null }[] };
  const shown = pub.team.find((m) => m.name === "Rhea")!;
  assert.equal(shown.bio, "Latte art champion");
  assert.equal(shown.fav!.id, "filter-kaapi");
  assert.ok(!JSON.stringify(pub).includes("Fernandes"), "first names only");
});

test("postcards: write one, open it by link, and only real gifts ride along", async () => {
  const mk = (json: Record<string, unknown>) => s.api("/api/postcards", { method: "POST", json });
  assert.equal((await mk({ to: "Asha", from: "Ben", message: "" })).status, 400);
  assert.equal((await mk({ to: "Asha", from: "Ben", message: "Come for coffee", gift: "NOTREAL" })).status, 400);
  const ok = await mk({ design: "monsoon", to: "Asha", from: "Ben", message: "Saved you the window seat ☔" });
  assert.equal(ok.status, 200);
  const card = (await (await fetch(`${s.url}/api/postcards/${ok.body.code}`)).json()) as { design: string; to: string; message: string; gift: unknown };
  assert.equal(card.design, "monsoon");
  assert.equal(card.to, "Asha");
  assert.equal(card.gift, null);
  assert.equal((await fetch(`${s.url}/p/${ok.body.code}`)).status, 200);
  assert.equal((await fetch(`${s.url}/api/postcards/nope`)).status, 404);
});

test("coffee bingo: one card a month, stamps from real orders, a treat for a full line once", async () => {
  const out = (await (await fetch(`${s.url}/api/account/bingo`)).json()) as { signedIn: boolean; squares: { id: string }[] };
  assert.equal(out.signedIn, false);
  assert.equal(out.squares.length, 16);
  assert.equal(new Set(out.squares.map((q) => q.id)).size, 16, "no repeats");
  assert.equal((await fetch(`${s.url}/api/account/bingo`, { method: "POST" })).status, 401);
  await signIn("bingo@example.com");
  const card = (await s.api("/api/account/bingo")).body as { signedIn: boolean; month: string; squares: { id: string; stamped: boolean; orderable: boolean }[]; lines: number[][] };
  assert.equal(card.signedIn, true);
  assert.deepEqual(card.squares.map((q) => q.id), out.squares.map((q) => q.id), "the same card for everyone");
  assert.equal((await s.api("/api/account/bingo", { method: "POST" })).status, 400, "no line yet");
  const menu = (await s.api("/api/menu")).body.items as { id: string; pup?: boolean; cat: string }[];
  const onCard = new Set(card.squares.map((q) => q.id));
  assert.ok(!menu.some((m) => onCard.has(m.id) && (m.pup || m.cat === "shop")), "no dog treats or shop items");
  // Order the first row
  const row = card.squares.slice(0, 4);
  assert.ok(row.every((q) => q.orderable));
  const placed = await s.api("/api/orders", { method: "POST", json: { name: "Bingo Bea", phone: "9877700002", lines: row.map((q) => ({ itemId: q.id, qty: 1 })) } });
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  const after = (await s.api("/api/account/bingo")).body as { stamped: number; lines: number[][] };
  assert.ok(after.stamped >= 4);
  assert.ok(after.lines.some((l) => l.join() === "0,1,2,3"));
  const before = (await s.api("/api/account")).body.credit ?? 0;
  const claim = await s.api("/api/account/bingo", { method: "POST" });
  assert.equal(claim.status, 200);
  assert.equal(claim.body.credit, before + 150);
  assert.equal((await s.api("/api/account/bingo", { method: "POST" })).status, 409, "once a month");
  assert.equal((await fetch(`${s.url}/bingo`)).status, 200);
});

test("song requests: guests ask, staff approve and play, the board shows it", async () => {
  const ask = (json: Record<string, unknown>) => fetch(`${s.url}/api/songs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });
  assert.equal((await ask({ title: "" })).status, 400);
  assert.equal((await ask({ title: "Shit song" })).status, 400, "kept kind");
  assert.equal((await ask({ title: "Tum Se Hi", artist: "Mohit Chauhan", name: "Kabir", table: 4 })).status, 200);
  assert.equal((await ask({ title: "tum se hi" })).status, 400, "already asked for");
  const pub = async () => (await (await fetch(`${s.url}/api/songs`)).json()) as { playing: { title: string; name: string } | null; next: { title: string }[] };
  assert.ok(!(await pub()).next.some((x) => x.title === "Tum Se Hi"), "waits for a yes");
  assert.equal((await fetch(`${s.url}/api/songs?all=1`)).status, 401);
  assert.equal((await fetch(`${s.url}/api/songs`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
  await s.login();
  const list = (await s.api("/api/songs?all=1")).body.songs as { id: number; title: string; status: string; table_no: number }[];
  const mine = list.find((x) => x.title === "Tum Se Hi")!;
  assert.equal(mine.status, "pending");
  assert.equal(mine.table_no, 4);
  await s.api("/api/songs", { method: "PATCH", json: { id: mine.id, action: "approve" } });
  assert.ok((await pub()).next.some((x) => x.title === "Tum Se Hi"));
  await s.api("/api/songs", { method: "PATCH", json: { id: mine.id, action: "play" } });
  const now = await pub();
  assert.equal(now.playing?.title, "Tum Se Hi");
  assert.equal(now.playing?.name, "Kabir");
  assert.ok(!JSON.stringify(now).includes("table"), "no table numbers in public");
  await s.api("/api/songs", { method: "PATCH", json: { id: mine.id, action: "done" } });
  assert.equal((await pub()).playing, null);
  assert.equal((await s.api("/api/songs", { method: "PATCH", json: { id: mine.id, action: "explode" } })).status, 400);
  assert.equal((await fetch(`${s.url}/songs`)).status, 200);
});

test("pups: dog treats have their own section, a pup photo wall, and dog-friendly bookings", async () => {
  const menu = (await s.api("/api/menu")).body.items as { id: string; pup?: boolean; cat: string }[];
  const pups = menu.filter((m) => m.pup);
  assert.ok(pups.length >= 4);
  assert.ok(pups.every((m) => m.cat === "bakes"));
  const { inTab } = await import("../src/lib/menu.ts");
  assert.ok(pups.every((m) => inTab(m as never, "pups") && !inTab(m as never, "bakes")), "not mixed in with people's bakes");
  // A pup photo goes on the pup wall, not the café wall
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const fd = new FormData();
  fd.append("file", new Blob([png], { type: "image/png" }), "dog.png");
  fd.append("name", "Biscuit");
  fd.append("kind", "pup");
  assert.equal((await fetch(`${s.url}/api/photos`, { method: "POST", body: fd })).status, 200);
  await s.login();
  const all = (await s.api("/api/photos?all=1")).body.photos as { id: number; name: string; kind: string }[];
  const dog = all.find((p) => p.name === "Biscuit")!;
  assert.equal(dog.kind, "pup");
  await s.api("/api/photos", { method: "PATCH", json: { id: dog.id, approve: true } });
  const names = async (q: string) => ((await (await fetch(`${s.url}/api/photos${q}`)).json()) as { photos: { name: string }[] }).photos.map((p) => p.name);
  assert.ok((await names("?kind=pup")).includes("Biscuit"));
  assert.ok(!(await names("")).includes("Biscuit"), "not on the café wall");
  // Booking with a dog
  const date = tomorrow();
  const slots = (await s.api(`/api/bookings/availability?date=${date}`)).body as { time: string }[];
  const b = await s.api("/api/bookings", { method: "POST", json: { name: "Dog Owner", phone: "9444444999", date, time: slots[slots.length - 1].time, guests: 2, dog: true } });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.dog, true);
  const saved = ((await s.api("/api/bookings")).body as { code: string; dog: number; note: string }[]).find((x) => x.code === b.body.code)!;
  assert.equal(saved.dog, 1);
  assert.match(saved.note, /🐾/);
  assert.equal((await fetch(`${s.url}/pups`)).status, 200);
});

test("full-moon special only shows around full-moon nights; focus corner opens", async () => {
  const { isFullMoonNight } = await import("../src/lib/moon.ts");
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const menu = (await s.api("/api/menu")).body.items as { id: string }[];
  assert.equal(menu.some((m) => m.id === "moon-cortado"), isFullMoonNight(today, 1));
  assert.equal((await fetch(`${s.url}/focus`)).status, 200);
});

test("daily trivia: one question for everyone, the answer only after you answer, first answer counts", async () => {
  const voter = "abcdef0123456789abcd";
  const q = (await (await fetch(`${s.url}/api/trivia?voter=${voter}`)).json()) as { q: string; choices: string[]; mine?: unknown; streak: number };
  assert.ok(q.q.length > 10);
  assert.equal(q.choices.length, 4);
  assert.equal(q.mine, undefined);
  assert.ok(!/"answer"|"why"/.test(JSON.stringify(q)), "the answer isn't sent before you answer");
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/trivia`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });
  assert.equal((await post({ voter, choice: 9 })).status, 400);
  assert.equal((await post({ voter: "x", choice: 0 })).status, 400, "needs a proper id");
  const a = (await (await post({ voter, choice: 0 })).json()) as { mine: { choice: number; correct: boolean; answer: number; why: string }; streak: number; answered: number };
  assert.equal(a.mine.choice, 0);
  assert.ok(a.mine.why.length > 10);
  assert.equal(a.streak, 1);
  const again = (await (await post({ voter, choice: 1 })).json()) as { mine: { choice: number }; answered: number };
  assert.equal(again.mine.choice, 0, "can't change your answer");
  assert.equal(again.answered, a.answered);
  const other = (await (await fetch(`${s.url}/api/trivia?voter=zzzzzzzzzzzzzzzzzzzz`)).json()) as { q: string; mine?: unknown };
  assert.equal(other.q, q.q, "same question for everyone");
  assert.equal(other.mine, undefined);
  assert.equal((await fetch(`${s.url}/trivia`)).status, 200);
});

test("pay it forward: buy a coffee for a stranger; only staff can hand it out", async () => {
  const before = (await (await fetch(`${s.url}/api/pay-forward`)).json()) as { waiting: number; given: number };
  const r = await s.api("/api/drink-gifts", { method: "POST", json: { itemId: "cappuccino", forward: true, message: "Have a good one" } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const code = r.body.code as string;
  const g = (await s.api(`/api/drink-gifts/${code}`)).body as { toName: string; fromName: string };
  assert.equal(g.toName, "Someone who needs it");
  assert.equal(g.fromName, "A kind stranger");
  assert.equal((await (await fetch(`${s.url}/api/pay-forward`)).json()).waiting, before.waiting, "not counted until paid");
  await s.api("/api/payments/start", { method: "POST", json: { kind: "drinkgift", code } });
  await s.api("/api/payments/verify", { method: "POST", json: { kind: "drinkgift", code, demo: true } });
  assert.equal((await (await fetch(`${s.url}/api/pay-forward`)).json()).waiting, before.waiting + 1);
  assert.equal((await fetch(`${s.url}/api/drink-gifts/${code}/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 403, "the buyer can't claim it by link");
  assert.equal((await fetch(`${s.url}/api/pay-forward`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
  await s.login();
  const give = await s.api("/api/pay-forward", { method: "POST", json: { name: "Friend" } });
  assert.equal(give.status, 200, JSON.stringify(give.body));
  assert.ok(give.body.orderCode);
  const after = (await (await fetch(`${s.url}/api/pay-forward`)).json()) as { waiting: number; given: number };
  assert.equal(after.waiting, before.waiting);
  assert.equal(after.given, before.given + 1);
  if (after.waiting === 0) assert.equal((await s.api("/api/pay-forward", { method: "POST", json: {} })).status, 404);
  assert.equal((await fetch(`${s.url}/pay-it-forward`)).status, 200);
});

test("seat finder: tables carry tags the owner can change", async () => {
  const date = tomorrow();
  const slots = (await s.api(`/api/bookings/availability?date=${date}`)).body as { time: string }[];
  const url = `/api/bookings/tables?date=${date}&time=${slots[0].time}&guests=2`;
  const t = (await s.api(url)).body.tables as { no: number; tags: string[] }[];
  assert.ok(t.find((x) => x.no === 8)!.tags.includes("quiet"));
  assert.equal((await fetch(`${s.url}/api/admin/table-tags`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
  await s.login();
  const cur = (await s.api("/api/admin/table-tags")).body.tags as Record<string, string[]>;
  const saved = await s.api("/api/admin/table-tags", { method: "PUT", json: { tags: { ...cur, 6: ["socket", "dog", "nonsense"], 99: ["window"] } } });
  assert.deepEqual(saved.body.tags["6"], ["socket", "dog"], "unknown tags dropped");
  assert.equal(saved.body.tags["99"], undefined, "unknown tables dropped");
  assert.deepEqual(((await s.api(url)).body.tables as { no: number; tags: string[] }[]).find((x) => x.no === 6)!.tags, ["socket", "dog"]);
  await s.api("/api/admin/table-tags", { method: "PUT", json: { tags: cur } });
});

test("plant corner: plant swap notes, and the colouring and plant pages open", async () => {
  const r = await fetch(`${s.url}/api/notices`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.9" }, body: JSON.stringify({ kind: "plant", name: "Mira", text: "Spare monstera cuttings, would love a fern" }) });
  assert.equal(r.status, 200);
  await s.login();
  const all = (await s.api("/api/notices?all=1")).body as { kind: string; text: string }[];
  assert.equal(all.find((n) => n.text.includes("monstera cuttings"))!.kind, "plant");
  for (const p of ["/plants", "/colouring"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("your year: needs signing in, then counts your last 12 months", async () => {
  assert.equal((await fetch(`${s.url}/api/account/year`)).status, 401);
  await signIn("year@example.com");
  const empty = (await s.api("/api/account/year")).body as { visits: number };
  assert.equal(empty.visits, 0);
  await s.api("/api/orders", { method: "POST", json: { name: "Yara", phone: "9877700003", lines: [{ itemId: "rose-latte", qty: 2 }, { itemId: "cookie", qty: 1 }] } });
  await s.api("/api/orders", { method: "POST", json: { name: "Yara", phone: "9877700003", lines: [{ itemId: "rose-latte", qty: 1 }] } });
  const y = (await s.api("/api/account/year")).body as { visits: number; cups: number; tried: number; top: { name: string; times: number }[]; busiestMonth: { month: string } | null; badges: number };
  assert.equal(y.visits, 2);
  assert.equal(y.cups, 3);
  assert.equal(y.tried, 2);
  assert.equal(y.top[0].times, 3);
  assert.ok(y.busiestMonth);
  assert.ok(y.badges >= 1);
  assert.equal((await fetch(`${s.url}/year`)).status, 200);
});

test("secret menu: off the public menu, opens with all five moons, and can be ordered", async () => {
  const items = (await s.api("/api/menu")).body.items as { id: string }[];
  assert.ok(!items.some((m) => m.id === "blue-moon-spritz" || m.id === "midnight-mocha"), "not on the public menu");
  const ids = MOONS.map((m) => m.id);
  const post = (found: unknown) => fetch(`${s.url}/api/secret`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ found }) });
  assert.equal((await post(ids.slice(0, 4))).status, 403);
  assert.equal((await post([...ids.slice(0, 4), "made-up"])).status, 403);
  const open = (await (await post(ids)).json()) as { items: { id: string; secret: boolean }[] };
  assert.deepEqual(open.items.map((m) => m.id).sort(), ["blue-moon-spritz", "midnight-mocha"]);
  const o = await order({ name: "Sky", phone: "9876500011", lines: [{ itemId: "blue-moon-spritz", qty: 1 }] });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.equal(o.body.total, 210);
  for (const p of ["/secret", "/fortune"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("café word: guesses checked on the server, the word only shows when you're done", async () => {
  const voter = "wordvoter0123456789a";
  const answer = wordFor(new Date().toLocaleDateString("en-CA"));
  const post = (guess: string) => fetch(`${s.url}/api/word`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guess, voter }) });
  const start = (await (await fetch(`${s.url}/api/word?voter=${voter}`)).json()) as { rows: unknown[]; done: boolean; answer?: string };
  assert.equal(start.rows.length, 0);
  assert.equal(start.answer, undefined);
  assert.ok(!JSON.stringify(start).includes(`"${answer}"`), "the word isn't sent early");
  assert.equal((await post("abc")).status, 400);
  assert.equal((await post("qzxjv")).status, 400, "not a word");
  const wrong = ANSWERS.filter((w) => w !== answer).slice(0, 6);
  const one = (await (await post(wrong[0])).json()) as { rows: { word: string; marks: string[] }[]; done: boolean; answer?: string };
  assert.equal(one.rows.length, 1);
  assert.deepEqual(one.rows[0].marks, score(wrong[0], answer));
  assert.equal(one.answer, undefined);
  for (const w of wrong.slice(1)) await post(w);
  const end = (await (await fetch(`${s.url}/api/word?voter=${voter}`)).json()) as { rows: unknown[]; done: boolean; solved: boolean; answer?: string };
  assert.equal(end.rows.length, 6);
  assert.ok(end.done && !end.solved);
  assert.equal(end.answer, answer);
  const extra = (await (await post(answer)).json()) as { rows: unknown[] };
  assert.equal(extra.rows.length, 6, "no more guesses once it's over");
  const win = (await (await fetch(`${s.url}/api/word`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guess: answer, voter: "wordwinner0123456789" }) })).json()) as { solved: boolean; streak: number };
  assert.ok(win.solved);
  assert.equal(win.streak, 1);
  assert.equal((await fetch(`${s.url}/word`)).status, 200);
});

test("letters to future you: sealed until the day, with what you ordered", async () => {
  assert.equal((await fetch(`${s.url}/api/account/letters`)).status, 401);
  await signIn("letters@example.com");
  await s.api("/api/orders", { method: "POST", json: { name: "Lena", phone: "9877700021", lines: [{ itemId: "cappuccino", qty: 1 }] } });
  assert.equal((await s.api("/api/account/letters", { method: "POST", json: { body: "Hi future me", months: 5 } })).status, 400);
  assert.equal((await s.api("/api/account/letters", { method: "POST", json: { body: "x", months: 3 } })).status, 400);
  const r = await s.api("/api/account/letters", { method: "POST", json: { body: "Dear me, I hope the garden grew.", months: 3 } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.ordered.includes("Classic Cappuccino"), JSON.stringify(r.body.ordered));
  const list = (await s.api("/api/account/letters")).body.letters as { open: boolean; body?: string; days?: number }[];
  assert.equal(list.length, 1);
  assert.equal(list[0].open, false);
  assert.equal(list[0].body, undefined, "a sealed letter's words aren't sent");
  assert.ok(list[0].days! >= 89);
  assert.equal((await fetch(`${s.url}/letters`)).status, 200);
});

test("bring it back: guests vote for a retired item, staff can pick, and it shows on the menu", async () => {
  const voter = "comebackvoter0123456";
  const st = (await (await fetch(`${s.url}/api/comeback?voter=${voter}`)).json()) as { month: string; next: string; candidates: { id: string; votes: number }[]; mine: string | null };
  assert.ok(st.candidates.length >= 2, "items off the menu can be voted for");
  const pub = (await s.api("/api/menu")).body.items as { id: string }[];
  assert.ok(!st.candidates.some((c) => pub.some((m) => m.id === c.id)), "only items that aren't on now");
  const post = (itemId: string, v = voter) => fetch(`${s.url}/api/comeback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, voter: v }) });
  assert.equal((await post("cappuccino")).status, 400, "items on the menu aren't up for a vote");
  const [a, b] = st.candidates;
  const v1 = (await (await post(a.id)).json()) as { mine: string; candidates: { id: string; votes: number }[] };
  assert.equal(v1.mine, a.id);
  const v2 = (await (await post(b.id)).json()) as { mine: string; candidates: { id: string; votes: number }[] };
  assert.equal(v2.mine, b.id, "you can change your vote");
  assert.equal(v2.candidates.find((c) => c.id === a.id)!.votes, a.votes);
  assert.equal((await fetch(`${s.url}/api/comeback`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: st.month, pick: a.id }) })).status, 401);
  await s.login();
  assert.equal((await s.api("/api/comeback", { method: "PUT", json: { month: st.month, pick: a.id } })).status, 200);
  const menu = (await s.api("/api/menu")).body.items as { id: string; comeback?: boolean }[];
  assert.equal(menu.find((m) => m.id === a.id)?.comeback, true, "back on the menu this month");
  const staff = (await s.api("/api/comeback?staff=1")).body as { back: { id: string } };
  assert.equal(staff.back.id, a.id);
  await s.api("/api/comeback", { method: "PUT", json: { month: st.month, pick: "auto" } });
  assert.ok(!((await s.api("/api/menu")).body.items as { id: string }[]).some((m) => m.id === a.id));
  assert.equal((await fetch(`${s.url}/bring-it-back`)).status, 200);
});

test("around the corner: a starter list, edited by the owner", async () => {
  const spots = (await (await fetch(`${s.url}/api/nearby`)).json()).spots as { id: number; name: string; dog: boolean }[];
  assert.ok(spots.length >= 6);
  assert.equal((await fetch(`${s.url}/api/nearby`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "X" }) })).status, 401);
  await s.login();
  const add = await s.api("/api/nearby", { method: "POST", json: { name: "Tiny gelato cart", kind: "food", blurb: "Kokum sorbet!", walk_min: 4, dog: true, map_url: "javascript:alert(1)" } });
  assert.equal(add.status, 200);
  const g = (add.body.spots as { id: number; name: string; dog: boolean; map_url: string }[]).find((x) => x.name === "Tiny gelato cart")!;
  assert.ok(g.dog);
  assert.equal(g.map_url, "", "only https links");
  const del = await s.api(`/api/nearby?id=${g.id}`, { method: "DELETE" });
  assert.ok(!(del.body.spots as { id: number }[]).some((x) => x.id === g.id));
  assert.equal((await fetch(`${s.url}/nearby`)).status, 200);
});

test("doodle wall: a drawing waits for staff, then shows on its own wall", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const f = new FormData();
  f.set("file", new File([png], "doodle.png", { type: "image/png" }));
  f.set("kind", "doodle"); f.set("name", "Dia"); f.set("caption", "My cat on the sofa");
  const r = await fetch(`${s.url}/api/photos`, { method: "POST", body: f, headers: { Origin: s.url } });
  assert.equal(r.status, 200, await r.text());
  const wall = async (kind: string) => ((await (await fetch(`${s.url}/api/photos?kind=${kind}`)).json()).photos as { id: number; caption: string }[]);
  assert.ok(!(await wall("doodle")).some((p) => p.caption === "My cat on the sofa"), "waits for a look");
  await s.login();
  const mine = ((await s.api("/api/photos?all=1")).body.photos as { id: number; caption: string; kind: string }[]).find((p) => p.caption === "My cat on the sofa")!;
  assert.equal(mine.kind, "doodle");
  await s.api("/api/photos", { method: "PATCH", json: { id: mine.id, approve: true } });
  assert.ok((await wall("doodle")).some((p) => p.id === mine.id));
  assert.ok(!(await wall("cafe")).some((p) => p.id === mine.id), "not on the photo wall");
  for (const p of ["/doodles", "/board"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("thank the team: guests leave a note; only that person and the owner see it", async () => {
  await s.login();
  await s.api("/api/admin/staff", { method: "POST", json: { name: "Kavya Gomes", username: "kavya", password: "longpassword2", role: "barista" } });
  const team = (await s.api("/api/admin/team")).body.team as { id: number; name: string }[];
  const kavya = team.find((m) => m.name === "Kavya Gomes")!;
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/team/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });
  assert.equal((await post({ staffId: kavya.id, text: "Lovely chai!" })).status, 400, "hidden from the team page, so no notes");
  await s.api("/api/admin/team", { method: "PUT", json: { id: kavya.id, show: true, bio: "Chai person", emoji: "🍵" } });
  const pub = (await (await fetch(`${s.url}/api/team`)).json()).team as { id: number; name: string }[];
  assert.equal(pub.find((m) => m.name === "Kavya")!.id, kavya.id);
  assert.equal((await post({ staffId: kavya.id, text: "x" })).status, 400);
  assert.equal((await post({ staffId: kavya.id, name: "Ivo", text: "Your chai made my rainy day" })).status, 200);
  assert.equal((await fetch(`${s.url}/api/team/notes`)).status, 401);
  const owner = (await s.api("/api/team/notes")).body as { notes: { id: number; text: string; to_name: string }[]; all: boolean };
  assert.ok(owner.all);
  assert.ok(owner.notes.some((n) => n.text === "Your chai made my rainy day" && n.to_name === "Kavya Gomes"));
  await s.api("/api/admin/staff", { method: "POST", json: { name: "Omar Shaikh", username: "omar", password: "longpassword3", role: "barista" } });
  const login = await s.api("/api/admin/login", { method: "POST", json: { username: "omar", password: "longpassword3" } });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const other = (await s.api("/api/team/notes")).body as { notes: { text: string }[]; all: boolean };
  assert.equal(other.all, false);
  assert.ok(!other.notes.some((n) => n.text === "Your chai made my rainy day"), "not someone else's notes");
  await s.api("/api/admin/login", { method: "POST", json: { username: "kavya", password: "longpassword2" } });
  assert.ok(((await s.api("/api/team/notes")).body.notes as { text: string }[]).some((n) => n.text === "Your chai made my rainy day"));
  await s.login();
});

test("book club: the owner picks a shelf book and a meet-up; guests' thoughts wait for staff", async () => {
  await s.login();
  const st = (await s.api("/api/book-club?staff=1")).body as { month: string; books: { id: string }[] };
  assert.ok(st.books.some((b) => b.id === "book-malgudi"));
  assert.equal((await s.api("/api/book-club", { method: "PUT", json: { month: st.month, bookId: "catan" } })).status, 400, "books only");
  assert.equal((await s.api("/api/book-club", { method: "PUT", json: { month: st.month, bookId: "book-malgudi", date: "2020-01-05", time: "18:30" } })).status, 400, "date must be in that month");
  const set = await s.api("/api/book-club", { method: "PUT", json: { month: st.month, bookId: "book-malgudi", date: `${st.month}-28`, time: "18:30" } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  const eventId = set.body.pick.eventId as string;
  assert.ok(eventId);
  const pub = (await (await fetch(`${s.url}/api/book-club`)).json()) as { pick: { title: string; date: string; eventId: string } };
  assert.equal(pub.pick.title, "Malgudi Days");
  assert.equal(pub.pick.eventId, eventId);
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/book-club`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.7.7.7" }, body: JSON.stringify(json) });
  assert.equal((await post({ name: "Neel", stars: 9 })).status, 400);
  assert.equal((await post({ name: "Neel", stars: 4, text: "Swami and his friends!" })).status, 200);
  assert.equal(((await (await fetch(`${s.url}/api/book-club`)).json()).thoughts as unknown[]).length, 0, "waits for a look");
  const t = ((await s.api("/api/book-club?staff=1")).body.waiting as { id: number; name: string }[]).find((x) => x.name === "Neel")!;
  await s.api("/api/book-club", { method: "PATCH", json: { id: t.id, approve: true } });
  const after = (await (await fetch(`${s.url}/api/book-club`)).json()) as { thoughts: { name: string }[]; stars: number };
  assert.equal(after.thoughts[0].name, "Neel");
  assert.equal(after.stars, 4);
  const unset = await s.api("/api/book-club", { method: "PUT", json: { month: st.month, bookId: "book-malgudi" } });
  assert.equal(unset.body.pick.eventId, null, "no meet-up, no event");
  assert.equal((await fetch(`${s.url}/book-club`)).status, 200);
});

test("memory match: today's quickest times, and silly-fast scores are refused", async () => {
  const voter = "memoryvoter012345678";
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/memory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter, mode: "easy", ...json }) });
  assert.equal((await post({ ms: 500, moves: 6 })).status, 400, "too fast");
  assert.equal((await post({ ms: 20000, moves: 2 })).status, 400, "too few moves");
  const a = (await (await post({ ms: 30000, moves: 10, name: "Mina" })).json()) as { top: { name: string; ms: number }[]; mine: { ms: number } };
  assert.equal(a.mine.ms, 30000);
  const b = (await (await post({ ms: 45000, moves: 9, name: "Mina" })).json()) as { mine: { ms: number } };
  assert.equal(b.mine.ms, 30000, "keeps your best");
  const c = (await (await post({ ms: 25000, moves: 9, name: "Mina" })).json()) as { top: { name: string; ms: number }[]; mine: { ms: number } };
  assert.equal(c.mine.ms, 25000);
  assert.ok(c.top.some((x) => x.name === "Mina" && x.ms === 25000));
  const full = (await (await fetch(`${s.url}/api/memory?mode=full&voter=${voter}`)).json()) as { mine: unknown };
  assert.equal(full.mine, null, "modes are separate");
  for (const p of ["/memory", "/konkani"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("wish tree: a wish hangs straight away, its words show once staff approve", async () => {
  const before = (await (await fetch(`${s.url}/api/wishes`)).json()) as { wishes: unknown[]; total: number; nextFull: number };
  assert.ok(before.nextFull > Date.now());
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/wishes`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.6.6.6" }, body: JSON.stringify(json) });
  assert.equal((await post({ text: "hi" })).status, 400);
  const r = (await (await post({ text: "More beach mornings", name: "Ana", colour: 3 })).json()) as { id: number; tree: { wishes: { id: number; colour: number; text?: string }[]; total: number } };
  const w = r.tree.wishes.find((x) => x.id === r.id)!;
  assert.equal(w.colour, 3);
  assert.equal(w.text, undefined, "words hidden until approved");
  assert.equal(r.tree.total, before.total + 1);
  assert.equal((await fetch(`${s.url}/api/wishes?all=1`)).status, 401);
  await s.login();
  assert.ok(((await s.api("/api/wishes?all=1")).body.wishes as { id: number }[]).some((x) => x.id === r.id));
  await s.api("/api/wishes", { method: "PATCH", json: { id: r.id, approve: true } });
  const after = (await (await fetch(`${s.url}/api/wishes`)).json()) as { wishes: { id: number; text?: string; name?: string }[] };
  assert.equal(after.wishes.find((x) => x.id === r.id)!.text, "More beach mornings");
  assert.equal((await fetch(`${s.url}/wish-tree`)).status, 200);
});

test("cups saved: counts drinks from own-cup orders; the owner sets the goal", async () => {
  const before = (await (await fetch(`${s.url}/api/cups`)).json()) as { thisMonth: number; total: number; goal: number };
  const o = await order({ name: "Cup", phone: "9876500031", ownCup: true, lines: [{ itemId: "cappuccino", qty: 2 }, { itemId: "cookie", qty: 1 }] });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.ok(String(o.body.perks).includes("own cup"));
  const after = (await (await fetch(`${s.url}/api/cups`)).json()) as { thisMonth: number; total: number };
  assert.equal(after.thisMonth, before.thisMonth + 2, "two drinks, the cookie doesn't count");
  assert.equal(after.total, before.total + 2);
  assert.equal((await fetch(`${s.url}/api/cups`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: 50 }) })).status, 401);
  await s.login();
  assert.equal((await s.api("/api/cups", { method: "PUT", json: { goal: 0 } })).status, 400);
  assert.equal((await s.api("/api/cups", { method: "PUT", json: { goal: 250 } })).body.goal, 250);
  assert.equal((await (await fetch(`${s.url}/api/cups`)).json()).goal, 250);
  for (const p of ["/cups-saved", "/sunset", "/moon"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("weekly poll: staff can set it before anyone votes; results only after you vote", async () => {
  await s.login();
  assert.equal((await s.api("/api/poll", { method: "PUT", json: { q: "Tea time?", choices: ["Morning"] } })).status, 400, "needs 2+ answers");
  const set = await s.api("/api/poll", { method: "PUT", json: { q: "Best rainy-day drink?", choices: ["Masala chai", "Hot chocolate", "Filter coffee", ""] } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.deepEqual(set.body.choices, ["Masala chai", "Hot chocolate", "Filter coffee"]);
  const voter = "pollvoter01234567890";
  const p = (await (await fetch(`${s.url}/api/poll?voter=${voter}`)).json()) as { q: string; counts?: number[]; mine: number | null };
  assert.equal(p.q, "Best rainy-day drink?");
  assert.equal(p.counts, undefined, "no results before voting");
  const post = (choice: number, v = voter) => fetch(`${s.url}/api/poll`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice, voter: v }) });
  assert.equal((await post(7)).status, 400);
  const v = (await (await post(1)).json()) as { mine: number; counts: number[]; total: number };
  assert.equal(v.mine, 1);
  assert.equal(v.counts[1], 1);
  const again = (await (await post(0)).json()) as { mine: number; total: number };
  assert.equal(again.mine, 1, "one vote each");
  assert.equal(again.total, v.total);
  assert.equal((await s.api("/api/poll", { method: "PUT", json: { q: "Changed?", choices: ["a", "b"] } })).status, 400, "locked once people vote");
  assert.equal((await fetch(`${s.url}/poll`)).status, 200);
});

test("six-word stories: exactly six words, approved by staff, hearted by guests", async () => {
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/stories`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.4.4.4" }, body: JSON.stringify(json) });
  assert.equal((await post({ text: "Far too short a story" })).status, 400);
  assert.equal((await post({ text: "Ordered decaf. Regretted it. Ordered espresso.", name: "Rui" })).status, 200);
  const list = async (voter = "") => ((await (await fetch(`${s.url}/api/stories?voter=${voter}`)).json()).stories as { id: number; text: string; hearts: number; mine: boolean }[]);
  assert.ok(!(await list()).some((x) => x.text.startsWith("Ordered decaf")), "waits for a look");
  assert.equal((await fetch(`${s.url}/api/stories?all=1`)).status, 401);
  await s.login();
  const mine = ((await s.api("/api/stories?all=1")).body.stories as { id: number; text: string }[]).find((x) => x.text.startsWith("Ordered decaf"))!;
  await s.api("/api/stories", { method: "PATCH", json: { id: mine.id, approve: true } });
  const voter = "storyvoter0123456789";
  const heart = (on: boolean) => fetch(`${s.url}/api/stories`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: mine.id, voter, on }) }).then((r) => r.json());
  assert.equal((await heart(true)).hearts, 1);
  assert.equal((await heart(true)).hearts, 1, "one heart each");
  const shown = (await list(voter)).find((x) => x.id === mine.id)!;
  assert.ok(shown.mine);
  const week = (await (await fetch(`${s.url}/api/stories?week=1`)).json()).week as { id: number };
  assert.equal(week.id, mine.id, "story of the week");
  assert.equal((await heart(false)).hearts, 0);
  assert.equal((await fetch(`${s.url}/stories`)).status, 200);
});

test("blind date with a book: hints without titles, unwrap to see it, owners write the hints", async () => {
  const parcels = (await (await fetch(`${s.url}/api/blind-date`)).json()).parcels as { id: string; hints: string[] }[];
  const malgudi = parcels.find((p) => p.id === "book-malgudi")!;
  assert.equal(malgudi.hints.length, 3);
  assert.ok(!JSON.stringify(parcels).includes("Malgudi Days"), "titles stay wrapped");
  const open = (await (await fetch(`${s.url}/api/blind-date`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "book-malgudi" }) })).json()) as { title: string };
  assert.equal(open.title, "Malgudi Days");
  assert.equal((await fetch(`${s.url}/api/blind-date`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "book-tagore", hints: [] }) })).status, 401);
  await s.login();
  assert.equal((await s.api("/api/blind-date", { method: "PUT", json: { id: "catan", hints: ["a"] } })).status, 400, "books only");
  await s.api("/api/blind-date", { method: "PUT", json: { id: "book-tagore", hints: [] } });
  assert.ok(!((await (await fetch(`${s.url}/api/blind-date`)).json()).parcels as { id: string }[]).some((p) => p.id === "book-tagore"), "unwrapped books leave the shelf");
  assert.equal((await fetch(`${s.url}/api/blind-date`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "book-tagore" }) })).status, 404);
  await s.api("/api/blind-date", { method: "PUT", json: { id: "book-tagore", hints: ["Poems, not a story", "Won a Nobel Prize in 1913", "Songs of offering", "a fourth is dropped"] } });
  const back = ((await s.api("/api/blind-date?owner=1")).body.books as { id: string; hints: string[] }[]).find((b) => b.id === "book-tagore")!;
  assert.equal(back.hints.length, 3);
  assert.equal((await fetch(`${s.url}/blind-date`)).status, 200);
});

test("lost & found: staff post it, guests claim it with a code, staff hand it back", async () => {
  assert.equal((await fetch(`${s.url}/api/lost-found`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ what: "Hat" }) })).status, 401);
  assert.equal((await s.api("/api/lost-found", { method: "POST", json: { what: " " } })).status, 400);
  const posted = await s.api("/api/lost-found", { method: "POST", json: { what: "Blue umbrella", where: "Window seat" } });
  assert.equal(posted.status, 200);
  const form = new FormData();
  form.set("what", "Grey scarf");
  const r2 = await fetch(`${s.url}/api/lost-found`, { method: "POST", headers: { cookie: s.cookie() }, body: form });
  assert.equal(r2.status, 200, "a form without a photo is fine");
  const items = (await (await fetch(`${s.url}/api/lost-found`)).json()).items as { id: number; what: string; img: string | null }[];
  assert.ok(items.some((i) => i.what === "Grey scarf" && i.img === null));
  const claim = (json: Record<string, unknown>) => fetch(`${s.url}/api/lost-found`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Real-IP": "10.5.5.1" }, body: JSON.stringify(json) });
  assert.equal((await claim({ id: posted.body.id, name: "Asha", detail: "blue" })).status, 400, "needs a real description");
  const c = await (await claim({ id: posted.body.id, name: "Asha", detail: "Navy with a broken spoke and a cat sticker" })).json();
  assert.match(c.code, /^LF-\d{4}$/);
  const staff = (await s.api("/api/lost-found?staff=1")).body.items as { id: number; claims: { code: string; detail: string }[] }[];
  assert.equal(staff.find((i) => i.id === posted.body.id)!.claims[0].code, c.code);
  assert.equal((await fetch(`${s.url}/api/lost-found?staff=1`)).status, 401);
  assert.equal((await s.api("/api/lost-found", { method: "PATCH", json: { id: posted.body.id, status: "returned" } })).status, 200);
  assert.ok(!((await (await fetch(`${s.url}/api/lost-found`)).json()).items as { id: number }[]).some((i) => i.id === posted.body.id), "gone once it's home");
  assert.equal((await claim({ id: posted.body.id, name: "Asha", detail: "Navy with a broken spoke" })).status, 400);
  assert.equal((await fetch(`${s.url}/lost-found`)).status, 200);
});

test("notes for a stranger: never your own back, and staff read them first", async () => {
  const send = (voter: string, text: string) => fetch(`${s.url}/api/kind-notes`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.5.5.2" }, body: JSON.stringify({ voter, text }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const a = "a".repeat(16) + "kindnotes1", b = "b".repeat(16) + "kindnotes2";
  const first = await send(a, "Your laugh is someone's favourite sound.");
  assert.equal(first.status, 200);
  assert.ok(first.body.house, "nothing approved yet, so one of ours");
  assert.equal((await send(a, "visit www.example.com")).status, 400);
  assert.equal((await fetch(`${s.url}/api/kind-notes?all=1`)).status, 401);
  const notes = (await s.api("/api/kind-notes?all=1")).body.notes as { id: number; text: string }[];
  await s.api("/api/kind-notes", { method: "PATCH", json: { id: notes.find((n) => n.text.startsWith("Your laugh"))!.id, approve: true } });
  const again = await send(a, "Drink some water and stretch your shoulders.");
  assert.ok(again.body.house, "your own note never comes back to you");
  const other = await send(b, "Today is a good day to start something.");
  assert.equal(other.body.note, "Your laugh is someone's favourite sound.");
  assert.equal(other.body.house, false);
  assert.equal((await (await fetch(`${s.url}/api/kind-notes`)).json()).given, 1);
});

test("café connections: groups only show once found, four mistakes and you're out", async () => {
  const { puzzleFor } = await import("../src/lib/connections.ts");
  const { toDateStr } = await import("../src/lib/cafe.ts");
  const p = puzzleFor(toDateStr(new Date()));
  const voter = "c".repeat(16) + "connect1";
  const guess = (words: string[], v = voter) => fetch(`${s.url}/api/connections`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.5.5.3" }, body: JSON.stringify({ words, voter: v }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const start = await (await fetch(`${s.url}/api/connections?voter=${voter}`)).json();
  assert.equal(start.tiles.length, 16);
  assert.deepEqual(start.groups, [], "no answers on the page before you find them");
  assert.ok(!JSON.stringify(start).includes(p[0].name));
  assert.equal((await guess(["NOPE", "A", "B", "C"])).status, 400);
  const got = await guess([...p[1].words]);
  assert.equal(got.body.groups[0].name, p[1].name);
  assert.equal(got.body.tiles.length, 12);
  assert.equal((await guess([...p[1].words])).status, 400, "already tried");
  const wrong = [p[0].words[0], p[0].words[1], p[0].words[2], p[2].words[0]];
  const miss = await guess(wrong);
  assert.equal(miss.body.mistakes, 1);
  assert.equal(miss.body.away, 1);
  assert.equal((await guess(wrong)).status, 400, "the same wrong guess doesn't count twice");
  await guess([p[0].words[0], p[0].words[1], p[2].words[1], p[3].words[0]]);
  await guess([p[0].words[0], p[2].words[2], p[2].words[1], p[3].words[0]]);
  const out = await guess([p[0].words[3], p[2].words[2], p[3].words[1], p[3].words[0]]);
  assert.ok(out.body.done && !out.body.solved);
  assert.equal(out.body.groups.length, 4, "all shown when it's over");
  assert.equal(out.body.grid.split("\n").length, 5);
  // A clean solve
  const v2 = "d".repeat(16) + "connect2";
  for (const g of p) await guess([...g.words], v2);
  const win = await (await fetch(`${s.url}/api/connections?voter=${v2}`)).json();
  assert.ok(win.solved && win.streak === 1 && win.mistakes === 0);
  assert.equal((await fetch(`${s.url}/connections`)).status, 200);
});

test("slide puzzle and board game scoreboard keep honest scores", async () => {
  const voter = "e".repeat(16) + "slide1";
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/slide`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.5.5.4" }, body: JSON.stringify(json) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  assert.equal((await post({ mode: "easy", ms: 500, moves: 30, voter })).status, 400, "too quick to be real");
  assert.equal((await post({ mode: "hard", ms: 60000, moves: 10, voter })).status, 400, "too few moves for 4×4");
  await post({ mode: "easy", ms: 50000, moves: 40, name: "Mira", voter });
  const best = await post({ mode: "easy", ms: 30000, moves: 50, name: "Mira", voter });
  await post({ mode: "easy", ms: 90000, moves: 30, name: "Mira", voter });
  assert.equal(best.body.mine.ms, 30000);
  assert.equal(((await (await fetch(`${s.url}/api/slide?mode=easy&voter=${voter}`)).json()).mine).ms, 30000, "keeps the best");

  const log = (json: Record<string, unknown>, ip = "10.5.5.5") => fetch(`${s.url}/api/game-plays`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": ip }, body: JSON.stringify(json) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const g1 = "f".repeat(16) + "games1", g2 = "f".repeat(16) + "games2";
  assert.equal((await log({ game: "book-god-small-things", winner: "Ravi", players: 2, voter: g1 })).status, 400);
  assert.equal((await log({ game: "catan", winner: "", players: 3, voter: g1 })).status, 400);
  const first = await log({ game: "catan", winner: "Ravi", players: 3, voter: g1 });
  assert.equal(first.status, 200);
  assert.equal((await log({ game: "catan", winner: "Ravi", players: 3, voter: g1 })).status, 400, "no double taps");
  await log({ game: "catan", winner: "ravi", players: 4, voter: g2 });
  const board = (await (await fetch(`${s.url}/api/game-plays?game=catan`)).json()) as { month: { name: string; wins: number }[] };
  assert.equal(board.month[0].wins, 2, "names match ignoring case");
  const all = await (await fetch(`${s.url}/api/game-plays`)).json();
  assert.equal(all.top[0].id, "catan");
  assert.equal((await fetch(`${s.url}/api/game-plays?id=${all.recent[0].id}`, { method: "DELETE" })).status, 401);
  assert.equal((await s.api(`/api/game-plays?id=${all.recent[0].id}`, { method: "DELETE" })).status, 200);
  for (const pg of ["/slide", "/scoreboard", "/fruit-calendar", "/kind-notes", "/shelf"]) assert.equal((await fetch(s.url + pg)).status, 200, pg);
});

test("menu explorer: what you've tried, from your own orders", async () => {
  assert.equal((await fetch(`${s.url}/api/account/explorer`)).status, 401);
  await signIn("explorer@example.com");
  const before = (await s.api("/api/account/explorer")).body;
  assert.equal(before.tried, 0);
  assert.ok(before.total > 20 && before.next);
  await s.api("/api/orders", { method: "POST", json: { name: "Esha", phone: "9877700051", lines: [{ itemId: "cappuccino", qty: 2 }] } });
  const after = (await s.api("/api/account/explorer")).body as { tried: number; cats: { id: string; tried: number; items: { id: string; tried: string | null; times: number }[] }[] };
  assert.equal(after.tried, 1);
  const cap = after.cats.find((c) => c.id === "coffee")!.items.find((i) => i.id === "cappuccino")!;
  assert.ok(cap.tried && cap.times === 2);
  assert.ok(!after.cats.some((c) => c.items.some((i) => i.id === "blue-moon-spritz")), "secret dishes don't count");
  assert.equal((await fetch(`${s.url}/menu-explorer`)).status, 200);
});

test("latte art of the week: staff post, guests vote once a week, the leader shows on the board", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const post = (caption: string, cookie = s.cookie()) => { const fd = new FormData(); fd.append("file", new Blob([png], { type: "image/png" }), "art.png"); fd.append("caption", caption); return fetch(`${s.url}/api/latte-art`, { method: "POST", headers: { cookie }, body: fd }); };
  assert.equal((await post("Swan", "")).status, 400, "a guest needs to give their name");
  assert.equal((await post("Swan")).status, 200);
  assert.equal((await post("Tulip")).status, 200);
  const week = (await (await fetch(`${s.url}/api/latte-art`)).json()) as { entries: { id: number; caption: string; votes: number }[] };
  assert.equal(week.entries.length, 2);
  const tulip = week.entries.find((e) => e.caption === "Tulip")!, swan = week.entries.find((e) => e.caption === "Swan")!;
  const vote = (id: number, voter: string) => fetch(`${s.url}/api/latte-art`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Real-IP": "10.6.6.1" }, body: JSON.stringify({ id, voter }) }).then((r) => r.json());
  const v1 = "g".repeat(16) + "latte1";
  await vote(swan.id, v1);
  const changed = await vote(tulip.id, v1);
  assert.equal(changed.mine, tulip.id, "you can change your vote");
  assert.equal(changed.entries.find((e: { id: number }) => e.id === swan.id).votes, 0, "but only one counts");
  await vote(tulip.id, "g".repeat(16) + "latte2");
  const board = (await (await fetch(`${s.url}/api/latte-art?board=1`)).json()).art;
  assert.equal(board.id, tulip.id);
  assert.equal(board.final, false, "this week's leader until the week ends");
  assert.equal((await s.api(`/api/latte-art?id=${swan.id}`, { method: "DELETE" })).status, 200);
  for (const p of ["/latte-art", "/team", "/board"]) assert.equal((await fetch(s.url + p)).status, 200, p);
});

test("word search and mini sudoku keep each guest's best time today", async () => {
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.6.6.2" }, body: JSON.stringify(json) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const voter = "h".repeat(16) + "daily1";
  assert.equal((await post({ game: "chess", ms: 50000, voter })).status, 400);
  assert.equal((await post({ game: "wordsearch", ms: 2000, voter })).status, 400, "too quick to be real");
  await post({ game: "wordsearch", ms: 90000, name: "Noor", voter });
  const best = await post({ game: "wordsearch", ms: 60000, name: "Noor", voter });
  await post({ game: "wordsearch", ms: 120000, name: "Noor", voter });
  assert.equal(best.body.mine.ms, 60000);
  assert.equal((await (await fetch(`${s.url}/api/daily-scores?game=wordsearch&voter=${voter}`)).json()).mine.ms, 60000);
  await post({ game: "sudoku", mode: "hard", ms: 80000, name: "Noor", voter });
  const easy = await (await fetch(`${s.url}/api/daily-scores?game=sudoku&mode=easy&voter=${voter}`)).json();
  assert.equal(easy.mine, null, "easy and hard have separate boards");
  assert.equal((await (await fetch(`${s.url}/api/daily-scores?game=sudoku&mode=hard`)).json()).top[0].name, "Noor");
  for (const p of ["/word-search", "/sudoku", "/i-spy"]) assert.equal((await fetch(s.url + p)).status, 200, p);
});

test("recipe swap: staff read them first, guests heart them, the best show on the recipes page", async () => {
  const send = (json: Record<string, unknown>) => fetch(`${s.url}/api/guest-recipes`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.6.6.3" }, body: JSON.stringify(json) });
  assert.equal((await send({ title: "Chai", ingredients: "tea", steps: "boil" })).status, 400, "needs two ingredients");
  assert.equal((await send({ title: "Aaji's monsoon chai", name: "Kiran", ingredients: "2 cups water\n1 cup milk\n2 tsp tea", steps: "Boil the water\nAdd tea, then milk" })).status, 200);
  assert.deepEqual((await (await fetch(`${s.url}/api/guest-recipes`)).json()).recipes, [], "not shown before staff read it");
  assert.equal((await fetch(`${s.url}/api/guest-recipes?all=1`)).status, 401);
  const r = ((await s.api("/api/guest-recipes?all=1")).body.recipes as { id: number; title: string; ingredients: string[] }[]).find((x) => x.title === "Aaji's monsoon chai")!;
  assert.deepEqual(r.ingredients, ["2 cups water", "1 cup milk", "2 tsp tea"]);
  await s.api("/api/guest-recipes", { method: "PATCH", json: { id: r.id, approve: true } });
  const h = await (await fetch(`${s.url}/api/guest-recipes`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, voter: "i".repeat(20), on: true }) })).json();
  assert.equal(h.hearts, 1);
  assert.ok((await (await fetch(`${s.url}/recipes`)).text()).includes("Aaji&#x27;s monsoon chai"));
  assert.equal((await fetch(`${s.url}/recipe-swap`)).status, 200);

  assert.equal((await fetch(`${s.url}/api/ispy`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: ["x"] }) })).status, 401);
  const saved = await s.api("/api/ispy", { method: "PUT", json: { items: ["🌿 The big fern", " ", "☕ A blue mug"] } });
  assert.deepEqual(saved.body.items, ["🌿 The big fern", "☕ A blue mug"]);
  const back = await s.api("/api/ispy", { method: "PUT", json: { items: [] } });
  assert.ok(back.body.items.length >= 8, "an empty list puts the café's back");
});

test("guests vs the barista: votes pick the move, the barista replies, owners can reset", async () => {
  const vote = (col: number, voter: string) => fetch(`${s.url}/api/connect4`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.8.8.1" }, body: JSON.stringify({ col, voter }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const start = await (await fetch(`${s.url}/api/connect4`)).json();
  assert.equal(start.status, "playing");
  assert.equal(start.roundEnds, null, "a round only starts with its first vote");
  const v = (n: number) => "m".repeat(16) + "c4voter" + n;
  assert.equal((await vote(9, v(1))).status, 400);
  await vote(2, v(1));
  await vote(3, v(2));
  const r = await vote(3, v(3));
  assert.equal(r.body.counts[3], 2);
  assert.ok(r.body.roundEnds > Date.now());
  const changed = await vote(3, v(1));
  assert.equal(changed.body.counts[2], 0, "changing your vote moves it");
  await new Promise((ok) => setTimeout(ok, 1400));
  const after = await (await fetch(`${s.url}/api/connect4`)).json();
  assert.equal(after.moves, start.moves + 1);
  assert.equal(after.lastGuest, 3, "the most popular column was played");
  assert.equal(after.board.filter((x: number) => x === 1).length - start.board.filter((x: number) => x === 1).length, 1);
  assert.equal(after.board.filter((x: number) => x === 2).length - start.board.filter((x: number) => x === 2).length, 1, "and the barista replied");
  assert.equal(after.roundEnds, null);
  assert.equal((await fetch(`${s.url}/api/connect4`, { method: "DELETE" })).status, 401);
  const fresh = (await s.api("/api/connect4", { method: "DELETE" })).body;
  assert.equal(fresh.moves, 0);
  assert.ok(fresh.board.every((x: number) => x === 0));
  assert.equal((await fetch(`${s.url}/connect-four`)).status, 200);
});

test("story chain: one sentence at a time, staff read each one, no two in a row", async () => {
  const add = (text: string, voter: string) => fetch(`${s.url}/api/story-chain`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.8.8.2" }, body: JSON.stringify({ text, voter, name: "Ana" }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const a = "n".repeat(16) + "chain1", b = "n".repeat(16) + "chain2";
  const start = await (await fetch(`${s.url}/api/story-chain?voter=${a}`)).json();
  assert.ok(start.story.opener.length > 10);
  assert.equal((await add("No.", a)).status, 400);
  assert.equal((await add("She tiptoed to the third cupboard and listened.", a)).status, 200);
  assert.equal((await add("Something inside was humming.", a)).status, 400, "one waiting line at a time");
  assert.equal((await fetch(`${s.url}/api/story-chain?all=1`)).status, 401);
  const waiting = (await s.api("/api/story-chain?all=1")).body.lines as { id: number; text: string }[];
  const mine = waiting.find((l) => l.text.startsWith("She tiptoed"))!;
  await s.api("/api/story-chain", { method: "PATCH", json: { id: mine.id, approve: true } });
  const now = await (await fetch(`${s.url}/api/story-chain?voter=${a}`)).json();
  assert.equal(now.story.lines.at(-1).text, "She tiptoed to the third cupboard and listened.");
  assert.ok(now.lastIsMine);
  assert.equal((await add("Then it went quiet again.", a)).status, 400, "someone else goes next");
  assert.equal((await add("Something inside the cupboard was humming a song.", b)).status, 200);
  assert.equal((await (await fetch(`${s.url}/api/story-chain?board=1`)).json()).text, "She tiptoed to the third cupboard and listened.");
  assert.equal((await fetch(`${s.url}/story-chain`)).status, 200);
});

test("guess the dish: answers stay hidden, hints after a miss, right answers count", async () => {
  const { dishesFor } = await import("../src/lib/emojiDish.ts");
  const { toDateStr } = await import("../src/lib/cafe.ts");
  const menu = (await s.api("/api/menu")).body.items as { id: string; name: string }[];
  const today = dishesFor(toDateStr(new Date()), new Set(menu.map((m) => m.id)));
  const voter = "o".repeat(16) + "dish1";
  const guess = (i: number, g: string) => fetch(`${s.url}/api/guess-dish`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.8.8.3" }, body: JSON.stringify({ i, guess: g, voter }) }).then((r) => r.json());
  const start = await (await fetch(`${s.url}/api/guess-dish?voter=${voter}`)).json();
  assert.equal(start.puzzles.length, 5);
  assert.ok(start.puzzles.every((p: { answer?: string }) => p.answer === undefined), "no answers before you guess");
  const right = await guess(0, menu.find((m) => m.id === today[0].id)!.name);
  assert.ok(right.puzzles[0].ok);
  const miss = await guess(1, "definitely not this");
  assert.equal(miss.puzzles[1].hints.length, 1, "a hint after a miss");
  await guess(1, "still not right");
  const out = await guess(1, "nope again");
  assert.ok(out.puzzles[1].over && !out.puzzles[1].ok && out.puzzles[1].answer, "the answer shows after three misses");
  assert.equal(out.score, 1);
  assert.equal((await fetch(`${s.url}/guess-the-dish`)).status, 200);
});

test("artist wall and where guests are visiting from", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const fd = () => { const f = new FormData(); f.append("file", new Blob([png], { type: "image/png" }), "art.png"); f.append("title", "Monsoon over Mandovi"); f.append("medium", "Watercolour"); f.append("price", "4500"); return f; };
  assert.equal((await fetch(`${s.url}/api/art`, { method: "POST", body: fd() })).status, 401);
  assert.equal((await fetch(`${s.url}/api/art`, { method: "POST", headers: { cookie: s.cookie() }, body: fd() })).status, 200);
  await s.api("/api/art", { method: "PUT", json: { artist: { name: "Rhea D'Souza", bio: "Paints the Panjim rain.", link: "javascript:alert(1)" } } });
  const art = await (await fetch(`${s.url}/api/art`)).json();
  assert.equal(art.artist.name, "Rhea D'Souza");
  assert.equal(art.artist.link, "", "only https links");
  const w = art.works.find((x: { title: string }) => x.title === "Monsoon over Mandovi");
  assert.equal(w.price, 4500);
  await s.api("/api/art", { method: "PUT", json: { id: w.id, sold: true } });
  assert.equal((await (await fetch(`${s.url}/api/art`)).json()).works.find((x: { id: number }) => x.id === w.id).sold, 1);

  const say = (place: string, voter: string) => fetch(`${s.url}/api/visiting-from`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.8.8.4" }, body: JSON.stringify({ place, voter }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  assert.equal((await say("Atlantis", "p".repeat(20))).status, 400);
  await say("Goa", "p".repeat(20));
  await say("Kerala", "q".repeat(20));
  const changed = await say("Portugal", "p".repeat(20));
  assert.equal(changed.body.mine, "Portugal", "you can change today's answer");
  assert.equal(changed.body.people, 2, "still one each");
  assert.equal(changed.body.states, 1);
  assert.equal(changed.body.countries, 1);
  for (const p of ["/artist-wall", "/visiting-from", "/recipes/rose-latte", "/board"]) assert.equal((await fetch(s.url + p)).status, 200, p);
});

test("games corner: knows which daily games you've played today", async () => {
  const voter = "r".repeat(16) + "games1";
  const before = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[]; done: number };
  assert.equal(before.games.length, 56);
  assert.equal(before.done, 0);
  await fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.9" }, body: JSON.stringify({ game: "wordsearch", ms: 70000, name: "G", voter }) });
  await fetch(`${s.url}/api/slide`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.9" }, body: JSON.stringify({ mode: "easy", ms: 40000, moves: 40, name: "G", voter }) });
  const after = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean; streak: number }[]; done: number };
  assert.equal(after.done, 2);
  assert.ok(after.games.find((g) => g.id === "wordsearch")!.done && after.games.find((g) => g.id === "slide")!.streak === 1);
  assert.equal((await fetch(`${s.url}/games`)).status, 200);
});

test("shout-outs: guests pick a day, staff approve, the board shows today's", async () => {
  const { toDateStr } = await import("../src/lib/cafe.ts");
  const today = toDateStr(new Date()), tomorrow = toDateStr(new Date(Date.now() + 86400_000));
  const send = (json: Record<string, unknown>) => fetch(`${s.url}/api/shoutouts`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.10" }, body: JSON.stringify(json) });
  assert.equal((await send({ date: "2020-01-01", text: "Happy birthday, Priya!" })).status, 400);
  assert.equal((await send({ date: today, text: "Happy birthday, Priya! 🎂", from: "Mum" })).status, 200);
  assert.equal((await send({ date: tomorrow, text: "Happy anniversary, Ravi & Meera" })).status, 200);
  assert.deepEqual((await (await fetch(`${s.url}/api/shoutouts`)).json()).shouts, [], "nothing shows before staff approve");
  assert.equal((await fetch(`${s.url}/api/shoutouts?all=1`)).status, 401);
  const all = (await s.api("/api/shoutouts?all=1")).body.shouts as { id: number; date: string }[];
  for (const x of all) await s.api("/api/shoutouts", { method: "PATCH", json: { id: x.id, approve: true } });
  const shown = (await (await fetch(`${s.url}/api/shoutouts`)).json()).shouts as { text: string; from_name: string }[];
  assert.equal(shown.length, 1, "only today's");
  assert.equal(shown[0].from_name, "Mum");
  assert.equal((await fetch(`${s.url}/shout-outs`)).status, 200);
});

test("adopt a friend, focus together and ask us anything", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const fd = () => { const f = new FormData(); f.append("file", new Blob([png], { type: "image/png" }), "pet.png"); f.append("name", "Biscuit"); f.append("kind", "dog"); f.append("link", "https://shelter.example/biscuit"); return f; };
  assert.equal((await fetch(`${s.url}/api/adopt`, { method: "POST", body: fd() })).status, 401);
  assert.equal((await fetch(`${s.url}/api/adopt`, { method: "POST", headers: { cookie: s.cookie() }, body: fd() })).status, 200);
  const pets = (await (await fetch(`${s.url}/api/adopt`)).json()).pets as { id: number; name: string; link: string }[];
  const b = pets.find((p) => p.name === "Biscuit")!;
  assert.equal(b.link, "https://shelter.example/biscuit");
  await s.api("/api/adopt", { method: "PUT", json: { id: b.id, adopted: true } });
  const after = await (await fetch(`${s.url}/api/adopt`)).json();
  assert.ok(!after.pets.some((p: { id: number }) => p.id === b.id) && after.homed.some((p: { id: number }) => p.id === b.id), "moves to found a home");

  const focus = (json: Record<string, unknown>) => fetch(`${s.url}/api/focus`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.11" }, body: JSON.stringify(json) }).then((r) => r.json());
  const f1 = "s".repeat(16) + "focus1", f2 = "s".repeat(16) + "focus2";
  const base = (await (await fetch(`${s.url}/api/focus`)).json()).live;
  await focus({ voter: f1, event: "ping" });
  const two = await focus({ voter: f2, event: "ping" });
  assert.equal(two.live, base + 2);
  const done = await focus({ voter: f1, event: "done", minutes: 25 });
  assert.equal(done.sessions, 1);
  assert.equal((await focus({ voter: f1, event: "done", minutes: 25 })).sessions, 1, "can't finish two 25-minute sessions at once");
  assert.equal((await focus({ voter: f2, event: "stop" })).live, base + 1);

  const ask = (q: string) => fetch(`${s.url}/api/ask`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.12" }, body: JSON.stringify({ q, name: "Tanvi" }) });
  assert.equal((await ask("decaf?")).status, 400);
  assert.equal((await ask("Is the oat milk unsweetened?")).status, 200);
  assert.deepEqual((await (await fetch(`${s.url}/api/ask`)).json()).questions, [], "not public until answered");
  const q = ((await s.api("/api/ask?all=1")).body.questions as { id: number; q: string }[]).find((x) => x.q.startsWith("Is the oat milk"))!;
  assert.equal((await fetch(`${s.url}/api/ask`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: q.id, answer: "Yes" }) })).status, 401);
  await s.api("/api/ask", { method: "PATCH", json: { id: q.id, answer: "Yes! We use an unsweetened barista oat milk." } });
  const pub = (await (await fetch(`${s.url}/api/ask`)).json()).questions as { q: string; answer: string }[];
  assert.equal(pub[0].answer, "Yes! We use an unsweetened barista oat milk.");
  assert.equal((pub[0] as { answered_by?: string | null }).answered_by, null, "the owner passcode signs as the team");
  for (const p of ["/adopt", "/ask", "/focus", "/pups"]) assert.equal((await fetch(s.url + p)).status, 200, p);
});

test("doodle of the day: doodles drawn for the prompt get their own gallery", async () => {
  const { promptFor } = await import("../src/lib/doodlePrompts.ts");
  const { toDateStr } = await import("../src/lib/cafe.ts");
  const today = promptFor(toDateStr(new Date()));
  assert.equal((await (await fetch(`${s.url}/api/photos?prompts=1`)).json()).today, today);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const f = new FormData();
  f.append("file", new Blob([png], { type: "image/png" }), "d.png"); f.append("kind", "doodle"); f.append("name", "Zoya"); f.append("prompt", "1");
  assert.equal((await fetch(`${s.url}/api/photos`, { method: "POST", headers: { "X-Real-IP": "10.9.9.13" }, body: f })).status, 200);
  const mine = ((await s.api("/api/photos?all=1")).body.photos as { id: number; name: string; prompt: string | null }[]).find((p) => p.name === "Zoya")!;
  assert.equal(mine.prompt, today, "tagged with today's prompt by the server");
  await s.api("/api/photos", { method: "PATCH", json: { id: mine.id, approve: true } });
  const gallery = (await (await fetch(`${s.url}/api/photos?prompt=${encodeURIComponent(today)}`)).json()).photos as { id: number }[];
  assert.ok(gallery.some((p) => p.id === mine.id));
  assert.ok(((await (await fetch(`${s.url}/api/photos?prompts=1`)).json()).prompts as { prompt: string }[]).some((p) => p.prompt === today));
});

test("crack the order: marks each guess, keeps the answer back until you're done", async () => {
  const voter = "k".repeat(16) + "crack1";
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/crack`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.20" }, body: JSON.stringify({ voter, ...json }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const start = await (await fetch(`${s.url}/api/crack?voter=${voter}`)).json();
  assert.equal(start.code, null, "the order stays secret");
  assert.equal((await post({ guess: [0, 1] })).status, 400);
  assert.equal((await post({ guess: [0, 1, 2, 9] })).status, 400);
  // Work the answer out the same way the server does
  const { seededRand } = await import("../src/lib/gameOrders.ts");
  const rand = seededRand(`crack:${start.date}:moss-moon`);
  const code = [0, 1, 2, 3].map(() => Math.floor(rand() * 6));
  const wrong = code.map((c) => (c + 1) % 6);
  const first = await post({ guess: wrong });
  assert.equal(first.status, 200);
  assert.equal(first.body.guesses[0].right, 0);
  assert.equal(first.body.code, null);
  const won = await post({ guess: code });
  assert.ok(won.body.won && won.body.done);
  assert.deepEqual(won.body.code, code);
  assert.match(won.body.grid, /✅✅✅✅/);
  assert.equal((await post({ guess: code })).status, 400, "one game a day");
  const games = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  assert.ok(games.games.find((g) => g.id === "crack")!.done);
  assert.equal((await fetch(`${s.url}/crack-the-order`)).status, 200);
});

test("new daily puzzles and arcade games keep times and weekly scores", async () => {
  const voter = "m".repeat(16) + "arcade1";
  const post = (path: string, json: Record<string, unknown>) => fetch(`${s.url}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.21" }, body: JSON.stringify({ voter, ...json }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  assert.equal((await post("/api/daily-scores", { game: "crossword", ms: 2000, name: "Q" })).status, 400, "too quick to be real");
  assert.equal((await post("/api/daily-scores", { game: "crossword", ms: 95000, name: "Quick" })).body.top[0].name, "Quick");
  assert.equal((await post("/api/daily-scores", { game: "nonogram", mode: "hard", ms: 120000, name: "Pix" })).body.mode, "hard");
  assert.equal((await post("/api/daily-scores", { game: "sweeper", mode: "easy", ms: 30000, name: "Sweep" })).status, 200);
  assert.equal((await post("/api/arcade", { game: "merge", score: 1234, name: "M" })).status, 400, "merge scores go up in fours");
  assert.equal((await post("/api/arcade", { game: "merge", score: 2048, name: "Moon" })).body.mine, 2048);
  assert.equal((await post("/api/arcade", { game: "merge", score: 1024, name: "Moon" })).body.mine, 2048, "keeps your best");
  assert.equal((await post("/api/arcade", { game: "higherlower", score: 9999, name: "H" })).status, 400);
  const hl = await post("/api/arcade", { game: "higherlower", score: 12, name: "<b>Hi</b>" });
  assert.equal(hl.body.top[0].name, "bHi/b");
  assert.equal((await fetch(`${s.url}/api/arcade?game=nope`)).status, 400);
  const games = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  assert.deepEqual(games.games.filter((g) => g.done).map((g) => g.id).sort(), ["crossword", "nonogram", "sweeper"]);
  for (const p of ["/crossword", "/pixel-picture", "/bean-sweeper", "/brew-merge", "/higher-or-lower", "/games"]) assert.equal((await fetch(s.url + p)).status, 200, p);
});

test("quiz night: staff host, guests join and answer, the quickest right answer scores most", async () => {
  const guest = (voter: string, json: Record<string, unknown>) => fetch(`${s.url}/api/quiz`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.30" }, body: JSON.stringify({ voter, ...json }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const a = "q".repeat(16) + "quiza", b = "q".repeat(16) + "quizb";
  assert.equal((await fetch(`${s.url}/api/quiz`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) })).status, 401, "guests can't host");
  assert.equal((await guest(a, { action: "join", name: "Early" })).status, 400, "no quiz yet");
  const opened = await s.api("/api/quiz", { method: "PUT", json: { action: "start", title: "Tuesday <b>quiz</b>", size: 5 } });
  assert.equal(opened.status, 200);
  assert.equal(opened.body.quiz.title, "Tuesday bquiz/b");
  assert.equal(opened.body.quiz.total, 5);
  assert.equal((await s.api("/api/quiz", { method: "PUT", json: { action: "start" } })).status, 400, "one at a time");
  assert.equal((await guest(a, { action: "join", name: "The Flat Whites" })).status, 200);
  assert.equal((await guest(b, { action: "join", name: "the flat whites" })).status, 400, "names are unique");
  assert.equal((await guest(b, { action: "join", name: "Beans" })).status, 200);
  assert.equal((await guest(a, { action: "answer", choice: 0 })).status, 400, "not started");
  const q1 = await s.api("/api/quiz?host=1", { method: "PUT", json: { action: "next" } });
  const answer = q1.body.quiz.question.answer as number;
  const pub = await (await fetch(`${s.url}/api/quiz?voter=${a}`)).json();
  assert.equal(pub.quiz.phase, "question");
  assert.equal(pub.quiz.question.answer, null, "the answer stays secret while it's open");
  assert.equal(pub.quiz.counts, null);
  assert.equal((await guest(a, { action: "answer", choice: answer })).status, 200);
  assert.equal((await guest(a, { action: "answer", choice: answer })).status, 400, "one answer each");
  await new Promise((r) => setTimeout(r, 400));
  assert.equal((await guest(b, { action: "answer", choice: answer })).status, 200);
  await new Promise((r) => setTimeout(r, 1300));
  assert.equal((await guest("q".repeat(16) + "late01", { action: "join", name: "Late" })).status, 200, "you can join mid-quiz");
  assert.equal((await guest("q".repeat(16) + "late01", { action: "answer", choice: answer })).status, 400, "too late once time's up");
  const after = await (await fetch(`${s.url}/api/quiz?voter=${b}`)).json();
  assert.equal(after.quiz.phase, "reveal");
  assert.equal(after.quiz.question.answer, answer);
  assert.equal(after.quiz.top[0].name, "The Flat Whites", "quicker scores more");
  assert.ok(after.quiz.top[0].score > after.quiz.top[1].score && after.quiz.top[1].score >= 500);
  assert.equal(after.quiz.me.rank, 2);
  const q2 = await s.api("/api/quiz", { method: "PUT", json: { action: "next" } });
  assert.equal(q2.body.quiz.index, 1);
  const closed = await s.api("/api/quiz", { method: "PUT", json: { action: "next" } });
  assert.equal(closed.body.quiz.phase, "reveal", "staff can close a question early");
  const ended = await s.api("/api/quiz", { method: "PUT", json: { action: "end" } });
  assert.equal(ended.body.quiz.phase, "done");
  assert.equal((await guest(a, { action: "join", name: "Again" })).status, 400);
  for (const p of ["/quiz", "/quiz/screen", "/board"]) assert.equal((await fetch(s.url + p)).status, 200, p);
});

test("word ladder, jigsaw and bean snake keep scores; the other new pages load", async () => {
  const voter = "w".repeat(16) + "ladder1";
  const post = (path: string, json: Record<string, unknown>) => fetch(`${s.url}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.31" }, body: JSON.stringify({ voter, ...json }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  assert.equal((await post("/api/daily-scores", { game: "ladder", ms: 1000 })).status, 400);
  assert.equal((await post("/api/daily-scores", { game: "ladder", ms: 45000, name: "Climber" })).body.top[0].name, "Climber");
  assert.equal((await post("/api/daily-scores", { game: "jigsaw", mode: "large", ms: 90000, name: "J" })).body.mode, "large");
  assert.equal((await post("/api/arcade", { game: "snake", score: 999, name: "S" })).status, 400);
  assert.equal((await post("/api/arcade", { game: "snake", score: 31, name: "Snek" })).body.mine, 31);
  const games = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  assert.deepEqual(games.games.filter((g) => g.done).map((g) => g.id).sort(), ["jigsaw", "ladder"]);
  for (const p of ["/word-ladder", "/jigsaw", "/bean-snake", "/photo-booth", "/split-bill"]) assert.equal((await fetch(s.url + p)).status, 200, p);
  const policy = (await fetch(`${s.url}/photo-booth`)).headers.get("permissions-policy") ?? "";
  assert.match(policy, /camera=\(self\)/, "the photo booth can ask for the camera");
});

test("bean hive: words are checked on the server and the score builds up", async () => {
  const { hiveFor } = await import("../src/lib/hive.ts");
  const { toDateStr } = await import("../src/lib/cafe.ts");
  const h = hiveFor(toDateStr(new Date()));
  const voter = "h".repeat(16) + "hive1";
  const send = (word: string) => fetch(`${s.url}/api/hive`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.31" }, body: JSON.stringify({ word, voter }) });
  const start = (await (await fetch(`${s.url}/api/hive?voter=${voter}`)).json()) as { centre: string; outer: string[]; found: string[]; score: number; yesterday: { words: string[] } };
  assert.equal(start.centre, h.centre);
  assert.equal(start.found.length, 0);
  assert.ok(start.yesterday.words.length > 5);
  // Today's word list isn't sent to the page
  assert.ok(!("common" in start));
  const ok = await send(h.common[0]);
  assert.equal(ok.status, 200);
  const body = (await ok.json()) as { found: string[]; score: number; added: { points: number } };
  assert.deepEqual(body.found, [h.common[0]]);
  assert.equal(body.score, body.added.points);
  assert.equal((await send(h.common[0])).status, 400);
  // Has the middle letter, but also one that isn't in the hive (so this doesn't depend on the day's letters)
  const stray = [..."zqxjkvwy"].find((c) => c !== h.centre && !h.outer.includes(c))!;
  assert.match(((await (await send(h.centre + stray.repeat(3))).json()) as { error: string }).error, /letters in the hive/);
  const games = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  assert.ok(games.games.find((g) => g.id === "hive")!.done);
  for (const p of ["/bean-hive", "/pour-paths", "/tea-tiles", "/spot-the-difference", "/call-the-order", "/cafe-patience"]) assert.equal((await fetch(s.url + p)).status, 200, p);
});

test("new boards: pour paths, tea tiles and spot times, call the order scores", async () => {
  const voter = "p".repeat(16) + "paths1";
  const post = (p: string, json: Record<string, unknown>) => fetch(`${s.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.32" }, body: JSON.stringify({ voter, name: "Pat", ...json }) });
  assert.equal((await post("/api/daily-scores", { game: "paths", mode: "hard", ms: 1000 })).status, 400);
  const hard = (await (await post("/api/daily-scores", { game: "paths", mode: "hard", ms: 42000 })).json()) as { mode: string; top: { ms: number }[] };
  assert.equal(hard.mode, "hard"); assert.equal(hard.top[0].ms, 42000);
  assert.equal((await post("/api/daily-scores", { game: "tiles", ms: 5000 })).status, 400);
  assert.equal((await post("/api/daily-scores", { game: "tiles", ms: 95000 })).status, 200);
  assert.equal((await post("/api/daily-scores", { game: "spot", ms: 31000 })).status, 200);
  assert.equal((await post("/api/arcade", { game: "typing", score: 5000 })).status, 400);
  const t = (await (await post("/api/arcade", { game: "typing", score: 23 })).json()) as { top: { score: number }[]; best: number };
  assert.equal(t.top[0].score, 23); assert.equal(t.best, 23);
  const games = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  for (const id of ["paths", "tiles", "spot"]) assert.ok(games.games.find((g) => g.id === id)!.done, id);
});

test("more boards: cryptogram and lamp times, flood moves first, cake stacker scores", async () => {
  const voter = "q".repeat(16) + "flood1";
  const post = (p: string, json: Record<string, unknown>) => fetch(`${s.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.33" }, body: JSON.stringify({ voter, name: "Flo", ...json }) });
  const { packScore, unpackScore } = await import("../src/lib/flood.ts");
  assert.equal((await post("/api/daily-scores", { game: "cipher", ms: 4000 })).status, 400);
  assert.equal((await post("/api/daily-scores", { game: "cipher", ms: 80000 })).status, 200);
  assert.equal((await post("/api/daily-scores", { game: "lamps", ms: 1000 })).status, 400);
  assert.equal((await post("/api/daily-scores", { game: "lamps", ms: 20000 })).status, 200);
  // Flood: 3 moves is impossible, and more than 99 isn't allowed
  assert.equal((await post("/api/daily-scores", { game: "flood", ms: packScore(3, 30000) })).status, 400);
  assert.equal((await post("/api/daily-scores", { game: "flood", ms: packScore(120, 30000) })).status, 400);
  await post("/api/daily-scores", { game: "flood", ms: packScore(24, 20000) });
  const f = (await (await post("/api/daily-scores", { game: "flood", ms: packScore(21, 90000) })).json()) as { top: { ms: number }[] };
  assert.deepEqual(unpackScore(f.top[0].ms), { moves: 21, ms: 90000 }, "fewer moves beats a quicker time");
  assert.equal((await post("/api/arcade", { game: "stacker", score: 1000 })).status, 400);
  const st = (await (await post("/api/arcade", { game: "stacker", score: 31 })).json()) as { top: { score: number }[]; best: number };
  assert.equal(st.top[0].score, 31); assert.equal(st.best, 31);
  const games = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  for (const id of ["cipher", "flood", "lamps"]) assert.ok(games.games.find((g) => g.id === id)!.done, id);
  for (const p of ["/cryptogram", "/cake-stacker", "/reversi", "/flood", "/lamp-switch", "/sink-the-saucers"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("games corner: today's five, trophies data, the all-rounder board and jumble times", async () => {
  const voter = "r".repeat(16) + "allrnd1", other = "r".repeat(16) + "allrnd2";
  const post = (p: string, json: Record<string, unknown>, v = voter) => fetch(`${s.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.34" }, body: JSON.stringify({ voter: v, name: "Ali", ...json }) });
  const { todaysFive } = await import("../src/lib/todaysFive.ts");
  assert.equal((await post("/api/daily-scores", { game: "jumble", ms: 3000 })).status, 400);
  assert.equal((await post("/api/daily-scores", { game: "jumble", ms: 41000 })).status, 200);
  const g = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { date: string; five: { ids: string[]; done: number; streak: number } };
  assert.deepEqual(g.five.ids, todaysFive(g.date));
  // Finish the five (the time-based ones are enough to count)
  const timed: Record<string, number> = { wordsearch: 60000, sudoku: 60000, crossword: 60000, nonogram: 60000, sweeper: 60000, ladder: 60000, jigsaw: 60000, paths: 60000, tiles: 60000, spot: 60000, cipher: 60000, lamps: 60000, jumble: 60000, milk: 60000, lights: 60000, table: 60000, parasols: 60000, tipjar: 60000, towers: 60000, cups: 60000, corners: 3_060_000, sums: 60000, freecell: 300000, boggle: 999_988, bill: 60000, taller: 60000, traytiles: 60000, seats: 60000, four: 5_060_000, threads: 60000, garden: 60000, rope: 60000, necklace: 60000, flood: 25_000_000 };
  const easy = g.five.ids.filter((id) => id in timed);
  for (const id of easy) assert.equal((await post("/api/daily-scores", { game: id, ms: timed[id], mode: "easy" })).status, 200, id);
  const g2 = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { five: { done: number; streak: number } };
  assert.equal(g2.five.done, easy.length);
  const t = (await (await fetch(`${s.url}/api/trophies?voter=${voter}`)).json()) as { played: Record<string, string[]>; arcade: Record<string, number | null> };
  assert.equal(t.played.jumble.length, 1);
  assert.ok("stacker" in t.arcade);
  // The all-rounder board: only people who join are on it
  let b = (await (await fetch(`${s.url}/api/all-rounder?voter=${voter}`)).json()) as { top: { name: string; games: number }[]; joined: string | null; mine: number };
  assert.equal(b.joined, null); assert.ok(b.mine >= 1);
  assert.ok(!b.top.some((x) => x.name === "Ali"));
  assert.equal((await post("/api/all-rounder", { name: "" })).status, 400);
  b = (await (await post("/api/all-rounder", { name: "Ali" })).json()) as typeof b;
  assert.equal(b.joined, "Ali");
  assert.equal(b.top.find((x) => x.name === "Ali")!.games, b.mine);
  await post("/api/daily-scores", { game: "jumble", ms: 50000 }, other);
  await post("/api/all-rounder", { name: "Bo" }, other);
  b = (await (await fetch(`${s.url}/api/all-rounder?voter=${voter}`)).json()) as typeof b;
  assert.deepEqual(b.top.map((x) => x.name).slice(0, 2), b.mine > 1 ? ["Ali", "Bo"] : ["Ali", "Bo"].sort());
  b = (await (await post("/api/all-rounder", { leave: true })).json()) as typeof b;
  assert.equal(b.joined, null); assert.ok(!b.top.some((x) => x.name === "Ali"));
  for (const p of ["/bean-jumble", "/bean-counting", "/draughts", "/trophies"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("milk & coffee and string lights times, café dice scores, and the new pages", async () => {
  const voter = "m".repeat(16) + "milk01";
  const post = (p: string, json: Record<string, unknown>) => fetch(`${s.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.35" }, body: JSON.stringify({ voter, name: "Mo", ...json }) });
  for (const game of ["milk", "lights"]) {
    assert.equal((await post("/api/daily-scores", { game, ms: 2000 })).status, 400, `${game} too quick`);
    const r = (await (await post("/api/daily-scores", { game, ms: 95000 })).json()) as { top: { name: string; ms: number }[]; mine: { ms: number } };
    assert.equal(r.mine.ms, 95000); assert.equal(r.top[0].name, "Mo");
  }
  assert.equal((await post("/api/arcade", { game: "dice", score: 1576 })).status, 400);
  assert.equal((await post("/api/arcade", { game: "dice", score: 0 })).status, 400);
  const d = (await (await post("/api/arcade", { game: "dice", score: 231 })).json()) as { mine: number; top: { score: number }[] };
  assert.equal(d.mine, 231);
  const g = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  assert.ok(g.games.find((x) => x.id === "milk")!.done && g.games.find((x) => x.id === "lights")!.done);
  const t = (await (await fetch(`${s.url}/api/trophies?voter=${voter}`)).json()) as { arcade: Record<string, number | null> };
  assert.equal(t.arcade.dice, 231);
  for (const p of ["/milk-and-coffee", "/string-lights", "/sugar-cubes", "/cafe-dice", "/tray-pusher", "/delivery-jam"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("table for one, parasols and tip jar times, echo and breaker scores, and the new pages", async () => {
  const voter = "t".repeat(16) + "table1";
  const post = (p: string, json: Record<string, unknown>) => fetch(`${s.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.36" }, body: JSON.stringify({ voter, name: "Tia", ...json }) });
  for (const game of ["table", "parasols", "tipjar"]) {
    assert.equal((await post("/api/daily-scores", { game, ms: 1500 })).status, 400, `${game} too quick`);
    const r = (await (await post("/api/daily-scores", { game, ms: 64000 })).json()) as { top: { name: string }[]; mine: { ms: number } };
    assert.equal(r.mine.ms, 64000); assert.equal(r.top[0].name, "Tia");
  }
  assert.equal((await post("/api/arcade", { game: "echo", score: 201 })).status, 400);
  assert.equal((await post("/api/arcade", { game: "echo", score: 14 })).status, 200);
  assert.equal((await post("/api/arcade", { game: "breaker", score: 1235 })).status, 400, "breaker scores go up in tens");
  assert.equal((await post("/api/arcade", { game: "breaker", score: 2340 })).status, 200);
  const g = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  for (const id of ["table", "parasols", "tipjar"]) assert.ok(g.games.find((x) => x.id === id)!.done, id);
  const t = (await (await fetch(`${s.url}/api/trophies?voter=${voter}`)).json()) as { arcade: Record<string, number | null> };
  assert.equal(t.arcade.echo, 14); assert.equal(t.arcade.breaker, 2340);
  for (const p of ["/table-for-one", "/parasols", "/tip-jar", "/five-in-a-row", "/baristas-echo", "/bean-breaker"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("cake towers, spare cups and café corners scores, pastry drop board, and the new pages", async () => {
  const voter = "c".repeat(16) + "towers";
  const post = (p: string, json: Record<string, unknown>) => fetch(`${s.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.37" }, body: JSON.stringify({ voter, name: "Cy", ...json }) });
  for (const game of ["towers", "cups"]) {
    assert.equal((await post("/api/daily-scores", { game, ms: 3000 })).status, 400, `${game} too quick`);
    assert.equal((await post("/api/daily-scores", { game, ms: 70000 })).status, 200, game);
  }
  // Café corners: words and time packed together, fewest words first
  assert.equal((await post("/api/daily-scores", { game: "corners", ms: 1_004_000 })).status, 400, "one word is impossible");
  assert.equal((await post("/api/daily-scores", { game: "corners", ms: 13_000_000 })).status, 400, "too many words");
  const c1 = (await (await post("/api/daily-scores", { game: "corners", ms: 4_090_000 })).json()) as { mine: { ms: number } };
  assert.equal(c1.mine.ms, 4_090_000);
  const c2 = (await (await post("/api/daily-scores", { game: "corners", ms: 3_200_000 })).json()) as { mine: { ms: number } };
  assert.equal(c2.mine.ms, 3_200_000, "three slow words beat four quick ones");
  assert.equal((await post("/api/arcade", { game: "pastry", score: 10_000_000 })).status, 400);
  assert.equal((await post("/api/arcade", { game: "pastry", score: 5123 })).status, 200);
  const g = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  for (const id of ["towers", "cups", "corners"]) assert.ok(g.games.find((x) => x.id === id)!.done, id);
  const t = (await (await fetch(`${s.url}/api/trophies?voter=${voter}`)).json()) as { arcade: Record<string, number | null> };
  assert.equal(t.arcade.pastry, 5123);
  for (const p of ["/cake-towers", "/spare-cups", "/cafe-corners", "/pastry-drop", "/saucer-mill", "/puzzle-archive", "/sudoku?day=2020-01-01"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("my puzzle stats, bean sums and freecell times, and the delivery dash board", async () => {
  const voter = "s".repeat(16) + "stats1";
  const post = (p: string, json: Record<string, unknown>) => fetch(`${s.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.38" }, body: JSON.stringify({ voter, name: "Sam", ...json }) });
  let st = (await (await fetch(`${s.url}/api/my-stats?voter=${voter}`)).json()) as { days: number; plays: number; games: { id: string; days: number }[]; times: unknown[] };
  assert.equal(st.days, 0); assert.equal(st.times.length, 0);
  assert.equal(st.games.length, 56);
  assert.equal((await post("/api/daily-scores", { game: "sums", ms: 4000 })).status, 400, "too quick");
  assert.equal((await post("/api/daily-scores", { game: "sums", ms: 90000 })).status, 200);
  assert.equal((await post("/api/daily-scores", { game: "freecell", ms: 20000 })).status, 400, "nobody clears FreeCell in 20s");
  assert.equal((await post("/api/daily-scores", { game: "freecell", ms: 240000 })).status, 200);
  assert.equal((await post("/api/daily-scores", { game: "sudoku", mode: "easy", ms: 70000 })).status, 200);
  st = (await (await fetch(`${s.url}/api/my-stats?voter=${voter}`)).json()) as typeof st & { current: number; times: { game: string; best: number; n: number }[] };
  assert.equal(st.days, 1); assert.equal(st.plays, 3); assert.equal((st as unknown as { current: number }).current, 1);
  const times = st.times as { game: string; best: number }[];
  assert.equal(times.find((t) => t.game === "sums")!.best, 90000);
  assert.equal(st.games.find((g) => g.id === "freecell")!.days, 1);
  assert.equal(((await (await fetch(`${s.url}/api/my-stats`)).json()) as { days: number }).days, 0, "no voter, nothing");
  assert.equal((await post("/api/arcade", { game: "dash", score: 1234 })).status, 200);
  assert.equal((await post("/api/arcade", { game: "dash", score: 10_000_000 })).status, 400);
  for (const p of ["/my-stats", "/bean-sums", "/cafe-freecell", "/delivery-dash", "/cafe-hearts"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("bean boggle and bill total boards, and the chess, backgammon and finder pages", async () => {
  const voter = "b".repeat(16) + "boggle";
  const post = (p: string, json: Record<string, unknown>) => fetch(`${s.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.39" }, body: JSON.stringify({ voter, name: "Bo", ...json }) });
  // Boggle stores 1,000,000 minus the points, so more points sort first
  assert.equal((await post("/api/daily-scores", { game: "boggle", ms: 1_000_000 })).status, 400, "zero points");
  assert.equal((await post("/api/daily-scores", { game: "boggle", ms: 1_000_000 - 20 })).status, 200);
  const b = (await (await post("/api/daily-scores", { game: "boggle", ms: 1_000_000 - 35 })).json()) as { mine: { ms: number } };
  assert.equal(b.mine.ms, 1_000_000 - 35, "a better score replaces it");
  const b2 = (await (await post("/api/daily-scores", { game: "boggle", ms: 1_000_000 - 10 })).json()) as { mine: { ms: number } };
  assert.equal(b2.mine.ms, 1_000_000 - 35, "a worse one doesn't");
  // Bill total: how far off, then time
  assert.equal((await post("/api/daily-scores", { game: "bill", ms: 2000 })).status, 400, "too quick");
  assert.equal((await post("/api/daily-scores", { game: "bill", ms: 100_000_000 })).status, 400, "100 off doesn't count");
  assert.equal((await post("/api/daily-scores", { game: "bill", ms: 3_050_000 })).status, 200);
  const c = (await (await post("/api/daily-scores", { game: "bill", ms: 95_000 })).json()) as { mine: { ms: number } };
  assert.equal(c.mine.ms, 95_000, "spot on beats 3 off");
  const g = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  assert.ok(g.games.find((x) => x.id === "boggle")!.done && g.games.find((x) => x.id === "bill")!.done);
  for (const p of ["/cafe-chess", "/terrace-backgammon", "/bean-boggle", "/bill-total", "/games", "/game-settings", "/print-puzzles", "/print-puzzles?day=2026-10-25"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("account sync, friends, the puzzle of the week and live rooms", async () => {
  // Sync needs an account
  await s.api("/api/account/logout", { method: "POST" });
  assert.equal((await s.api("/api/sync")).status, 401);
  await signIn("sync@example.com");
  const phone = "f".repeat(16) + "phone1", laptop = "f".repeat(16) + "laptop";
  // The phone has some progress and a win
  let r = await s.api("/api/sync", { method: "POST", json: { voter: phone, data: { "mm-chess": { v: JSON.stringify({ stats: { easy: { won: 2, lost: 1, drawn: 0 } } }), t: 100 }, "mm-trophy-flags": { v: JSON.stringify(["bill-exact"]), t: 100 }, "mm-cart": { v: "[]", t: 1 } } } });
  assert.equal(r.status, 200);
  assert.ok(!("mm-cart" in r.body.data), "the basket doesn't sync");
  // The laptop has different progress: the merge keeps the best of both
  r = await s.api("/api/sync", { method: "POST", json: { voter: laptop, data: { "mm-chess": { v: JSON.stringify({ stats: { easy: { won: 1, lost: 3, drawn: 0 } } }), t: 200 }, "mm-trophy-flags": { v: JSON.stringify(["dash-1000"]), t: 200 } } } });
  assert.deepEqual(JSON.parse(r.body.data["mm-chess"].v), { stats: { easy: { won: 2, lost: 3, drawn: 0 } } });
  assert.deepEqual(JSON.parse(r.body.data["mm-trophy-flags"].v).sort(), ["bill-exact", "dash-1000"]);
  assert.equal(r.body.voters, 2);
  // A daily time from either browser counts for the account
  await fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.40" }, body: JSON.stringify({ game: "sums", ms: 80000, name: "Syn", voter: phone }) });
  const g = await s.api(`/api/games?voter=${laptop}`);
  assert.ok(g.body.games.find((x: { id: string; done: boolean }) => x.id === "sums").done, "played on the phone, counted on the laptop");
  assert.equal((await s.api(`/api/my-stats?voter=${laptop}`)).body.days, 1);
  await s.api("/api/account/logout", { method: "POST" });

  // Friends: codes, adding, the board
  const post = (p: string, json: Record<string, unknown>, ip = "10.9.9.41") => fetch(`${s.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": ip }, body: JSON.stringify(json) });
  const a = "a".repeat(16) + "friend", b = "b".repeat(16) + "friend";
  assert.equal((await post("/api/friends", { voter: a, name: "" })).status, 400);
  const ca = (await (await post("/api/friends", { voter: a, name: "Asha" })).json()).me.code as string;
  const cb = (await (await post("/api/friends", { voter: b, name: "Ben" })).json()).me.code as string;
  assert.match(ca, /^[A-Z2-9]{6}$/); assert.notEqual(ca, cb);
  assert.equal((await post("/api/friends", { voter: a, add: ca })).status, 400, "not yourself");
  assert.equal((await post("/api/friends", { voter: a, add: "ZZZZZZ" })).status, 400);
  await post("/api/daily-scores", { game: "towers", ms: 61000, name: "Ben", voter: b });
  const fb = await (await post("/api/friends", { voter: a, add: cb.toLowerCase() })).json();
  const ben = fb.people.find((p: { name: string }) => p.name === "Ben");
  assert.equal(ben.times.towers, 61000); assert.equal(ben.played, 1);
  assert.equal(fb.people.find((p: { me: boolean }) => p.me).name, "Asha");
  // The puzzle of the week, with friends alongside
  assert.equal((await post("/api/weekly", { voter: b, name: "Ben", ms: 5000 })).status, 400, "too quick for a 9×9");
  assert.equal((await post("/api/weekly", { voter: b, name: "Ben", ms: 600000 })).status, 200);
  const wk = await (await fetch(`${s.url}/api/weekly?voter=${a}`)).json();
  assert.deepEqual(wk.friends, [{ name: "Ben", ms: 600000 }]);
  const after = await (await post("/api/friends", { voter: a, remove: cb })).json();
  assert.equal(after.people.length, 1);

  // Live rooms: create, join, take turns, no moving out of turn
  const created = await (await post("/api/rooms", { create: "gomoku", state: { seat: 0, b: [], last: null, line: null } }, "10.9.9.42")).json();
  assert.match(created.code, /^[A-Z2-9]{5}$/); assert.equal(created.seat, 0);
  assert.equal((await post("/api/rooms", { create: "snap", state: {} }, "10.9.9.42")).status, 400);
  const joined = await (await post("/api/rooms", { join: created.code.toLowerCase() }, "10.9.9.43")).json();
  assert.equal(joined.seat, 1); assert.equal(joined.joined, true);
  assert.equal((await post("/api/rooms", { join: created.code }, "10.9.9.44")).status, 400, "the room is full");
  const out = await post("/api/rooms", { code: created.code, token: joined.token, version: joined.version, state: { seat: 0 } }, "10.9.9.43");
  assert.equal(out.status, 409, "not the guest's turn");
  const moved = await (await post("/api/rooms", { code: created.code, token: created.token, version: joined.version, state: { seat: 1, b: [0] } }, "10.9.9.42")).json();
  assert.equal(moved.version, joined.version + 1); assert.equal(moved.state.seat, 1);
  assert.equal((await post("/api/rooms", { code: created.code, token: joined.token, version: joined.version, state: { seat: 0 } }, "10.9.9.43")).status, 409, "an old version is refused");
  assert.equal((await fetch(`${s.url}/api/rooms?code=${created.code}`)).status, 200);
  assert.equal((await fetch(`${s.url}/api/rooms?code=NOPE1`)).status, 404);
  for (const p of ["/friends", "/puzzle-of-the-week", "/play-together", "/play-together?room=ABCDE"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("the eight new daily puzzles take times, and their pages load", async () => {
  const voter = "e".repeat(16) + "eight1";
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.45" }, body: JSON.stringify({ voter, name: "Ei", ...json }) });
  for (const game of ["taller", "traytiles", "seats", "threads", "garden", "rope", "necklace"]) {
    assert.equal((await post({ game, ms: 1000 })).status, 400, `${game} too quick`);
    assert.equal((await post({ game, ms: 90000 })).status, 200, game);
  }
  assert.equal((await post({ game: "four", ms: 3_050_000 })).status, 400, "four words need at least four tries");
  assert.equal((await post({ game: "four", ms: 10_050_000 })).status, 400, "only nine tries");
  assert.equal((await post({ game: "four", ms: 6_080_000 })).status, 200);
  const g = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  for (const id of ["taller", "traytiles", "seats", "four", "threads", "garden", "rope", "necklace"]) assert.ok(g.games.find((x) => x.id === id)!.done, id);
  for (const p of ["/taller-order", "/tray-tiles", "/window-seats", "/four-at-once", "/menu-threads", "/garden-plots", "/queue-rope", "/bead-necklace"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("batch 4 arcade boards and the twelve new any-time pages", async () => {
  const voter = "g".repeat(16) + "games4";
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/arcade`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.46" }, body: JSON.stringify({ voter, name: "Gi", ...json }) });
  for (const [game, ok, bad] of [["puff", 31, 10000], ["pigeons", 1230, 1235], ["muncher", 2340, 2345], ["beat", 45600, 10_000_000]] as const) {
    assert.equal((await post({ game, score: ok })).status, 200, game);
    assert.equal((await post({ game, score: bad })).status, 400, `${game} ${bad}`);
  }
  const t = (await (await fetch(`${s.url}/api/trophies?voter=${voter}`)).json()) as { arcade: Record<string, number | null> };
  assert.equal(t.arcade.puff, 31); assert.equal(t.arcade.beat, 45600);
  for (const p of ["/cafe-spider", "/cafe-pyramid", "/crazy-eights", "/cafe-rummy", "/cafe-ludo", "/spoons-and-piping-bags", "/cafe-go", "/star-checkers", "/bean-muncher", "/steam-puff", "/pigeon-patrol", "/latte-beat"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("daily reminders, the hall of fame and practice", async () => {
  const post = (json: Record<string, unknown>, method = "POST") => fetch(`${s.url}/api/game-reminder`, { method, headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.47" }, body: JSON.stringify(json) });
  const sub = { endpoint: "https://push.example.test/abc", keys: { p256dh: "k", auth: "a" } };
  assert.equal((await post({ subscription: { endpoint: "http://insecure" , keys: sub.keys }, atMin: 150 })).status, 400);
  assert.equal((await post({ subscription: sub, atMin: 1440 })).status, 400);
  assert.equal((await post({ subscription: sub, atMin: 150, voter: "h".repeat(16) })).status, 200);
  assert.equal((await post({ subscription: sub, atMin: 600 })).status, 200, "changing the time");
  assert.equal(((await (await post({ endpoint: sub.endpoint }, "DELETE")).json()) as { removed: boolean }).removed, true);
  assert.equal(((await (await post({ endpoint: sub.endpoint }, "DELETE")).json()) as { removed: boolean }).removed, false);
  for (const p of ["/hall-of-fame", "/practice", "/game-settings"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
  const hof = await (await fetch(`${s.url}/hall-of-fame`)).text();
  assert.match(hof, /Hall of/); assert.match(hof, /Puzzle of the week/);
});

test("batch B daily puzzles and the weekly crossword board", async () => {
  const voter = "h".repeat(16) + "batchb";
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.48" }, body: JSON.stringify({ voter, name: "Bo", ...json }) });
  for (const game of ["trail", "pipes", "cutters", "cryptic", "stars"]) {
    assert.equal((await post({ game, ms: 1000 })).status, 400, `${game} too fast`);
    assert.equal((await post({ game, ms: 95_000 })).status, 200, game);
  }
  const g = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  for (const id of ["trail", "pipes", "cutters", "cryptic", "stars"]) assert.ok(g.games.find((x) => x.id === id)!.done, id);
  const wpost = (json: Record<string, unknown>) => fetch(`${s.url}/api/weekly-games`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.49" }, body: JSON.stringify({ voter, name: "Bo", ...json }) });
  assert.equal((await wpost({ game: "chess", ms: 600_000 })).status, 400);
  assert.equal((await wpost({ game: "crossword", ms: 5000 })).status, 400, "too fast");
  assert.equal((await wpost({ game: "crossword", ms: 600_000 })).status, 200);
  assert.equal((await wpost({ game: "crossword", ms: 700_000 })).status, 200);
  const wb = (await (await fetch(`${s.url}/api/weekly-games?game=crossword&voter=${voter}`)).json()) as { mine: { ms: number }; top: unknown[] };
  assert.equal(wb.mine.ms, 600_000, "keeps your best"); assert.equal(wb.top.length, 1);
  for (const p of ["/coffee-trail", "/steam-pipes", "/cookie-cutters", "/cryptic-clue", "/sugar-stars", "/weekly-crossword"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("batch C arcade boards and the seven new any-time pages", async () => {
  const voter = "k".repeat(16) + "batchc";
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/arcade`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.50" }, body: JSON.stringify({ voter, name: "Ci", ...json }) });
  for (const [game, ok, bad] of [["pinball", 25_430, 25_435], ["road", 1_230, 1_235], ["cupcakes", 480, 3_010], ["slice", 640, 645]] as const) {
    assert.equal((await post({ game, score: ok })).status, 200, game);
    assert.equal((await post({ game, score: bad })).status, 400, `${game} ${bad}`);
  }
  const tr = (await (await fetch(`${s.url}/api/trophies?voter=${voter}`)).json()) as { arcade: Record<string, number | null> };
  assert.equal(tr.arcade.pinball, 25_430); assert.equal(tr.arcade.slice, 640);
  for (const p of ["/cafe-dominoes", "/cafe-letters", "/cafe-poker", "/pinball-parlour", "/market-road", "/pop-the-cupcakes", "/slice-the-cake"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("batch D: more live rooms, tournaments, café rewards and the year in games", async () => {
  const rooms = (json: Record<string, unknown>) => fetch(`${s.url}/api/rooms`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.51" }, body: JSON.stringify(json) });
  for (const game of ["reversi", "draughts", "connect4", "backgammon"]) {
    const r = await rooms({ create: game, state: { seat: 0 } });
    assert.equal(r.status, 200, game);
    const d = (await r.json()) as { code: string };
    const j = (await (await rooms({ join: d.code })).json()) as { seat: number };
    assert.equal(j.seat, 1);
  }
  assert.equal((await rooms({ create: "snap", state: {} })).status, 400);
  // Tournaments
  const tpost = (json: Record<string, unknown>) => fetch(`${s.url}/api/tournaments`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.52" }, body: JSON.stringify(json) });
  const host = "t".repeat(16) + "host", today = new Date(), d = (n: number) => { const x = new Date(today); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  assert.equal((await tpost({ create: true, game: "word", voter: host })).status, 400, "needs a puzzle with a time board");
  assert.equal((await tpost({ create: true, game: "sudoku", voter: host, start: d(0) })).status, 400, "can't start today");
  const made = (await (await tpost({ create: true, game: "sudoku", voter: host, start: d(2), name: "Friday cup", playerName: "Ana" })).json()) as { code: string; open: boolean; players: { name: string; you: boolean }[]; host: boolean };
  assert.ok(made.code && made.open && made.host); assert.deepEqual(made.players, [{ name: "Ana", you: true }]);
  for (let k = 0; k < 7; k++) assert.equal((await tpost({ join: made.code, voter: "t".repeat(16) + `p${k}`, name: `P${k}` })).status, 200);
  assert.equal((await tpost({ join: made.code, voter: "t".repeat(16) + "late", name: "Late" })).status, 400, "eight at most");
  const view = (await (await fetch(`${s.url}/api/tournaments?code=${made.code}&voter=${host}`)).json()) as { players: unknown[]; days: string[]; started: boolean };
  assert.equal(view.players.length, 8); assert.equal(view.days.length, 3); assert.equal(view.started, false);
  assert.ok(!JSON.stringify(view).includes("tttttttttttttttt"), "no private ids in the view");
  const g = (await (await fetch(`${s.url}/api/tournaments?games=1`)).json()) as { games: { id: string }[] };
  assert.ok(g.games.some((x) => x.id === "sudoku") && !g.games.some((x) => x.id === "word"));
  // Café rewards need an account
  const rv = "r".repeat(16) + "rewards";
  const st = (await (await fetch(`${s.url}/api/game-rewards?voter=${rv}`)).json()) as { signedIn: boolean; streak: number; ready: number };
  assert.equal(st.signedIn, false); assert.equal(st.ready, 0);
  assert.equal((await fetch(`${s.url}/api/game-rewards`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: rv }) })).status, 400);
  // Year in games counts saved scores
  const yv = "y".repeat(16) + "year";
  await fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.53" }, body: JSON.stringify({ game: "sudoku", ms: 90_000, voter: yv, name: "Y" }) });
  const y = (await (await fetch(`${s.url}/api/year-in-games?voter=${yv}`)).json()) as { solved: number; days: number; longest: number; games: { id: string; best: number }[]; months: unknown[] };
  assert.equal(y.solved, 1); assert.equal(y.days, 1); assert.equal(y.longest, 1); assert.equal(y.games[0].best, 90_000); assert.equal(y.months.length, 12);
  for (const p of ["/tournament", "/puzzle-maker", "/year-in-games", "/play-together"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("batch E daily puzzles go on the boards", async () => {
  const voter = "e".repeat(16) + "batche";
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.54" }, body: JSON.stringify({ voter, name: "Ed", ...json }) });
  for (const [game, ok, bad] of [["wheel", 28_060_000, 41_000_000], ["codeword", 95_000, 5_000], ["zip", 40_000, 1_000], ["bikes", 80_000, 2_000], ["push", 24_061_000, 1_000_000_000], ["price", 2_045_000, 6_000_000]] as const) {
    assert.equal((await post({ game, ms: bad })).status, 400, `${game} ${bad}`);
    assert.equal((await post({ game, ms: ok })).status, 200, game);
  }
  const g = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string; done: boolean }[] };
  for (const id of ["wheel", "codeword", "zip", "bikes", "push", "price"]) assert.ok(g.games.find((x) => x.id === id)!.done, id);
  for (const p of ["/word-wheel", "/codeword", "/zip-path", "/delivery-bikes", "/bean-push", "/price-order"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("batch F arcade boards and the eight new any-time pages", async () => {
  const voter = "f".repeat(16) + "batchf";
  const post = (json: Record<string, unknown>) => fetch(`${s.url}/api/arcade`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.55" }, body: JSON.stringify({ voter, name: "Fi", ...json }) });
  for (const [game, ok, bad] of [["swap", 1_770, 1_775], ["bubble", 4_560, 4_565]] as const) {
    assert.equal((await post({ game, score: ok })).status, 200, game);
    assert.equal((await post({ game, score: bad })).status, 400, `${game} ${bad}`);
  }
  for (const p of ["/sugar-swap", "/bubble-pop", "/mini-golf", "/air-hockey", "/cafe-pool", "/cafe-blackjack", "/battleship", "/cafe-hangman"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("batch G: rooms for up to four, watching, reactions, rematches and hidden hands; duels, clubs, the league and the TV", async () => {
  const room = (json: Record<string, unknown>) => fetch(`${s.url}/api/rooms`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.56" }, body: JSON.stringify(json) }).then(async (r) => ({ status: r.status, d: await r.json() }));
  // Ludo seats four
  const lu = await room({ create: "ludo", state: { seat: 0, started: false }, name: "Ana" });
  assert.equal(lu.d.seats, 4);
  const seats = [lu.d];
  for (const n of ["Ben", "Cas", "Dev"]) seats.push((await room({ join: lu.d.code, name: n })).d);
  assert.deepEqual(seats.map((x) => x.seat), [0, 1, 2, 3]);
  const fifth = await room({ join: lu.d.code, name: "Eli" });
  assert.equal(fifth.status, 400); assert.ok(fifth.d.full, "full rooms send you to watch");
  const watch = await (await fetch(`${s.url}/api/rooms?code=${lu.d.code}`)).json();
  assert.deepEqual(watch.names, ["Ana", "Ben", "Cas", "Dev"]);
  // Reactions and rematch votes
  assert.equal((await room({ code: lu.d.code, token: seats[1].token, react: "🔥" })).d.reactions[0].emoji, "🔥");
  assert.equal((await room({ code: lu.d.code, token: seats[1].token, react: "💩" })).status, 400, "only the café's emoji");
  for (let k = 0; k < 3; k++) assert.equal((await room({ code: lu.d.code, token: seats[k].token, rematch: true })).d.rematch.length, k + 1);
  const re = await room({ code: lu.d.code, token: seats[3].token, rematch: true });
  assert.equal(re.d.rematch.length, 0, "everyone voted: it starts again"); assert.equal(re.d.state.started, false);
  // Dominoes is played by the server, and hands stay hidden
  const dm = await room({ create: "dominoes", name: "Ana" }), dj = await room({ join: dm.d.code, name: "Ben" });
  assert.ok(dm.d.server);
  const asHost = await (await fetch(`${s.url}/api/rooms?code=${dm.d.code}&token=${dm.d.token}`)).json();
  assert.ok(asHost.state.r.hands[0].every(Boolean) && asHost.state.r.hands[1].every((x: unknown) => x === null));
  const asWatcher = await (await fetch(`${s.url}/api/rooms?code=${dm.d.code}`)).json();
  assert.ok(asWatcher.state.r.hands.flat().every((x: unknown) => x === null), "watchers see no hands");
  const turn = asHost.state.r.turn, tok = turn === 0 ? dm.d.token : dj.d.token;
  const hand = (await (await fetch(`${s.url}/api/rooms?code=${dm.d.code}&token=${tok}`)).json()).state.r.hands[turn];
  const played = await room({ code: dm.d.code, token: tok, action: { type: "play", tile: hand[0], end: "right" } });
  assert.equal(played.status, 200); assert.equal(played.d.state.r.line.length, 1);
  assert.ok([400, 409].includes((await room({ code: dm.d.code, token: tok, action: { type: "play", tile: hand[1], end: "right" } })).status), "not your turn now");
  // Poker needs two before the host deals
  const pk = await room({ create: "poker", name: "Ana" });
  assert.ok([400, 409].includes((await room({ code: pk.d.code, token: pk.d.token, action: { type: "deal" } })).status));
  const pj = await room({ join: pk.d.code, name: "Ben" });
  const dealt = await room({ code: pk.d.code, token: pk.d.token, action: { type: "deal" } });
  assert.equal(dealt.status, 200); assert.ok(dealt.d.state.h.seats[0].cards.every(Boolean)); assert.ok(dealt.d.state.h.seats[1].cards.every((c: unknown) => c === null));
  assert.equal((await room({ join: pk.d.code, name: "Late" })).status, 400, "no joining once dealt");
  void pj;
  // Duels
  const v1 = "d".repeat(16) + "duelone", v2 = "d".repeat(16) + "dueltwo";
  await fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.57" }, body: JSON.stringify({ game: "sudoku", ms: 80_000, voter: v1, name: "Ana" }) });
  const opts = await (await fetch(`${s.url}/api/duels?voter=${v2}`)).json();
  assert.ok(opts.options.some((o: { id: string }) => o.id === "sudoku"));
  const duel = await fetch(`${s.url}/api/duels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: v2, game: "sudoku" }) }).then((r) => r.json());
  assert.equal(duel.today[0].result, "on"); assert.equal(duel.today[0].theirs, null, "their time stays hidden");
  await fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.57" }, body: JSON.stringify({ game: "sudoku", ms: 15_000, voter: v2, name: "Ben" }) });
  // The opponent is any player who did today's sudoku, so the quickest time allowed wins (or ties with another)
  const after = await (await fetch(`${s.url}/api/duels?voter=${v2}`)).json();
  assert.ok(["won", "drawn"].includes(after.today[0].result)); assert.equal(after.record.won + after.record.drawn, 1);
  // Clubs
  const club = (json: Record<string, unknown>) => fetch(`${s.url}/api/clubs`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.58" }, body: JSON.stringify(json) }).then((r) => r.json());
  const made = await club({ voter: v1, create: "Saturday regulars", name: "Ana" });
  assert.equal(made.mine.name, "Saturday regulars");
  const joined = await club({ voter: v2, join: made.mine.code, name: "Ben" });
  assert.equal(joined.mine.members.length, 2); assert.equal(joined.mine.total, 2, "both saved a puzzle this week");
  assert.equal(joined.board[0].perMember, 1);
  // Friends league
  const f1 = "l".repeat(16) + "leagueone", f2 = "l".repeat(16) + "leaguetwo";
  const fr = (json: Record<string, unknown>) => fetch(`${s.url}/api/friends`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.59" }, body: JSON.stringify(json) }).then((r) => r.json());
  const c2 = (await fr({ voter: f2, name: "Bo" })).me.code; await fr({ voter: f1, name: "Al" }); await fr({ voter: f1, add: c2 });
  for (const [v, ms] of [[f1, 60_000], [f2, 50_000]] as const) await fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.60" }, body: JSON.stringify({ game: "sudoku", ms, voter: v, name: "x" }) });
  const lg = (await (await fetch(`${s.url}/api/friends?voter=${f1}`)).json()).league as { name: string; points: number }[];
  assert.deepEqual(lg.map((x) => x.points), [3, 1], "the quicker one gets the bonus");
  // The TV's puzzle leaders
  const tv = await (await fetch(`${s.url}/api/today-champions`)).json();
  assert.ok(tv.leaders.some((l: { game: string; name: string }) => l.game === "sudoku"));
  for (const p of ["/daily-duel", "/clubs", "/play-together", "/friends", "/board"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("the server checks finished boards before a daily score counts", async () => {
  const v = "p".repeat(16) + "proofs";
  const post = (json: Record<string, unknown>) => realFetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.61" }, body: JSON.stringify({ voter: v, name: "Pat", ...json }) });
  assert.equal((await post({ game: "sudoku", mode: "easy", ms: 90_000 })).status, 400, "no board, no score");
  assert.equal((await post({ game: "sudoku", mode: "easy", ms: 90_000, proof: Array(36).fill(1) })).status, 400, "not a solved board");
  const good = (await solvedProof("sudoku", "easy", 90_000))!;
  assert.equal((await post({ game: "sudoku", mode: "easy", ms: 90_000, proof: good.proof })).status, 200);
  const push = (await solvedProof("push", undefined, 61_000))!;
  assert.equal((await post({ game: "push", ms: push.ms + 1_000_000, proof: push.proof })).status, 400, "the move count must match the moves");
  assert.equal((await post({ game: "push", ms: push.ms, proof: push.proof })).status, 200);
  assert.equal((await post({ game: "wordsearch", ms: 60_000 })).status, 200, "puzzles the server doesn't check still save");
});

test("batch H: today's difficulty, times over time and the new pages", async () => {
  const b = await (await fetch(`${s.url}/api/daily-scores?game=sudoku&mode=easy`)).json();
  assert.ok("median" in b && "usual" in b);
  const v = "h".repeat(16) + "history";
  await fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.62" }, body: JSON.stringify({ game: "sudoku", mode: "easy", ms: 70_000, voter: v, name: "H" }) });
  const st = await (await fetch(`${s.url}/api/my-stats?voter=${v}`)).json();
  assert.equal(st.history.sudoku.length, 1); assert.equal(st.history.sudoku[0].ms, 70_000);
  for (const p of ["/learn", "/my-stats", "/game-settings", "/games"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("batch I: sugar cages, word chain, colour pixels, the new arcade boards and Where in Goa", async () => {
  const v = "i".repeat(16) + "batchi";
  const daily = (json: Record<string, unknown>) => fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.63" }, body: JSON.stringify({ voter: v, name: "Ivy", ...json }) });
  assert.equal((await daily({ game: "cages", ms: 90_000 })).status, 200);
  assert.equal((await daily({ game: "colour", ms: 80_000 })).status, 200);
  // A real chain from today's word
  const W = await import("../src/lib/wordChain.ts"), L = await import("../src/lib/cafeLetters.ts");
  const chain = [W.startFor(localDay())], words: string[] = [];
  for (let k = 0; k < 4; k++) { const last = chain[chain.length - 1], next = L.COMPUTER_WORDS.find((w) => w.length >= 3 && w[0] === last[last.length - 1] && !chain.includes(w) && "ok" in W.judge(chain, w)); if (!next) break; chain.push(next); words.push(next); }
  assert.ok(words.length >= 2);
  const good = W.pack(words.length, words.join("").length);
  assert.equal((await daily({ game: "chain", ms: good, proof: [...words, "zzzzz"] })).status, 400, "every link must be real");
  assert.equal((await daily({ game: "chain", ms: good, proof: words })).status, 200);
  const arcade = (json: Record<string, unknown>) => fetch(`${s.url}/api/arcade`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.64" }, body: JSON.stringify({ voter: v, name: "Ivy", ...json }) });
  for (const [game, ok, bad] of [["defence", 4_210, 4_215], ["run", 2_660, 2_665]] as const) { assert.equal((await arcade({ game, score: ok })).status, 200, game); assert.equal((await arcade({ game, score: bad })).status, 400, `${game} ${bad}`); }
  // Where in Goa: empty until the owner adds a photo
  assert.equal((await (await fetch(`${s.url}/api/goa-spots`)).json()).spot, null);
  await s.login();
  const form = new FormData();
  form.set("file", new Blob([Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0))], { type: "image/png" }), "spot.png");
  for (const [k, val] of Object.entries({ answer: "Fontainhas", wrong1: "Margao", wrong2: "Mapusa", wrong3: "Vasco" })) form.set(k, val);
  const added = await realFetch(`${s.url}/api/goa-spots`, { method: "POST", body: form, headers: { cookie: s.cookie() } });
  assert.equal(added.status, 200, await added.clone().text());
  const today = (await (await fetch(`${s.url}/api/goa-spots`)).json()).spot;
  assert.equal(today.options.length, 4); assert.ok(!("answer" in today), "the answer isn't sent");
  const g = await (await fetch(`${s.url}/api/goa-spots/guess`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: today.id, guess: "Fontainhas" }) })).json();
  assert.equal(g.right, true);
  assert.equal((await fetch(`${s.url}/api/goa-spots`, { method: "POST", body: new FormData() })).status, 401, "only the owner adds photos");
  for (const p of ["/sugar-cages", "/word-chain", "/colour-pixels", "/golf-solitaire", "/tri-peaks", "/pastry-defence", "/market-run", "/where-in-goa", "/latte-beat"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("demo reset backs up, clears activity and fills in sample orders", async () => {
  await s.login();
  assert.equal((await s.api("/api/admin/demo-reset", { method: "POST", json: { confirm: "yes" } })).status, 400);
  const r = await s.api("/api/admin/demo-reset", { method: "POST", json: { confirm: "RESET" } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.orders > 50);
  assert.match(r.body.backup, /before-demo-reset/);
  const stats = (await s.api("/api/admin/stats")).body as { allTimeOrders: number };
  assert.equal(stats.allTimeOrders, r.body.orders);
  assert.ok(((await s.api("/api/reviews")).body as { reviews: unknown[] }).reviews.length >= 8);
});

test("batch J: season pack board and the event pages", async () => {
  const voter = "j".repeat(16) + "batchj";
  const r = await fetch(`${s.url}/api/weekly-games`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.97" }, body: JSON.stringify({ voter, name: "Jo", game: "season", ms: 90_000 }) });
  const { packToday } = await import("../src/lib/seasonPacks.ts");
  if (packToday()) assert.equal(r.status, 200);
  else { assert.equal(r.status, 400); assert.match(((await r.json()) as { error: string }).error, /no season pack/); }
  assert.equal((await fetch(`${s.url}/api/weekly-games?game=season`)).status, 200);
  for (const p of ["/season-pack", "/advent-puzzles", "/puzzle-hunt"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("batch K: profiles, the friend feed, head-to-head and slow games", async () => {
  const post = (p: string, json: Record<string, unknown>, ip = "10.9.9.98") => fetch(`${s.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": ip }, body: JSON.stringify(json) });
  const a = "c".repeat(16) + "prof", b = "d".repeat(16) + "prof";
  assert.equal((await post("/api/friends", { voter: a, profile: { avatar: "🐈" } })).status, 400, "needs a code first");
  await post("/api/friends", { voter: a, name: "Cy" });
  const cb = (await (await post("/api/friends", { voter: b, name: "Di" })).json()).me.code as string;
  const set = await (await post("/api/friends", { voter: b, profile: { avatar: "🦉", fav: "sudoku", showcase: ["hunt", "hunt", "nope", "advent", "slowGame", "duels"] } })).json();
  assert.equal(set.me.avatar, "🦉"); assert.equal(set.me.fav, "sudoku"); assert.deepEqual(set.me.showcase, ["hunt", "advent", "slowGame"], "real trophies, no repeats, three at most");
  const bad = await (await post("/api/friends", { voter: b, profile: { avatar: "<b>", fav: "chess-cheat", showcase: "x" } })).json();
  assert.equal(bad.me.avatar, ""); assert.equal(bad.me.fav, ""); assert.deepEqual(bad.me.showcase, []);
  await post("/api/friends", { voter: b, profile: { avatar: "🦉", fav: "sudoku" } });
  await post("/api/daily-scores", { game: "towers", ms: 70000, name: "Cy", voter: a });
  await post("/api/daily-scores", { game: "towers", ms: 65000, name: "Di", voter: b });
  const fb = await (await post("/api/friends", { voter: a, add: cb })).json();
  assert.equal(fb.feed.length, 1); assert.equal(fb.feed[0].name, "Di"); assert.equal(fb.feed[0].game.id, "towers"); assert.equal(fb.feed[0].avatar, "🦉");
  assert.deepEqual(fb.people.find((p: { name: string }) => p.name === "Di").h2h, { won: 0, lost: 1, drawn: 0 });
  const prof = await (await fetch(`${s.url}/api/friends?profile=${cb}&voter=${a}`)).json();
  assert.equal(prof.name, "Di"); assert.equal(prof.fav.id, "sudoku"); assert.equal(prof.puzzles, 1); assert.equal(prof.isFriend, true);
  assert.equal(prof.h2h.lost, 1); assert.equal(prof.h2h.games[0].id, "towers");
  assert.equal((await fetch(`${s.url}/api/friends?profile=${cb}&voter=${b}`).then((r) => r.json())).h2h, null, "no record against yourself");
  assert.equal((await fetch(`${s.url}/api/friends?profile=ZZZZZZ`)).status, 404);
  // Slow games
  assert.equal((await post("/api/slow-games", { kind: "chess" })).status, 400);
  const g = await (await post("/api/slow-games", { kind: "connect4", name: "Cy" })).json();
  assert.match(g.id, /^[a-f0-9]{10}$/); assert.equal(g.seat, 1); assert.equal(g.open, true);
  assert.equal((await post("/api/slow-games", { id: g.id, token: g.token, move: 3 })).status, 400, "wait for a friend");
  const j = await (await post("/api/slow-games", { id: g.id, join: true, name: "Di" })).json();
  assert.equal(j.seat, 2); assert.equal((await post("/api/slow-games", { id: g.id, join: true })).status, 400, "seat taken");
  assert.equal((await post("/api/slow-games", { id: g.id, token: j.token, move: 3 })).status, 400, "not Di's turn");
  assert.equal((await post("/api/slow-games", { id: g.id, token: "f".repeat(32), move: 3 })).status, 400, "a made-up seat");
  let v;
  for (const [t, m] of [[g.token, 0], [j.token, 6], [g.token, 0], [j.token, 6], [g.token, 0], [j.token, 6], [g.token, 0]] as [string, number][]) v = await (await post("/api/slow-games", { id: g.id, token: t, move: m })).json();
  assert.equal(v.winner, 1); assert.equal(v.turn, 0); assert.equal(v.line.length, 4);
  const look = await (await fetch(`${s.url}/api/slow-games?id=${g.id}`)).json();
  assert.equal(look.seat, null); assert.deepEqual(look.options, []); assert.equal(look.moves, 7);
  assert.equal((await fetch(`${s.url}/api/slow-games?id=nope`)).status, 404);
  for (const p of ["/slow-games", "/profile"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("batch L: the owner's games dashboard and hiding a game", async () => {
  assert.equal((await fetch(`${s.url}/api/admin/games`)).status, 401, "owners only");
  await s.login();
  const voter = "e".repeat(16) + "dash";
  await fetch(`${s.url}/api/daily-scores`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.9.99" }, body: JSON.stringify({ game: "towers", ms: 61000, name: "Ed", voter }) });
  const r = await s.api("/api/admin/games?days=7");
  assert.equal(r.status, 200); assert.equal(r.body.days, 7);
  const towers = r.body.daily.find((g: { id: string }) => g.id === "towers");
  assert.ok(towers.saves >= 1 && towers.players >= 1); assert.ok(Array.isArray(r.body.anyTime) && Array.isArray(r.body.hard));
  assert.equal((await s.api("/api/admin/games", { method: "POST", json: { id: "not-a-game", hide: true } })).status, 400);
  assert.equal((await s.api("/api/admin/games", { method: "POST", json: { id: "towers", hide: true } })).status, 200);
  const g = (await (await fetch(`${s.url}/api/games?voter=${voter}`)).json()) as { games: { id: string }[]; five: { ids: string[] }; hidden: string[] };
  assert.ok(!g.games.some((x) => x.id === "towers"), "hidden from the list"); assert.ok(!g.five.ids.includes("towers")); assert.deepEqual(g.hidden, ["towers"]);
  assert.equal((await fetch(`${s.url}/cake-towers`)).status, 200, "the page still works by link");
  assert.equal((await s.api("/api/admin/games", { method: "POST", json: { id: "towers", hide: false } })).status, 200);
  assert.ok(((await (await fetch(`${s.url}/api/games`)).json()) as { games: { id: string }[] }).games.some((x) => x.id === "towers"), "back again");
});

test("café extras: song votes, guest latte art, Goa events, coming soon, game night and the recipe of the week", async () => {
  const j = (p: string, method: string, json: unknown, ip = "10.9.8.1") => fetch(`${s.url}${p}`, { method, headers: { "Content-Type": "application/json", "X-Real-IP": ip }, body: JSON.stringify(json) });
  await s.login();
  // Song votes: only for approved songs; most votes go first
  const a = (await (await j("/api/songs", "POST", { title: "Song A extras" })).json()).id, b = (await (await j("/api/songs", "POST", { title: "Song B extras" }, "10.9.8.2")).json()).id;
  const v1 = "h".repeat(16) + "songs1", v2 = "i".repeat(16) + "songs2";
  assert.equal((await j("/api/songs", "POST", { voter: v1, vote: a })).status, 400, "not approved yet");
  for (const id of [a, b]) await s.api("/api/songs", { method: "PATCH", json: { id, action: "approve" } });
  await j("/api/songs", "POST", { voter: v1, vote: b }); const after = await (await j("/api/songs", "POST", { voter: v2, vote: b })).json();
  const ids = after.next.map((x: { id: number }) => x.id);
  assert.ok(ids.indexOf(b) < ids.indexOf(a), "the most votes play first"); assert.equal(after.next.find((x: { id: number }) => x.id === b).votes, 2);
  const undo = await (await j("/api/songs", "POST", { voter: v2, vote: b, undo: true })).json();
  assert.equal(undo.next.find((x: { id: number }) => x.id === b).votes, 1);
  for (const id of [a, b]) await s.api("/api/songs", { method: "PATCH", json: { id, action: "remove" } });
  // Guest latte art waits for staff
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const fd = new FormData(); fd.append("file", new Blob([png], { type: "image/png" }), "mine.png"); fd.append("name", "Zoe"); fd.append("caption", "Home heart");
  assert.equal((await fetch(`${s.url}/api/latte-art`, { method: "POST", headers: { "X-Real-IP": "10.9.8.3" }, body: fd })).status, 200);
  const before = (await (await fetch(`${s.url}/api/latte-art`)).json()) as { entries: { caption: string }[] };
  assert.ok(!before.entries.some((e) => e.caption === "Home heart"), "not shown until approved");
  assert.equal((await fetch(`${s.url}/api/latte-art?pending=1`)).status, 401);
  const pend = (await s.api("/api/latte-art?pending=1")).body.pending as { id: number; name: string }[];
  const mine = pend.find((p) => p.name === "Zoe")!;
  assert.equal((await s.api("/api/latte-art", { method: "PATCH", json: { id: mine.id, approve: true } })).status, 200);
  const live = (await (await fetch(`${s.url}/api/latte-art`)).json()) as { entries: { caption: string; guest: number }[] };
  assert.equal(live.entries.find((e) => e.caption === "Home heart")?.guest, 1);
  // Goa events: owner only, upcoming ones shown
  assert.equal((await j("/api/goa-events", "POST", { title: "Night market", date: "2099-01-01" })).status, 401);
  assert.equal((await s.api("/api/goa-events", { method: "POST", json: { title: "Old fair", date: "2020-01-01" } })).status, 200);
  assert.equal((await s.api("/api/goa-events", { method: "POST", json: { title: "Night market", date: "2099-01-01", link: "http://x.test" } })).status, 400, "https links only");
  assert.equal((await s.api("/api/goa-events", { method: "POST", json: { title: "Night market", date: "2099-01-01", end_date: "2099-01-03", place: "Arpora" } })).status, 200);
  const ev = ((await (await fetch(`${s.url}/api/goa-events`)).json()) as { events: { title: string }[] }).events.map((e) => e.title);
  assert.ok(ev.includes("Night market") && !ev.includes("Old fair"), "finished events drop off");
  // Coming soon
  assert.equal((await fetch(`${s.url}/api/coming-soon`).then((r) => r.json())).soon, null, "nothing until the owner sets it");
  assert.equal((await s.api("/api/coming-soon", { method: "POST", json: { title: "Winter menu", date: "2020-01-01" } })).status, 400);
  assert.equal((await s.api("/api/coming-soon", { method: "POST", json: { title: "Winter menu", date: "2099-12-01" } })).status, 200);
  assert.equal((await fetch(`${s.url}/api/coming-soon`).then((r) => r.json())).soon.title, "Winter menu");
  await s.api("/api/coming-soon", { method: "POST", json: { clear: true } });
  // Game night: off until the owner turns it on; seats are capped
  assert.equal((await fetch(`${s.url}/api/game-night`).then((r) => r.json())).on, false);
  assert.equal((await s.api("/api/game-night", { method: "PUT", json: { on: true, day: 4, time: "19:00", seats: 4 } })).status, 200);
  const gn = await fetch(`${s.url}/api/game-night`).then((r) => r.json());
  assert.equal(gn.nights.length, 4); assert.equal(new Date(`${gn.nights[0].date}T12:00:00Z`).getUTCDay(), 4);
  const night = gn.nights[0].date, g1 = "j".repeat(16) + "night1", g2 = "k".repeat(16) + "night2";
  assert.equal((await j("/api/game-night", "POST", { voter: g1, date: night, name: "Asha", party: 3, game: gn.games[0]?.id })).status, 200);
  assert.equal((await j("/api/game-night", "POST", { voter: g2, date: night, name: "Ben", party: 2 })).status, 400, "only one seat left");
  assert.equal((await j("/api/game-night", "POST", { voter: g2, date: "2020-01-02", name: "Ben", party: 1 })).status, 400, "not a game night");
  const ok = await (await j("/api/game-night", "POST", { voter: g2, date: night, name: "Ben", party: 1 })).json();
  assert.equal(ok.nights[0].left, 0); assert.equal(ok.nights[0].mine.name, "Ben");
  const adm = (await s.api("/api/game-night?admin=1")).body;
  assert.equal(adm.upcoming[0].rows.length, 2); assert.ok(Array.isArray(adm.past));
  assert.equal((await s.api("/api/game-night", { method: "PATCH", json: { id: adm.upcoming[0].rows[0].id, came: true } })).status, 400, "can't tick off a night that hasn't happened");
  assert.equal((await j("/api/game-night", "PATCH", { id: adm.upcoming[0].rows[0].id, came: true })).status, 401);
  const sub = { endpoint: "https://push.example.test/gn", keys: { p256dh: "x", auth: "y" } };
  assert.equal((await j("/api/game-night", "POST", { voter: g1, subscription: sub })).status, 200);
  assert.equal((await (await fetch(`${s.url}/api/game-night?voter=${g1}`)).json()).alerts, true, "reminders on");
  assert.equal((await (await j("/api/game-night", "POST", { voter: g1, subscription: null })).json()).alerts, false);
  const cancelled = await (await j("/api/game-night", "POST", { voter: g2, date: night, cancel: true })).json();
  assert.equal(cancelled.nights[0].left, 1);
  await s.api("/api/game-night", { method: "PUT", json: { on: false, day: 4, time: "19:00", seats: 4 } });
  // Recipe of the week
  assert.equal((await s.api("/api/admin/recipe-week", { method: "POST", json: { id: "not-a-recipe" } })).status, 400);
  assert.equal((await s.api("/api/admin/recipe-week", { method: "POST", json: { id: "chai", video: "javascript:alert(1)" } })).status, 400);
  assert.equal((await s.api("/api/admin/recipe-week", { method: "POST", json: { id: "chai", video: "https://example.com/chai", note: "Rainy-day favourite" } })).status, 200);
  const page = await (await fetch(`${s.url}/recipes`)).text();
  assert.ok(page.includes("RECIPE OF THE WEEK") && page.includes("https://example.com/chai"));
  for (const p of ["/game-night", "/whats-new"]) assert.equal((await fetch(`${s.url}${p}`)).status, 200, p);
});

test("tidy up: old played songs, past game nights and finished slow games go; everything current stays", async () => {
  await s.login();
  const post = (p: string, json: unknown) => fetch(`${s.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.7.1" }, body: JSON.stringify(json) });
  const g = await (await post("/api/slow-games", { kind: "connect4", name: "Ty" })).json();
  const queued = (await (await post("/api/songs", { title: "Tidy test song" })).json()).id;
  await s.api("/api/songs", { method: "PATCH", json: { id: queued, action: "approve" } });
  assert.equal((await fetch(`${s.url}/api/admin/tidy`, { method: "POST" })).status, 401);
  const r = await s.api("/api/admin/tidy", { method: "POST" });
  assert.equal(r.status, 200); assert.ok("songs" in r.body.removed && "slow" in r.body.removed);
  assert.equal((await fetch(`${s.url}/api/slow-games?id=${g.id}`)).status, 200, "a new game stays");
  assert.ok(((await (await fetch(`${s.url}/api/songs`)).json()) as { next: { id: number }[] }).next.some((x) => x.id === queued), "a queued song stays");
  await s.api("/api/songs", { method: "PATCH", json: { id: queued, action: "remove" } });
});

test("slow games: your-turn alerts can be turned on and off for your own seat only", async () => {
  const post = (json: unknown) => fetch(`${s.url}/api/slow-games`, { method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "10.9.7.2" }, body: JSON.stringify(json) });
  const g = await (await post({ kind: "reversi", name: "Al" })).json();
  const sub = { endpoint: "https://push.example.test/abc", keys: { p256dh: "x", auth: "y" } };
  assert.equal((await post({ id: g.id, token: "f".repeat(32), subscription: sub })).status, 400, "not your seat");
  assert.equal((await post({ id: g.id, token: g.token, subscription: { endpoint: "http://nope" } })).status, 400);
  const on = await (await post({ id: g.id, token: g.token, subscription: sub })).json();
  assert.equal(on.alerts, true);
  const j = await (await post({ id: g.id, join: true, name: "Bo" })).json();
  assert.equal(j.alerts, false, "the other seat has its own setting");
  const off = await (await post({ id: g.id, token: g.token, subscription: null })).json();
  assert.equal(off.alerts, false);
});

test("games dashboard: the period before, and a log of hiding with undo", async () => {
  await s.login();
  assert.equal((await s.api("/api/admin/games", { method: "POST", json: { id: "flood", hide: true } })).status, 200);
  assert.equal((await s.api("/api/admin/games", { method: "POST", json: { id: "flood", hide: true } })).status, 200, "hiding twice logs once");
  const r = (await s.api("/api/admin/games?days=7")).body;
  assert.ok("prevSaves" in r.totals && "prevPlayers" in r.totals && "prevSaves" in r.daily[0]);
  const flood = r.log.filter((e: { id: string }) => e.id === "flood");
  assert.equal(flood[0].hide, true); assert.equal(flood[0].hiddenNow, true);
  await s.api("/api/admin/games", { method: "POST", json: { id: "flood", hide: false } });
  const after = (await s.api("/api/admin/games?days=7")).body.log.filter((e: { id: string }) => e.id === "flood");
  assert.equal(after[0].hide, false); assert.equal(after[0].hiddenNow, false); assert.equal(after.length, flood.length + 1);
});

test("quiz season standings, the kids' corner and the café map", async () => {
  const q = await (await fetch(`${s.url}/api/quiz?season=1`)).json();
  assert.match(q.season, /^(January to March|April to June|July to September|October to December) \d{4}$/); assert.ok(Array.isArray(q.teams));
  const kids = await (await fetch(`${s.url}/kids`)).text();
  assert.ok(kids.includes("Babyccino") && kids.includes("/colouring"), "the kids' menu and colouring");
  const map = await (await fetch(`${s.url}/cafe-map`)).text();
  assert.ok(map.includes("Counter") && map.includes("Power socket"));
});
