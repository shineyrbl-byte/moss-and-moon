import { test, expect } from "@playwright/test";
import { addItem, home, openTray } from "./helpers";

test("group order: a friend joins from the link, the host checks out", async ({ page, browser }) => {
  // Host starts a group
  await page.goto("/g/new?season=off");
  await page.getByLabel("Your name").fill("Host");
  await page.getByRole("button", { name: "Start the group order" }).click();
  await expect(page).toHaveURL(/\/g\/GR-/);
  const link = page.url().split("?")[0];

  await home(page);
  await addItem(page, "Brown Butter Cookie");
  const tray = await openTray(page);
  await tray.getByRole("button", { name: /Add to the group order/ }).click();
  await expect(page).toHaveURL(/\/g\/GR-/);

  // A friend on another phone joins and adds a drink
  const friendCtx = await browser.newContext();
  const friend = await friendCtx.newPage();
  await friend.goto(link);
  await friend.getByLabel("Your name").fill("Friend");
  await friend.getByRole("button", { name: /Join/ }).click();
  await expect(friend.locator(".menu-grid .item").first()).toBeVisible();
  await addItem(friend, "Rose Masala Chai");
  const ftray = await openTray(friend);
  await ftray.getByRole("button", { name: /Add to the group order/ }).click();
  await expect(friend).toHaveURL(/\/g\/GR-/);

  // Host sees both (live) and checks out for everyone
  await expect(page.locator(".group-person")).toHaveCount(2);
  await page.getByRole("button", { name: /Check out for everyone/ }).click();
  const htray = page.getByRole("complementary", { name: "Your tray" });
  await expect(htray).toContainText("Rose Masala Chai");
  await htray.getByRole("button", { name: "Checkout" }).click();
  await htray.getByLabel("Your name").fill("Host");
  await htray.getByLabel(/Phone/).fill("9876500020");
  await htray.getByRole("button", { name: /Pay at the counter|At the counter/ }).click();
  await htray.getByRole("button", { name: /Place order/ }).click();
  await expect(page).toHaveURL(/\/order\/MM-/);

  // The friend's page now offers to pay their part
  await friend.reload();
  await expect(friend.getByRole("button", { name: /Pay my part/ })).toBeVisible();
  await friendCtx.close();
});
