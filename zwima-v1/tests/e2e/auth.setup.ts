import fs from "node:fs";
import path from "node:path";
import { test as setup } from "@playwright/test";
import { AUTH_FILE, AUTH_FILE_B, authFileReady } from "./helpers/constants";
import {
  logAuthSuccess,
  runAuthInitFlow,
  sessionLooksValid,
} from "./helpers/auth-init";
import { recordMeta } from "./helpers/results";

setup.setTimeout(600_000);

async function saveStorageState(page: import("@playwright/test").Page, file: string): Promise<void> {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.context().storageState({ path: file });
  const names = (await page.context().cookies()).map((c) => c.name);
  logAuthSuccess(file, names);
}

setup("Clerk Google OAuth (primary user)", async ({ page, context, baseURL }) => {
  recordMeta({ previewUrl: baseURL ?? "", clerkAuthValid: false });

  if (authFileReady(AUTH_FILE)) {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    if (await sessionLooksValid(page)) {
      console.log("Existing auth state valid — skipping Google OAuth.");
      recordMeta({ clerkAuthValid: true });
      return;
    }
    console.log("Stored auth expired — starting Google OAuth flow.");
  } else {
    console.log("\n=== Clerk Google OAuth auth init ===");
    console.log("1. Playwright will click Continue with Google when available.");
    console.log("2. Complete Google sign-in in the browser (popup or same tab).");
    console.log("3. Wait until /dashboard loads — do not close the window.\n");
  }

  await runAuthInitFlow(page, context);
  await saveStorageState(page, AUTH_FILE);
  recordMeta({ clerkAuthValid: true });
});

setup("Clerk Google OAuth (optional org B)", async ({ page, context }) => {
  setup.skip(!process.env.PLAYWRIGHT_ORG_B_LOGIN, "Set PLAYWRIGHT_ORG_B_LOGIN=1 for second-org auth.");

  if (authFileReady(AUTH_FILE_B)) {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    if (await sessionLooksValid(page)) {
      console.log("Org B auth already valid.");
      return;
    }
  }

  console.log("\n=== Optional Org B Google OAuth ===\n");
  await runAuthInitFlow(page, context);
  await saveStorageState(page, AUTH_FILE_B);
});
