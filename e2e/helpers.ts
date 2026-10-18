import { expect, type Page } from "@playwright/test";

/** Open the home page with seasonal decorations off and the welcome bits out of the way */
export async function home(page: Page) {
  await page.goto("/?season=off");
  await expect(page.locator(".menu-grid .item").first()).toBeVisible();
}

/** Add a menu item (by its visible name) to the tray through the customise pop-up */
export async function addItem(page: Page, name: string, choices: string[] = []) {
  await page.locator(".menu-grid .item", { hasText: name }).first().locator(".item-photo").click();
  const modal = page.getByRole("dialog", { name: `Customise ${name}` });
  await expect(modal).toBeVisible();
  for (const c of choices) await modal.getByRole("button", { name: c, exact: false }).first().click();
  await modal.getByRole("button", { name: /^Add/ }).click();
  await expect(modal).toBeHidden();
}

export async function openTray(page: Page) {
  await page.locator(".cart-btn").click();
  await expect(page.getByRole("complementary", { name: "Your tray" })).toBeVisible();
  return page.getByRole("complementary", { name: "Your tray" });
}
