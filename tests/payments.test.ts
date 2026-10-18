// Real-payment mode against a fake Razorpay: a genuine payment for one thing
// must never mark a different (more expensive) thing as paid.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { startServer, type TestServer } from "./server.ts";

const SECRET = "test_secret_123";
let fake: http.Server;
let s: TestServer;
let n = 0;

before(async () => {
  // Fake Razorpay: creates orders and accepts refunds
  fake = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/v1/orders") return res.end(JSON.stringify({ id: `order_fake${++n}`, amount: JSON.parse(body).amount }));
      if (req.url?.includes("/refund")) return res.end(JSON.stringify({ id: `rfnd_fake${++n}` }));
      res.statusCode = 404;
      res.end("{}");
    });
  });
  await new Promise<void>((r) => fake.listen(0, "127.0.0.1", () => r()));
  const port = (fake.address() as { port: number }).port;
  s = await startServer(undefined, { RAZORPAY_KEY_ID: "rzp_test_fake", RAZORPAY_KEY_SECRET: SECRET, RAZORPAY_API_BASE: `http://127.0.0.1:${port}` });
});
after(async () => {
  await s?.stop();
  fake?.close();
});

const sign = (orderId: string, paymentId: string) => crypto.createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
const order = async (qty: number) => ((await s.api("/api/orders", { method: "POST", json: { name: "Pay", phone: "9000015151", payMethod: "online", lines: [{ itemId: "cookie", qty }] } })).body as { code: string }).code;

test("a real payment only pays for the order it was started for", async () => {
  const cheap = await order(1);
  const pricey = await order(10);
  const start = await s.api("/api/payments/start", { method: "POST", json: { kind: "order", code: cheap } });
  assert.equal(start.status, 200);
  const rzp = (start.body as { orderId: string; mode: string }).orderId;
  assert.equal((start.body as { mode: string }).mode, "razorpay");
  const proof = { razorpay_order_id: rzp, razorpay_payment_id: "pay_fake1", razorpay_signature: sign(rzp, "pay_fake1") };

  // Try to use the cheap order's genuine payment on the expensive one
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "order", code: pricey, ...proof } })).status, 400);
  assert.equal(((await s.api(`/api/orders/${pricey}`)).body as { pay_status: string }).pay_status, "pending", "still unpaid");
  // Or on a gift card
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "giftcard", code: cheap, ...proof } })).status, 400);
  // A forged signature fails
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "order", code: cheap, ...proof, razorpay_signature: "0".repeat(64) } })).status, 400);
  // Demo payments are switched off when real payments are on
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "order", code: pricey, demo: true } })).status, 400);

  // The real one works, once
  assert.equal((await s.api("/api/payments/verify", { method: "POST", json: { kind: "order", code: cheap, ...proof } })).status, 200);
  assert.equal(((await s.api(`/api/orders/${cheap}`)).body as { pay_status: string }).pay_status, "paid");

  // And the owner can refund it through Razorpay
  await s.login();
  const r = await s.api(`/api/orders/${cheap}/refund`, { method: "POST", json: {} });
  assert.equal(r.status, 200);
});
