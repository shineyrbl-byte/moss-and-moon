// Connecting the café Gmail and sending through Gmail's API, against a fake Google
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { startServer, type TestServer } from "./server.ts";

let fake: http.Server;
let s: TestServer;
const sent: string[] = [];

before(async () => {
  fake = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/token") {
        const p = new URLSearchParams(body);
        if (p.get("grant_type") === "authorization_code" && p.get("code") === "good-code") return res.end(JSON.stringify({ access_token: "at1", refresh_token: "rt-secret-123", expires_in: 3600 }));
        if (p.get("grant_type") === "refresh_token" && p.get("refresh_token") === "rt-secret-123") return res.end(JSON.stringify({ access_token: "at2", expires_in: 3600 }));
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "invalid_grant" }));
      }
      if (req.url === "/gmail/v1/users/me/profile") return res.end(JSON.stringify({ emailAddress: "mossmooncafe@gmail.com" }));
      if (req.url === "/gmail/v1/users/me/messages/send") {
        if (!/^Bearer at[12]$/.test(String(req.headers.authorization))) { res.statusCode = 401; return res.end("{}"); }
        sent.push(Buffer.from(JSON.parse(body).raw, "base64url").toString());
        return res.end(JSON.stringify({ id: "m1" }));
      }
      res.statusCode = 404;
      res.end("{}");
    });
  });
  await new Promise<void>((r) => fake.listen(0, "127.0.0.1", () => r()));
  const base = `http://127.0.0.1:${(fake.address() as { port: number }).port}`;
  s = await startServer(undefined, {
    GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csecret", GOOGLE_OAUTH_BASE: base, GMAIL_API_BASE: base, GOOGLE_AUTH_URL: `${base}/auth`,
    // Gmail's mail server is set too, but blocked on Railway: the API should win
    GMAIL_USER: "x@gmail.com", GMAIL_APP_PASSWORD: "abcd", RESEND_API_KEY: "re_x", EMAIL_FROM: "Moss & Moon <onboarding@resend.dev>",
  });
});
after(async () => {
  await s?.stop();
  fake?.close();
});

test("owner connects Gmail; guest emails go out from Moss & Moon through Gmail's API", async () => {
  await s.login();
  const start = await fetch(`${s.url}/api/admin/gmail/connect`, { headers: { cookie: s.cookie() }, redirect: "manual" });
  assert.equal(start.status, 302);
  const to = new URL(start.headers.get("location")!);
  assert.equal(to.searchParams.get("scope"), "https://www.googleapis.com/auth/gmail.send", "only asks to send, not to read mail");
  const state = to.searchParams.get("state")!;
  const stateCookie = start.headers.get("set-cookie")!.split(";")[0];

  // A forged return (wrong state) is refused
  const forged = await fetch(`${s.url}/api/admin/gmail/callback?code=good-code&state=nope`, { headers: { cookie: stateCookie } });
  assert.match(await forged.text(), /didn/);
  const back = await fetch(`${s.url}/api/admin/gmail/callback?code=good-code&state=${state}`, { headers: { cookie: stateCookie } });
  assert.match(decodeURIComponent(await back.text()), /connected:mossmooncafe@gmail.com/);

  const g = (await s.api("/api/admin/gmail")).body as { address: string; provider: string };
  assert.equal(g.address, "mossmooncafe@gmail.com");
  assert.equal(g.provider, "gmail-api");

  // The saved permission is encrypted
  const db = new DatabaseSync(path.join(s.dataDir, "cafe.db"), { readOnly: true });
  const token = (db.prepare("SELECT value FROM settings WHERE key = 'gmail_api_token'").get() as { value: string }).value;
  db.close();
  assert.ok(!token.includes("rt-secret-123"));

  await s.api("/api/orders", { method: "POST", json: { name: "Friend", phone: "9000020202", email: "friend@example.com", lines: [{ itemId: "cookie", qty: 1 }] } });
  for (let i = 0; i < 20 && !sent.length; i++) await new Promise((r) => setTimeout(r, 200));
  assert.equal(sent.length, 1);
  assert.match(sent[0], /^From: "Moss & Moon" <mossmooncafe@gmail.com>/m);
  assert.match(sent[0], /^To: friend@example.com/m);
  assert.match(sent[0], /^Subject: =\?UTF-8\?Q\?Order_confirmed/m);

  assert.equal((await s.api("/api/admin/gmail", { method: "DELETE" })).status, 200);
  assert.equal(((await s.api("/api/admin/gmail")).body as { address: string | null }).address, null);
});
