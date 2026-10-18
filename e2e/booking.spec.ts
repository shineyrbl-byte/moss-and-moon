import { test, expect } from "@playwright/test";

test("book a table for tomorrow", async ({ page }) => {
  await page.goto("/?season=off#visit");
  const d = new Date(Date.now() + 86_400_000);
  const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const form = page.locator("#visit form");
  await form.getByLabel("Name").fill("Booker");
  await form.getByLabel("Phone").fill("9876500010");
  await form.getByLabel("Date").fill(tomorrow);
  await form.locator(".slots .chip").first().click();
  await form.getByRole("button", { name: "Reserve" }).click();
  await expect(page.locator("#visit .confirm")).toContainText("See you soon, Booker!");
  await expect(page.locator("#visit .confirm .code")).toHaveText(/^TB-/);
});
