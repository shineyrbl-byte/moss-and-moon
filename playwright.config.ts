// Browser tests: click through the site like a guest would. Run: npm run test:e2e
import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const PORT = 3456;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mm-e2e-"));

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // On your computer this uses your normal Chrome; on GitHub it uses Playwright's own
    ...(process.env.CI ? {} : { channel: "chrome" }),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /phone\.spec/ },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /phone\.spec/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DATA_DIR: dataDir, ADMIN_PASSCODE: "e2e-passcode", DEMO_BARISTA: "off", NODE_ENV: "production", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", RESEND_API_KEY: "", RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "" },
  },
});
