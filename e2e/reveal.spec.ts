import { test, expect } from "@playwright/test";

// Sections fade in as they scroll into view; the menu must actually become visible (not just be in the page)
test("the menu fades in when scrolled to, even though it's very tall", async ({ page }) => {
  await page.goto("/?season=off");
  await page.locator("#menu").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 400);
  await expect(page.locator("#menu")).toHaveClass(/visible/, { timeout: 5000 });
  await expect.poll(async () => page.locator("#menu").evaluate((e) => Number(getComputedStyle(e).opacity))).toBeGreaterThan(0.9);
});
