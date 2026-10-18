// Gmail sending: guests' emails go out from "Moss & Moon" to whatever address they type
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, type TestServer } from "./server.ts";

let s: TestServer;
before(async () => {
  s = await startServer(undefined, { GMAIL_USER: "mossandmooncafe@gmail.com", GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop", SMTP_TEST_JSON: "1", RESEND_API_KEY: "re_test", EMAIL_FROM: "Moss & Moon <onboarding@resend.dev>" });
});
after(async () => s?.stop());

test("with Gmail set up, any guest's email is sent (not just the owner's)", async () => {
  const r = await s.api("/api/orders", { method: "POST", json: { name: "Guest", phone: "9000018181", email: "any.guest@example.com", lines: [{ itemId: "cookie", qty: 1 }] } });
  assert.equal(r.status, 200);
  await new Promise((ok) => setTimeout(ok, 500));
  await s.login();
  const d = (await s.api("/api/admin/emails")).body as { emailProvider: string; emails: { to_email: string; status: string; error: string | null }[] };
  assert.equal(d.emailProvider, "gmail", "Gmail is used because Resend has no verified domain");
  const sent = d.emails.find((e) => e.to_email === "any.guest@example.com");
  assert.equal(sent?.status, "sent", sent?.error ?? "");
  // Sign-in codes go by email too, so they're no longer shown on screen
  const code = await s.api("/api/account/code", { method: "POST", json: { email: "someone@example.com" } });
  assert.equal((code.body as { demoCode?: string }).demoCode, undefined);
});
