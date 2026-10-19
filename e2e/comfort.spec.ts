import { test, expect } from "@playwright/test";

test("comfort settings: larger text and less motion stick after a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Comfort settings" }).click();
  await page.getByRole("button", { name: "Larger text" }).click();
  await page.getByRole("button", { name: "Less motion" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-text", "large");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(size).toBeGreaterThan(17);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text", "large");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
});
