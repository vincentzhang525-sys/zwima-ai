import fs from "node:fs";
import path from "node:path";

export const TEST_PREFIX = "PW4 Preview";
export const AUTH_FILE = path.join(process.cwd(), "playwright/.auth/user.json");
export const AUTH_FILE_B = path.join(process.cwd(), "playwright/.auth/user-b.json");
export const RESULTS_FILE = path.join(process.cwd(), "artifacts/phase4-playwright-results.json");
export const REPORT_MD = path.join(process.cwd(), "docs/PHASE4_PLAYWRIGHT_VALIDATION_REPORT.md");
export const ORG_A_PROJECT_ID_FILE = path.join(process.cwd(), "artifacts/pw4-org-a-project-id.txt");

export const ROUTING_MODES = [
  "BALANCED",
  "LOWEST_COST",
  "LOWEST_LATENCY",
  "HIGHEST_QUALITY",
  "EU_COMPLIANCE",
] as const;

export const WORKSPACE_PAGES = [
  "/dashboard",
  "/dashboard/projects",
  "/dashboard/api-keys",
  "/dashboard/playground",
  "/dashboard/usage",
  "/dashboard/billing",
  "/dashboard/logs",
  "/dashboard/settings",
] as const;

export function runLabel(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${TEST_PREFIX} ${stamp}`;
}

export function authFileReady(file = AUTH_FILE): boolean {
  return fs.existsSync(file) && fs.statSync(file).size > 32;
}
