#!/usr/bin/env node
/**
 * GAP-013 — CI safety gate (read-only assertions).
 * Fails closed if CI env enables Production migrate, live Provider, live Stripe charge, or real email.
 * Does not deploy, migrate, call providers, charge, or send mail.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function fail(msg) {
  console.error(`CI_SAFETY_FAIL ${msg}`);
  console.log("CI_SAFETY_STATUS=FAIL");
  process.exit(1);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const truthy = new Set(["1", "true", "yes", "on"]);

function isTruthy(v) {
  return truthy.has(String(v ?? "").trim().toLowerCase());
}

// --- Environment bans (CI must never authorize spend / prod migrate) ---
const forbiddenTruthy = [
  "DB_MIGRATION_AUTHORIZED",
  "PREVIEW_DB_MIGRATE_AUTHORIZED",
  "PROVIDER_LIVE_CALLS_ENABLED",
  "ALLOW_LIVE_PROVIDER_CALLS",
  "STRIPE_LIVE_CHARGE_AUTHORIZED",
  "SEND_REAL_EMAIL",
  "RESEND_LIVE_SEND_AUTHORIZED",
];

for (const key of forbiddenTruthy) {
  if (isTruthy(process.env[key])) {
    fail(`${key} must not be truthy in CI`);
  }
}

if (String(process.env.VERCEL_ENV || "").toLowerCase() === "production") {
  fail("VERCEL_ENV=production is forbidden in GAP-013 CI");
}

if (String(process.env.NODE_ENV || "").toLowerCase() === "production" && isTruthy(process.env.CI)) {
  // GitHub Actions often leaves NODE_ENV unset; if set to production, still refuse migrate flags above.
  console.log("CI_SAFETY_NOTE NODE_ENV=production observed; migrate/live flags remain blocked");
}

// Explicit live-disable expectations when set
if (process.env.PROVIDER_LIVE_CALLS_DISABLED != null && !isTruthy(process.env.PROVIDER_LIVE_CALLS_DISABLED)) {
  fail("PROVIDER_LIVE_CALLS_DISABLED must be true when present in CI");
}

// --- Static script contracts (Preview / Production migrate refuse) ---
const migrateScript = read("scripts/db-migrate-authorized.mjs");
for (const needle of ["DB_MIGRATION_AUTHORIZED", "VERCEL_ENV=production", "REFUSING"]) {
  if (!migrateScript.includes(needle)) {
    fail(`db-migrate-authorized.mjs missing refuse contract: ${needle}`);
  }
}

const vercelBuild = read("scripts/vercel-build.mjs");
if (!vercelBuild.includes("REFUSING") || !/migrate/i.test(vercelBuild)) {
  fail("vercel-build.mjs must refuse migrate on normal builds");
}

const previewBuild = read("scripts/vercel-preview-build.mjs");
if (!previewBuild.includes("PREVIEW_DB_MIGRATE_AUTHORIZED")) {
  fail("vercel-preview-build.mjs must gate Preview migrate behind PREVIEW_DB_MIGRATE_AUTHORIZED");
}

// --- Forbidden tracked artifacts under zwima-v1 (repo paths are zwima-v1/...) ---
let tracked = "";
try {
  tracked = execSync("git ls-files -z -- zwima-v1", {
    cwd: path.resolve(root, ".."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  fail(`git ls-files failed: ${err instanceof Error ? err.message : String(err)}`);
}

const files = tracked
  .split("\0")
  .filter(Boolean)
  .map((f) => f.replace(/^zwima-v1[\\/]/, "").replace(/\\/g, "/"));

const forbiddenBasename = new Set([
  ".env",
  ".env.local",
  ".env.e2e.local",
  ".env.development",
  ".env.production",
  ".env.preview",
  "storageState.json",
]);

const forbiddenSuffix = [
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  "-rc-out.txt",
  "-report.txt",
];

const tempPathRe =
  /(^|\/)(\.tmp_|playwright\/\.auth\/|test-results\/|playwright-report\/|artifacts\/)/i;

for (const rel of files) {
  const base = path.posix.basename(rel);
  if (forbiddenBasename.has(base) && base !== ".env.example") {
    fail(`forbidden tracked file: ${rel}`);
  }
  if (base === ".env.example") continue;
  if (tempPathRe.test(rel)) {
    fail(`temp/test artifact must not be tracked: ${rel}`);
  }
  for (const suf of forbiddenSuffix) {
    if (rel.endsWith(suf)) {
      fail(`forbidden tracked suffix ${suf}: ${rel}`);
    }
  }
}

console.log("CI_SAFETY_STATUS=PASS");
console.log("CI_SAFETY_BANS=prod_migrate,live_provider,live_stripe_charge,real_email,env_artifacts");
process.exit(0);
