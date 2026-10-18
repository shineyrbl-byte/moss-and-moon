import { test, expect } from "@playwright/test";

test("home page fits a phone screen and the menu opens", async ({ page }) => {
  await page.goto("/?season=monsoon");
  await expect(page.locator(".menu-grid .item").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Toggle café ambience/ })).toBeVisible();
});
