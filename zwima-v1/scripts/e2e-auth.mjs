#!/usr/bin/env node
/**
 * One-time headed Clerk Google OAuth login for Playwright E2E.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "https://zwima-8v2foh32q-zwima.vercel.app";
const authFile = path.join(root, "playwright/.auth/user.json");
const authFileB = path.join(root, "playwright/.auth/user-b.json");
const targetFile = process.env.PLAYWRIGHT_ORG_B_LOGIN ? authFileB : authFile;
const WAIT_MS = 600_000;

const GOOGLE_BUTTON = [/continue with google/i, /^google$/i, /sign in with google/i];

async function launchBrowser() {
  const launchOpts = {
    headless: false,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  };
  try {
    return await chromium.launch({ ...launchOpts, channel: "chrome" });
  } catch {
    return await chromium.launch(launchOpts);
  }
}

async function findGoogleOAuthControl(page) {
  for (const pattern of GOOGLE_BUTTON) {
    const button = page.getByRole("button", { name: pattern });
    if (await button.first().isVisible().catch(() => false)) return button.first();
    const link = page.getByRole("link", { name: pattern });
    if (await link.first().isVisible().catch(() => false)) return link.first();
  }
  const clerkGoogle = page.locator(
    '.cl-socialButtonsBlockButtonGoogle, [data-provider="google"], [data-provider="oauth_google"]',
  );
  if (await clerkGoogle.first().isVisible().catch(() => false)) return clerkGoogle.first();
  const textMatch = page.locator("button, a, [role='button']").filter({ hasText: /continue with google/i });
  if (await textMatch.first().isVisible().catch(() => false)) return textMatch.first();
  return null;
}

async function tryClerkProgrammaticGoogle(page) {
  console.log("Trying Clerk programmatic Google OAuth redirect…");
  const result = await page.evaluate(async () => {
    const clerk = window.Clerk;
    if (!clerk) return { ok: false, reason: "Clerk not loaded" };
    try {
      await clerk.load();
      if (!clerk.client) return { ok: false, reason: "Clerk client unavailable" };
      const signIn = await clerk.client.signIn.create({});
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/dashboard`,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  });
  if (!result.ok) {
    console.log(`Clerk programmatic OAuth unavailable: ${result.reason}`);
    return false;
  }
  console.log("Redirecting to Google via Clerk OAuth…");
  return true;
}

async function clickGoogleOAuth(page, context) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1_500);

  const control = await findGoogleOAuthControl(page);
  if (control) {
    console.log("Clicking Continue with Google…\n");
    const popupPromise = context.waitForEvent("page", { timeout: 15_000 }).catch(() => null);
    await control.click();
    const popup = await popupPromise;
    if (popup) {
      console.log("Google OAuth popup opened.");
      await popup.waitForLoadState("domcontentloaded").catch(() => undefined);
    }
    return true;
  }

  await page.waitForFunction(() => window.Clerk?.loaded, { timeout: 30_000 }).catch(() => undefined);
  return tryClerkProgrammaticGoogle(page);
}

async function waitForAuthenticatedSession(page) {
  console.log("\n========================================");
  console.log("  请在浏览器中完成 Google 登录：");
  console.log("  1. 选择 Google 账号");
  console.log("  2. 完成验证码或授权确认");
  console.log("  3. 不要关闭浏览器，等待跳转到 /dashboard");
  console.log("========================================\n");

  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new Error("浏览器被关闭 — 请保持窗口打开直到出现 /dashboard");
    }

    const url = page.url();
    if (url.includes("accounts.google.com")) {
      await page.waitForTimeout(2_000);
      continue;
    }

    if (url.includes("/sso-callback") || url.includes("clerk.accounts.dev") || url.includes("clerk.com")) {
      await page.waitForTimeout(2_000);
      continue;
    }

    if (url.includes("/dashboard") && !url.includes("/login")) {
      const overview = await page.request.get("/api/workspace/overview");
      if (overview.status() === 200) return;
    }

    if (!url.includes("/login") && !url.includes("google.com")) {
      const overview = await page.request.get("/api/workspace/overview");
      if (overview.status() === 200) {
        if (!url.includes("/dashboard")) {
          await page.goto("/dashboard", { waitUntil: "domcontentloaded" }).catch(() => undefined);
        }
        if (page.url().includes("/dashboard") && !page.url().includes("/login")) return;
      }
    }

    await page.waitForTimeout(2_000);
  }

  throw new Error("等待 /dashboard 超时（10 分钟）— Google OAuth 可能未完成");
}

function authFileValid(file) {
  return fs.existsSync(file) && fs.statSync(file).size > 32;
}

async function main() {
  console.log("\n=== Playwright Clerk Google OAuth auth init ===");
  console.log(`Preview URL: ${baseURL}`);
  console.log(`Save target: ${targetFile}\n`);

  const browser = await launchBrowser();
  const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  let success = false;

  try {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const usedGoogle = await clickGoogleOAuth(page, context);
    if (!usedGoogle) {
      throw new Error("未找到 Continue with Google 按钮，且 Clerk OAuth 触发失败");
    }

    await waitForAuthenticatedSession(page);

    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    await context.storageState({ path: targetFile });

    if (!authFileValid(targetFile)) {
      throw new Error("storage state 文件为空或未写入");
    }

    const names = (await context.cookies()).map((c) => c.name);
    console.log("\nAuth initialization SUCCESS");
    console.log(`Storage state: ${targetFile}`);
    console.log(`Cookie names (values not logged): ${names.join(", ") || "(none)"}`);
    console.log("/dashboard: OK (no /login redirect)");
    console.log("/api/workspace/overview: HTTP 200\n");
    success = true;
  } catch (err) {
    console.error("\nAuth initialization FAILED");
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    if (success && !page.isClosed()) {
      await browser.close().catch(() => undefined);
    } else if (!page.isClosed()) {
      console.error("\n浏览器保持打开 — 完成 Google 登录后请重新运行 npm run e2e:auth，或手动关闭窗口。");
    }
  }

  return success;
}

const ok = await main();
process.exit(ok ? 0 : 1);
