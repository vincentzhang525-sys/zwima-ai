/**
 * GAP-011 Closed Beta compliance — public pages + authenticated consent gate.
 * Does not create Clerk users, Stripe charges, OpenAI calls, or send email.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const authFile = path.join(__dirname, "../../playwright/.auth/user.json");
const hasAuth = fs.existsSync(authFile);

test.describe("gap011 public compliance pages", () => {
  test("privacy policy is reachable with version marker", async ({ page }) => {
    const res = await page.goto("/privacy");
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: /Privacy Policy/i })).toBeVisible();
    await expect(page.getByTestId("legal-version-privacy")).toBeVisible();
  });

  test("terms of service is reachable with version marker", async ({ page }) => {
    const res = await page.goto("/terms");
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: /Terms of Service/i })).toBeVisible();
    await expect(page.getByTestId("legal-version-terms")).toBeVisible();
  });

  test("GDPR / DPA page is reachable", async ({ page }) => {
    const res = await page.goto("/legal/dpa");
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: /Data Processing Agreement/i })).toBeVisible();
    await expect(page.getByTestId("legal-version-dpa")).toBeVisible();
  });

  test("provider / sub-processors disclosure is reachable", async ({ page }) => {
    const res = await page.goto("/legal/sub-processors");
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByTestId("legal-version-provider")).toBeVisible();
  });
});

test.describe("gap011 authenticated consent", () => {
  test.skip(!hasAuth, "Missing playwright/.auth/user.json — skip authenticated consent E2E");

  test.use({ storageState: authFile });

  test("dashboard requires or records current legal consent", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    if (page.url().includes("/dashboard/accept-terms")) {
      await expect(page.getByRole("heading", { name: /Accept Closed Beta terms/i })).toBeVisible({
        timeout: 60_000,
      });
      await page.getByTestId("accept-legal-terms").click();
      await page.waitForURL(/\/dashboard(?!\/accept-terms)/, { timeout: 60_000 });
    }

    expect(page.url()).toMatch(/\/dashboard/);
    expect(page.url()).not.toContain("/accept-terms");

    const status = await page.request.get("/api/legal/consent");
    expect(status.ok()).toBeTruthy();
    const body = await status.json();
    expect(body.accepted).toBe(true);
    expect(body.bundleVersion).toBeTruthy();
    expect(body.acceptedAt).toBeTruthy();
  });

  test("settings exposes account deletion request entry", async ({ page }) => {
    await page.goto("/dashboard/settings");
    if (page.url().includes("/dashboard/accept-terms")) {
      await page.getByTestId("accept-legal-terms").click();
      await page.waitForURL(/\/dashboard(?!\/accept-terms)/, { timeout: 60_000 });
      await page.goto("/dashboard/settings");
    }
    await expect(page.getByTestId("account-deletion-request")).toBeVisible({ timeout: 60_000 });
  });
});
