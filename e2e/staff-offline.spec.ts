import { test, expect } from "@playwright/test";

test("barista screen keeps taps made offline and sends them when back online", async ({ page, context, request }) => {
  // An order to work on
  const o = await request.post("/api/orders", { data: { name: "Offline Test", phone: "9876500456", lines: [{ itemId: "cookie", qty: 1 }] }, headers: { Origin: "http://localhost:3456" } });
  const { code } = await o.json();
  await page.goto("/admin");
  await page.locator('input[type="password"]').fill("e2e-passcode");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Signed in as")).toBeVisible();
  await page.goto("/staff");
  const ticket = page.locator("article.ticket", { hasText: code });
  await expect(ticket).toBeVisible();

  await context.setOffline(true);
  await ticket.getByRole("button", { name: /Start|Brew/i }).click();
  await expect(page.getByRole("status").filter({ hasText: "No connection" })).toBeVisible();
  await expect(page.getByText("1 waiting to send")).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("waiting to send")).toBeHidden({ timeout: 15_000 });
  const after = await (await request.get(`/api/orders/${code}`)).json();
  expect(after.status).toBe("brewing");
});
