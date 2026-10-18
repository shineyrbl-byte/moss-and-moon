import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Automatic accessibility check (axe) on the main guest pages. Fails on serious or critical problems.
for (const path of ["/?season=off", "/catering", "/gift-cards", "/account", "/journal", "/privacy"]) {
  test(`accessibility: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
}
