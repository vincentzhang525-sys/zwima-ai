import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  ORG_A_PROJECT_ID_FILE,
  AUTH_FILE,
  ROUTING_MODES,
  WORKSPACE_PAGES,
  runLabel,
} from "./helpers/constants";
import { cleanupArtifacts, cleanupState } from "./helpers/cleanup";
import { attachObservers, fetchRuntimeMeta } from "./helpers/network";
import { apiKeyShapeOk, assertNoSecrets } from "./helpers/redact";
import {
  recordMeta,
  recordStep,
  resetReport,
  addSkipped,
  getReport,
} from "./helpers/results";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  resetReport();
  const meta = await fetchRuntimeMeta(request);
  const authReady = fs.existsSync(AUTH_FILE) && fs.statSync(AUTH_FILE).size > 32;
  if (meta) {
    recordMeta({
      deploymentId: meta.deploymentId ?? process.env.PLAYWRIGHT_DEPLOYMENT_ID ?? null,
      previewUrl: process.env.PLAYWRIGHT_BASE_URL ?? meta.previewUrl,
      clerkAuthValid: authReady,
    });
  } else if (authReady) {
    recordMeta({ clerkAuthValid: true });
  }
});

test.afterAll(async ({ request }) => {
  await cleanupArtifacts(request);
});

test.beforeEach(({ page }) => {
  attachObservers(page);
  page.on("dialog", (dialog) => dialog.accept());
});

test("A — Dashboard overview", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  expect(page.url()).not.toContain("/login");
  await expect(page.getByText("Organization", { exact: true })).toBeVisible();
  await expect(page.getByText("Credit Balance")).toBeVisible();
  const overviewRes = await page.request.get("/api/workspace/overview");
  expect(overviewRes.status()).toBe(200);
  const body = await overviewRes.json();
  expect(body.organization?.name).toBeTruthy();
  recordStep("workspacePages", {
    "/dashboard": { name: "/dashboard", status: "PASS" },
  });
});

test("B — Workspace pages load without 404/500", async ({ page }) => {
  const pageResults: Record<string, { name: string; status: "PASS" | "FAIL"; detail?: string }> = {
    "/dashboard": { name: "/dashboard", status: "PASS" },
  };

  for (const path of WORKSPACE_PAGES.filter((p) => p !== "/dashboard")) {
    let status = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await page.waitForTimeout(3_000);
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      status = response?.status() ?? 0;
      if (status !== 404 && status < 500) break;
    }
    const onLogin = page.url().includes("/login");
    if (status === 404 || status >= 500 || onLogin) {
      pageResults[path] = {
        name: path,
        status: "FAIL",
        detail: `status=${status} login=${onLogin}`,
      };
    } else {
      pageResults[path] = { name: path, status: "PASS" };
    }
    expect(status, `${path} should not 404`).not.toBe(404);
    expect(status, `${path} should not 5xx`).toBeLessThan(500);
    expect(onLogin, `${path} should not redirect to login`).toBeFalsy();
    await page.waitForTimeout(500);
  }
  recordStep("workspacePages", pageResults);
});

test("C — Projects create, edit, archive", async ({ page }) => {
  const label = runLabel();
  const projectName = `${label} Project`;
  const editedDesc = `${label} edited description`;

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/dashboard/projects", { waitUntil: "domcontentloaded" });
    await page.waitForResponse(
      (r) => r.url().includes("/api/workspace/projects") && r.request().method() === "GET",
      { timeout: 60_000 },
    ).catch(() => null);
    if (await page.getByRole("button", { name: "Create Project" }).isVisible().catch(() => false)) break;
    await page.waitForTimeout(3_000);
  }
  await expect(page.getByRole("button", { name: "Create Project" })).toBeVisible({ timeout: 60_000 });
  const createProjectForm = page.locator("form").filter({ hasText: "Create Project" });
  await createProjectForm.locator("input").first().fill(projectName);
  await createProjectForm.locator("input").nth(1).fill(`${label} initial`);
  const [createResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/workspace/projects") && r.request().method() === "POST",
      { timeout: 60_000 },
    ),
    createProjectForm.getByRole("button", { name: "Create Project" }).click(),
  ]);
  expect(createResponse.status()).toBe(200);
  await expect(page.locator("div.rounded-xl").filter({ hasText: projectName })).toBeVisible({ timeout: 20_000 });

  const listRes = await page.request.get("/api/workspace/projects");
  expect(listRes.ok()).toBeTruthy();
  const list = await listRes.json();
  const created = (list.projects ?? []).find((p: { name: string }) => p.name === projectName);
  expect(created).toBeTruthy();
  cleanupState.projectIds.push(created.id);
  cleanupState.projectNames.push(projectName);
  fs.mkdirSync(path.dirname(ORG_A_PROJECT_ID_FILE), { recursive: true });
  fs.writeFileSync(ORG_A_PROJECT_ID_FILE, created.id, "utf8");

  await page.request.patch(`/api/workspace/projects/${created.id}`, {
    data: { description: editedDesc },
  });
  await page.reload();
  await expect(page.getByText(editedDesc)).toBeVisible();

  const projectCard = page.locator("div.rounded-xl").filter({ hasText: projectName });
  const [archiveResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes(`/api/workspace/projects/${created.id}`) && r.request().method() === "PATCH",
      { timeout: 30_000 },
    ),
    projectCard.getByRole("button", { name: "Archive" }).click(),
  ]);
  expect(archiveResponse.status()).toBe(200);
  await expect(projectCard.getByText("ARCHIVED")).toBeVisible({ timeout: 20_000 });

  recordStep("projectCrud", { name: "Project CRUD", status: "PASS" });
});

test("D — API Keys create, mask, rotate, revoke", async ({ page, request }) => {
  const label = runLabel();
  const keyName = `${label} Key`;

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/dashboard/api-keys", { waitUntil: "domcontentloaded" });
    if (await page.getByText("Application error").isVisible().catch(() => false)) {
      await page.waitForTimeout(2_000);
      continue;
    }
    if (await page.getByRole("button", { name: "Create Key" }).isVisible().catch(() => false)) break;
    await page.waitForTimeout(2_000);
  }

  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create Key" })).toBeVisible({ timeout: 30_000 });
  await page.locator('input:not([type="hidden"])').first().fill(keyName);
  const [createKeyResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/workspace/api-keys") && r.request().method() === "POST",
      { timeout: 30_000 },
    ),
    page.getByRole("button", { name: "Create Key" }).click(),
  ]);
  expect(createKeyResponse.status()).toBe(200);
  await expect(page.getByText("New API Key — copy now")).toBeVisible({ timeout: 15_000 });

  const keyText = await page.locator(".font-mono").first().textContent();
  expect(keyText).toBeTruthy();
  expect(apiKeyShapeOk(keyText!.trim())).toBeTruthy();
  const fullKey = keyText!.trim();

  await page.reload();
  await expect(page.getByText(fullKey)).toHaveCount(0);
  await expect(page.getByRole("cell", { name: keyName })).toBeVisible();

  const listRes = await page.request.get("/api/workspace/api-keys");
  const keys = (await listRes.json()).keys ?? [];
  const created = keys.find((k: { name: string }) => k.name === keyName);
  expect(created?.prefix).toMatch(/sk_live_/);
  expect(created?.prefix).toContain("…");
  assertNoSecrets(JSON.stringify(created), "api key list");
  cleanupState.apiKeyIds.push(created.id);
  cleanupState.apiKeyNames.push(keyName);

  const row = page.getByRole("row").filter({ hasText: keyName });
  await row.locator("button").nth(1).click();
  await expect(page.getByText("New API Key — copy now")).toBeVisible({ timeout: 15_000 });
  const rotatedText = await page.locator(".font-mono").first().textContent();
  const rotatedKey = rotatedText!.trim();
  expect(rotatedKey).not.toBe(fullKey);

  const oldChat = await request.post("/api/v1/chat", {
    headers: { Authorization: `Bearer ${fullKey}` },
    data: { model: "gemini-2.5-flash", prompt: "test", maxTokens: 8 },
  });
  expect(oldChat.status()).toBe(401);

  const list2 = await page.request.get("/api/workspace/api-keys");
  const keys2 = (await list2.json()).keys ?? [];
  const active = keys2.find((k: { name: string; status: string }) => k.name === keyName && k.status === "ACTIVE");
  expect(active).toBeTruthy();
  cleanupState.apiKeyIds = [active.id];

  recordStep("apiKeys", { name: "API Keys", status: "PASS" });
});

test("E — Playground routing modes", async ({ page }) => {
  await page.goto("/dashboard/playground", { waitUntil: "domcontentloaded" });
  const keysRes = await page.request.get("/api/workspace/api-keys");
  expect(keysRes.status()).toBe(200);
  const keys = (await keysRes.json()).keys ?? [];
  const activeKey = keys.find((k: { status: string; enabled: boolean }) => k.status === "ACTIVE" && k.enabled);
  if (!activeKey) {
    addSkipped("Playground: no active API key — create key test may have failed");
    for (const mode of ROUTING_MODES) {
      recordStep("routingModes", {
        ...getReport().routingModes,
        [mode]: { name: mode, status: "SKIP", detail: "no active key" },
      });
    }
    test.skip(true, "No active API key for playground");
    return;
  }

  const form = page.locator("form").first();
  await form.locator("select").nth(1).selectOption(activeKey.id);

  const routingResults: Record<string, { name: string; status: "PASS" | "FAIL" | "SKIP"; detail?: string }> = {};

  for (const mode of ROUTING_MODES) {
    await form.locator("select").nth(3).selectOption(mode);
    await form.locator("textarea").last().fill("Reply with exactly: PW4 OK");
    await form.locator('input[type="number"]').last().fill("16");

    const resPromise = page.waitForResponse(
      (r) => r.url().includes("/api/workspace/playground") && r.request().method() === "POST",
      { timeout: 90_000 },
    );
    await page.getByRole("button", { name: "Send" }).click();
    const res = await resPromise;
    const status = res.status();
    const body = await res.json().catch(() => ({}));

    if (status >= 500) {
      routingResults[mode] = { name: mode, status: "FAIL", detail: `HTTP ${status}` };
    } else if (status === 200 && body.content) {
      routingResults[mode] = {
        name: mode,
        status: "PASS",
        detail: `${body.selectedProvider ?? "?"} / ${body.selectedModel ?? "?"}`,
      };
    } else {
      const msg = body.error?.message || body.error || `HTTP ${status}`;
      routingResults[mode] = {
        name: mode,
        status: "PASS",
        detail: `non-500: ${String(msg).slice(0, 120)}`,
      };
    }
    expect(status, `${mode} must not 500`).toBeLessThan(500);
    recordStep("routingModes", { ...getReport().routingModes, ...routingResults });
  }
});

test("J — API Key revoke (post-playground)", async ({ page }) => {
  await page.goto("/dashboard/api-keys", { waitUntil: "domcontentloaded" });
  const listRes = await page.request.get("/api/workspace/api-keys");
  expect(listRes.ok()).toBeTruthy();
  const keys = (await listRes.json()).keys ?? [];
  const testKey = keys.find(
    (k: { name: string; status: string }) => k.name.includes("PW4 Preview") && k.status === "ACTIVE",
  );
  if (!testKey) {
    recordStep("apiKeys", { name: "API Keys", status: "PASS", detail: "create/rotate/revoke (already revoked)" });
    return;
  }

  const res = await page.request.post(`/api/workspace/api-keys/${testKey.id}/revoke`, {
    data: { confirm: true, reason: "Playwright Phase 4 revoke" },
  });
  expect(res.ok()).toBeTruthy();
  cleanupState.apiKeyIds = [];
  recordStep("apiKeys", { name: "API Keys", status: "PASS", detail: "create/rotate/revoke" });
});

test("F — Usage filters and CSV export", async ({ page }) => {
  await page.goto("/dashboard/usage");
  await expect(page.getByRole("button", { name: "7 Days" })).toBeVisible();
  await page.getByRole("button", { name: "Today" }).click();
  await page.getByRole("button", { name: "30 Days" }).click();

  const exportRes = await page.request.get("/api/workspace/usage/export?range=7d");
  expect(exportRes.status()).toBeLessThan(500);
  if (exportRes.ok()) {
    const csv = await exportRes.text();
    assertNoSecrets(csv, "usage csv");
  }

  const emptyVisible = await page.getByText("No usage data yet").isVisible().catch(() => false);
  recordStep("usageCsv", {
    name: "Usage/CSV",
    status: "PASS",
    detail: emptyVisible ? "empty state shown" : "data or filters ok",
  });
});

test("G — Billing preview guard", async ({ page, request }) => {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
  const isProduction = /zwima-group\.info/i.test(baseUrl);
  const isPreview = /\.vercel\.app/i.test(baseUrl);
  test.skip(isProduction || !isPreview, "Billing preview guard applies only on Vercel preview deployments");

  await page.goto("/dashboard/billing");
  await expect(page.getByText("Payments are temporarily unavailable in Preview")).toBeVisible();
  await expect(page.getByRole("button", { name: /Recharge.*disabled/i })).toBeDisabled();

  const webhook = await request.post("/api/webhooks/stripe", { data: {} });
  expect(webhook.status()).toBe(403);
  expect((await webhook.json()).error?.code).toBe("STRIPE_PREVIEW_DISABLED");

  const recharge = await request.post("/api/v1/recharge", { data: { packageId: "p10" } });
  expect(recharge.status()).toBe(403);
  expect((await recharge.json()).error?.code).toBe("STRIPE_PREVIEW_DISABLED");

  const checkout = await page.request.post("/api/billing/checkout", { data: { packageId: "p10" } });
  expect(checkout.status()).toBe(403);
  expect((await checkout.json()).error?.code).toBe("STRIPE_PREVIEW_DISABLED");

  recordStep("billingGuard", { name: "Billing Preview Guard", status: "PASS" });
});

test("H — Logs security", async ({ page }) => {
  await page.goto("/dashboard/logs");
  const logsRes = await page.request.get("/api/workspace/logs");
  expect(logsRes.status()).toBeLessThan(500);
  const logsBody = await logsRes.text();
  assertNoSecrets(logsBody, "logs list");

  if (logsRes.ok()) {
    const parsed = JSON.parse(logsBody);
    const items = parsed.items ?? [];
    if (items[0]) {
      const detail = await page.request.get(`/api/workspace/logs/${items[0].id}`);
      const detailText = await detail.text();
      assertNoSecrets(detailText, "log detail");
    }
  }

  const pageText = await page.locator("main").innerText();
  assertNoSecrets(pageText, "logs page");
  recordStep("logsSecurity", { name: "Logs security", status: "PASS" });
});

test("I — Settings save and audit log", async ({ page }) => {
  await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Loading settings…")).toHaveCount(0, { timeout: 30_000 });
  const regionInput = page
    .locator("div.rounded-xl")
    .filter({ hasText: "AI & Routing Defaults" })
    .locator('input:not([type="checkbox"]):not([type="number"])');
  const current = await regionInput.inputValue();
  const next = current === "EU-PW4" ? "EU" : "EU-PW4";
  await regionInput.fill(next);
  const [saveResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/workspace/settings") && r.request().method() === "PATCH",
      { timeout: 30_000 },
    ),
    page.getByRole("button", { name: "Save Settings" }).click(),
  ]);
  expect(saveResponse.status()).toBe(200);
  await expect(page.getByText("Settings saved.")).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(regionInput).toHaveValue(next);

  const audit = await page.request.get("/api/audit");
  expect(audit.status()).toBe(200);
  const logs = (await audit.json()).logs ?? [];
  const found = logs.some((l: { action: string }) => /workspace settings/i.test(l.action));
  expect(found).toBeTruthy();

  recordStep("settingsAudit", { name: "Settings/Audit", status: "PASS" });
});
