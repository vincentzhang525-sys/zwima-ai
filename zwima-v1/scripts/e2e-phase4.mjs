#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const authFile = path.join(root, "playwright/.auth/user.json");
const authB = path.join(root, "playwright/.auth/user-b.json");
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "https://zwima-8v2foh32q-zwima.vercel.app";

function authFileReady(file = authFile) {
  return fs.existsSync(file) && fs.statSync(file).size > 32;
}

async function sessionValid() {
  if (!authFileReady()) return false;
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ storageState: authFile, baseURL });
    const status = (await ctx.request.get("/api/workspace/overview")).status();
    await ctx.close();
    return status === 200;
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!(await sessionValid())) {
    console.log("Auth missing or expired — running headed Google OAuth setup…\n");
    execSync("npm run e2e:auth", { stdio: "inherit", cwd: root, env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL } });
  }

  if (!(await sessionValid())) {
    console.error("Auth still invalid after e2e:auth.");
    process.exit(1);
  }

  console.log("Auth OK — running Phase 4 E2E suite…\n");
  const projects = ["phase4-chromium", "phase4-admin-chromium"];
  if (authFileReady(authB)) projects.push("phase4-orgb-chromium");

  execSync(`npx playwright test ${projects.map((p) => `--project ${p}`).join(" ")}`, {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
