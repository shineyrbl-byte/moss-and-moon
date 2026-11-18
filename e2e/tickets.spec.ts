import { test, expect } from "@playwright/test";

test("buy a ticket for a class and see the QR code", async ({ page, request }) => {
  // Add our own paid class a week out (the starter events have dates that pass). `request` has its own cookies,
  // so the browser page below stays a guest.
  expect((await request.post("/api/admin/login", { data: { passcode: "e2e-passcode" } })).ok()).toBe(true);
  const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const title = `Cupping Class ${Date.now().toString(36)}`;
  expect((await request.put("/api/events", { data: { title, date, time: "17:00", capacity: 10, price: 399 } })).ok()).toBe(true);

  await page.goto("/?season=off#events");
  const ev = page.locator(".event", { hasText: title });
  await ev.getByRole("button", { name: "Get tickets" }).click();
  await ev.getByPlaceholder("Your name").fill("Ticket Buyer");
  await ev.getByPlaceholder("Email").fill("buyer@example.com");
  await ev.getByRole("combobox").selectOption("2");
  await ev.getByRole("button", { name: /^Pay ₹/ }).click();
  const pay = page.getByRole("dialog", { name: "Payment" });
  await pay.getByRole("button", { name: /^Pay ₹/ }).click();
  await expect(page).toHaveURL(/\/ticket\/TK-/, { timeout: 15_000 });
  await expect(page.getByRole("img", { name: /QR code for ticket/ })).toBeVisible();
  await expect(page.locator(".evt-stub")).toContainText("2 tickets");
});
