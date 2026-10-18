import { test, expect } from "@playwright/test";
import { home } from "./helpers";

test("buy a friend a coffee and they claim it", async ({ page, browser }) => {
  await home(page);
  await page.locator(".menu-grid .item", { hasText: "Honey Oat Latte" }).first().locator(".item-photo").click();
  const modal = page.getByRole("dialog", { name: "Customise Honey Oat Latte" });
  await modal.getByRole("button", { name: "Iced" }).click();
  await modal.getByRole("button", { name: /Gift it/ }).click();
  await expect(page).toHaveURL(/gift-a-drink/);
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Your friend's name").fill("Ravi");
  await page.getByLabel(/A little note/).fill("You deserve it");
  await page.getByRole("button", { name: /& get the link/ }).click();
  await page.getByRole("dialog", { name: "Payment" }).getByRole("button", { name: /^Pay ₹/ }).click();
  await expect(page).toHaveURL(/\/d\/GD-/, { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Send on WhatsApp" })).toBeVisible();
  const link = page.url().split("?")[0];

  const friendCtx = await browser.newContext();
  const friend = await friendCtx.newPage();
  await friend.goto(link);
  await expect(friend.getByRole("heading", { level: 1 })).toContainText("Asha bought you a Honey Oat Latte");
  await expect(friend.getByText("You deserve it")).toBeVisible();
  await friend.getByRole("button", { name: /Claim it now/ }).click();
  await friend.getByRole("button", { name: /Make it for pickup/ }).click();
  await expect(friend).toHaveURL(/\/order\/MM-/);
  await expect(friend.locator(".track .sum-row.total")).toContainText("Paid");
  await friendCtx.close();
});
