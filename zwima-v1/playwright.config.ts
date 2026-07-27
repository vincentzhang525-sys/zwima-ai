import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "https://zwima-8v2foh32q-zwima.vercel.app";
const authFile = path.join(__dirname, "playwright/.auth/user.json");
const authFileB = path.join(__dirname, "playwright/.auth/user-b.json");

const phase4Projects = [
  {
    name: "phase4-chromium",
    testMatch: /phase4\.spec\.ts/,
    use: {
      ...devices["Desktop Chrome"],
      storageState: authFile,
    },
  },
  {
    name: "phase4-admin-chromium",
    testMatch: /phase4-admin\.spec\.ts/,
    use: {
      ...devices["Desktop Chrome"],
      storageState: authFile,
    },
  },
];

if (fs.existsSync(authFileB)) {
  phase4Projects.push({
    name: "phase4-orgb-chromium",
    testMatch: /phase4-isolation\.spec\.ts/,
    use: {
      ...devices["Desktop Chrome"],
      storageState: authFileB,
    },
    dependencies: ["phase4-chromium"],
  } as (typeof phase4Projects)[number] & { dependencies: string[] });
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "artifacts/playwright-run.json" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  outputDir: "test-results",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      timeout: 600_000,
      use: {
        headless: false,
      },
    },
    ...phase4Projects,
    {
      name: "m8-phase2b",
      testMatch: /m8-phase2b\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
    },
  ],
});
