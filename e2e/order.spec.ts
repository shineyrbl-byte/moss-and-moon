import { test, expect } from "@playwright/test";
import { addItem, home, openTray } from "./helpers";

test("order ahead and pay at the counter", async ({ page }) => {
  await home(page);
  await addItem(page, "Honey Oat Latte", ["Iced", "Oat"]);
  const tray = await openTray(page);
  await expect(tray).toContainText("Honey Oat Latte");
  await expect(tray).toContainText("iced");
  await tray.getByRole("button", { name: "Checkout" }).click();
  await tray.getByLabel("Your name").fill("Playwright");
  await tray.getByLabel(/Phone/).fill("9876500001");
  await tray.getByRole("button", { name: /Pay at the counter|At the counter/ }).click();
  await tray.getByRole("button", { name: /Place order/ }).click();

  await expect(page).toHaveURL(/\/order\/MM-/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Playwright");
  await expect(page.locator(".step.current")).toContainText(/Received/i);
  await expect(page.getByRole("link", { name: /Receipt/ })).toBeVisible();
});

test("order and pay online (demo payment)", async ({ page }) => {
  await home(page);
  await addItem(page, "Brown Butter Cookie");
  const tray = await openTray(page);
  await tray.getByRole("button", { name: "Checkout" }).click();
  await tray.getByLabel("Your name").fill("Online Payer");
  await tray.getByLabel(/Phone/).fill("9876500002");
  await tray.getByRole("button", { name: /Pay now · ₹|^Pay now/ }).last().click();

  const pay = page.getByRole("dialog", { name: "Payment" });
  await expect(pay).toBeVisible();
  await pay.getByRole("button", { name: /^Pay ₹/ }).click();
  await expect(page).toHaveURL(/\/order\/MM-/, { timeout: 15_000 });
  await expect(page.locator(".track .sum-row.total")).toContainText("Paid");
});

test("my usual appears after ordering the same drink twice", async ({ page }) => {
  for (const n of [1, 2]) {
    await home(page);
    await addItem(page, "Rose Pistachio Latte", ["Almond"]);
    const tray = await openTray(page);
    await tray.getByRole("button", { name: "Checkout" }).click();
    await tray.getByLabel("Your name").fill("Regular");
    await tray.getByLabel(/Phone/).fill("9876500003");
    await tray.getByRole("button", { name: /Pay at the counter|At the counter/ }).click();
    await tray.getByRole("button", { name: /Place order/ }).click();
    await expect(page).toHaveURL(/\/order\/MM-/);
    void n;
  }
  await home(page);
  const usual = page.locator(".usual");
  await expect(usual).toContainText("your usual");
  await expect(usual).toContainText("Rose Pistachio Latte");
  await usual.getByRole("button", { name: /The usual/ }).click();
  await expect(page.getByRole("complementary", { name: "Your tray" })).toContainText("almond");
});
