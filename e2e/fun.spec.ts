import { test, expect } from "@playwright/test";

test("barista rush: start a round and serve a drink", async ({ page }) => {
  await page.goto("/play");
  await page.getByRole("button", { name: "▶︎ Start" }).click();
  await expect(page.getByText(/Order for/)).toBeVisible();
  await page.getByRole("button", { name: "Serve ✿" }).click();
  await expect(page.locator(".game-flash")).toBeVisible();
});

test("brew timer: starts counting and shows the first step", async ({ page }) => {
  await page.goto("/brew");
  await page.getByRole("radio", { name: /AeroPress/ }).click();
  await page.getByRole("button", { name: "▶︎ Start" }).click();
  await expect(page.locator(".brew-steps li.now")).toContainText("Pour all the water in");
  await expect(page.locator(".brew-time")).not.toHaveText(/^0:00/, { timeout: 3000 });
});

test("weather picks show on the menu", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menu").scrollIntoViewIfNeeded();
  await expect(page.getByRole("region", { name: /Raining in Panjim, 26°C/ })).toBeVisible();
});
