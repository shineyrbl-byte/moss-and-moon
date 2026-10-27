import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// These only read pages, so they can run side by side
test.describe.configure({ mode: "parallel" });

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

// Colours in dark mode (and with a board look on), on guest pages and a spread of games: catches text that's
// hard to read after a colour change. Contrast only, since the light-mode checks above cover everything else.
const DARK = ["/?season=off", "/games", "/sudoku", "/bean-boggle", "/cafe-letters", "/golf-solitaire", "/cafe-dominoes", "/trophies", "/friends", "/game-settings", "/latte-art", "/songs"];
for (const [scheme, board] of [["dark", ""], ["light", "night"], ["dark", "contrast"]] as const) {
  for (const path of DARK) {
    test(`colour contrast (${scheme}${board ? `, ${board} boards` : ""}): ${path}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.addInitScript(([t, b]) => { try { localStorage.setItem("mm-theme", t); if (b) localStorage.setItem("mm-game-settings", JSON.stringify({ board: b })); } catch {} }, [scheme, board]);
      await page.goto(path + (path.includes("?") ? "" : "?season=off"));
      await page.waitForLoadState("networkidle");
      const r = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      expect(r.violations.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} ${n.any[0]?.message ?? ""}`).join(" | ")}`)).toEqual([]);
    });
  }
}
