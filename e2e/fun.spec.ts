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

test("drink lab: mix a drink, save it and get a share link", async ({ page }) => {
  await page.goto("/lab");
  await page.getByRole("button", { name: "Large", exact: false }).first().click();
  await page.getByLabel("Name your drink").fill(`Test Brew ${Date.now() % 100000}`);
  await page.getByLabel(/Your first name/).fill("Tess");
  await page.getByRole("button", { name: "🧪 Save & share" }).click();
  await expect(page.getByText(/is in the lab!/)).toBeVisible();
  await expect(page.locator(".lab-preview code")).toContainText("/lab/");
});
