import { test, expect } from "@playwright/test";

test("no content-security warnings on the main pages", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => { if (/Content.Security.Policy|Refused to/i.test(m.text())) problems.push(m.text()); });
  for (const p of ["/?season=diwali", "/noticeboard", "/gift-cards", "/g/new", "/account", "/admin"]) {
    await page.goto(p);
    await page.waitForLoadState("networkidle");
  }
  expect(problems).toEqual([]);
});
