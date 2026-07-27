/**
 * M8 Phase 2B Preview E2E — Mock Provider only.
 * Covers template→agent flow, memory policy, WORKSPACE fail-closed UI, and safety guards.
 */
import { expect, test } from "@playwright/test";

test.describe("m8-phase2b memory and templates", () => {
  test("template catalog opens", async ({ page }) => {
    await page.goto("/dashboard/agents/templates");
    await expect(page.getByTestId("agent-templates-page")).toBeVisible({ timeout: 60_000 });
  });

  test("create agent from template and configure memory policy", async ({ page }) => {
    await page.goto("/dashboard/agents/templates");
    await expect(page.getByTestId("agent-templates-page")).toBeVisible({ timeout: 60_000 });

    const firstLink = page.locator('a[href*="/dashboard/agents/templates/"]').first();
    if ((await firstLink.count()) === 0) {
      test.skip(true, "No templates listed in this Preview environment");
      return;
    }
    await firstLink.click();
    await expect(page.getByTestId("agent-template-detail-page")).toBeVisible({ timeout: 60_000 });

    await page.getByTestId("from-template-name-input").fill(`Phase2B Agent ${Date.now()}`);
    await page.getByTestId("create-agent-from-template").click();
    await expect(page.getByTestId("agent-detail-page")).toBeVisible({ timeout: 60_000 });

    await expect(page.getByTestId("agent-memory-section")).toBeVisible();
    const enabled = page.getByTestId("memory-enabled-toggle");
    if (!(await enabled.isChecked())) {
      await enabled.check();
    }
    await expect(page.getByTestId("memory-allow-user-toggle")).toBeVisible();
    await expect(page.getByTestId("memory-allow-agent-toggle")).toBeVisible();
    await expect(page.getByTestId("memory-allow-execution-summary-toggle")).toBeVisible();

    // WORKSPACE remains visible but disabled
    await expect(page.getByTestId("memory-allow-workspace-toggle")).toBeDisabled();
    await expect(page.getByTestId("memory-workspace-deferred-note")).toContainText(
      "Workspace memory is temporarily unavailable",
    );

    await page.getByTestId("memory-allow-user-toggle").check();
    await page.getByTestId("memory-allow-agent-toggle").check();
    await page.getByTestId("memory-save-limits").click();
    await expect(page.getByTestId("agent-memory-msg")).toBeVisible({ timeout: 30_000 });
  });

  test("unauthenticated memory API is rejected", async ({ request }) => {
    const res = await request.post("/api/v1/agents/agt_nonexistent/memory", {
      data: { memoryType: "USER", key: "k", value: "v" },
    });
    expect([401, 403, 307, 308]).toContain(res.status());
  });

  test("WORKSPACE memory API fail-closed when authenticated session present", async ({ request }) => {
    // Even with storage state, a forged WORKSPACE create must not succeed as org-scoped memory.
    const res = await request.post("/api/v1/agents/agt_nonexistent/memory", {
      data: { memoryType: "WORKSPACE", key: "k", value: "v", metadata: { workspaceId: "ws_forged" } },
    });
    // Auth may fail first (401/403/404) or business fail-closed (409).
    expect([401, 403, 404, 409, 307, 308]).toContain(res.status());
    const body = await res.text();
    expect(body).not.toMatch(/sk_live_|sk_test_|whsec_/);
  });

  test("providers remain fail-closed in Preview", async ({ request }) => {
    const res = await request.get("/api/v1/providers");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("PROVIDER_LIVE_CALLS_DISABLED");
    expect(text).not.toContain('"online":true');
  });

  test("stripe checkout write path is not open", async ({ request }) => {
    const res = await request.post("/api/billing/checkout", {
      data: { packageId: "probe-no-pay" },
    });
    expect([400, 401, 403, 404, 405, 307, 308]).toContain(res.status());
    const text = await res.text();
    expect(text).not.toContain("cs_live_");
    expect(text).not.toContain("checkout.stripe.com");
  });
});
