import { test, expect } from "@playwright/test";

test("buy a ticket for a class and see the QR code", async ({ page }) => {
  await page.goto("/?season=off#events");
  const ev = page.locator(".event", { hasText: "per ticket" }).first();
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
