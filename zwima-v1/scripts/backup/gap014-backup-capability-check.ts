#!/usr/bin/env npx tsx
/**
 * GAP-014 — Backup capability check (read-only, no Production I/O).
 * Never prints secret values, connection strings, or PII.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENV_SCOPE_MANIFEST,
  REQUIRED_ENV_NAMES,
  assertEnvManifestCoverage,
  parseEnvExampleKeys,
  safeLogLine,
  summarizeDbHost,
} from "../../src/lib/ops/gap014-backup-recovery";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(root, "..");

function fail(msg: string): never {
  console.error(safeLogLine(`BACKUP_CAPABILITY_FAIL ${msg}`));
  console.log("DATABASE_BACKUP_CAPABILITY_STATUS=FAIL");
  process.exit(1);
}

function ok(key: string, detail = "") {
  console.log(safeLogLine(`${key}=PASS${detail ? ` ${detail}` : ""}`));
}

for (const rel of [
  "docs/ZWIMA_AI_BACKUP_MANIFEST.md",
  "docs/ZWIMA_AI_BACKUP_RECOVERY_RUNBOOK.md",
]) {
  if (!fs.existsSync(path.join(root, rel))) fail(`missing ${rel}`);
}
ok("BACKUP_MANIFEST_STATUS");
ok("RECOVERY_RUNBOOK_STATUS");

const schema = path.join(root, "prisma/schema.prisma");
const migDir = path.join(root, "prisma/migrations");
const lock = path.join(migDir, "migration_lock.toml");
if (!fs.existsSync(schema)) fail("prisma/schema.prisma missing");
if (!fs.existsSync(migDir)) fail("prisma/migrations missing");
if (!fs.existsSync(lock)) fail("migration_lock.toml missing");

const migrations = fs
  .readdirSync(migDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
  .map((d) => d.name)
  .sort();

if (migrations.length === 0) fail("no migrations");
for (const name of migrations) {
  if (!fs.existsSync(path.join(migDir, name, "migration.sql"))) {
    fail(`migration ${name} missing migration.sql`);
  }
}
ok("PRISMA_RECOVERY_STATUS", `migrations=${migrations.length}`);

const runbook = fs.readFileSync(path.join(root, "docs/ZWIMA_AI_BACKUP_RECOVERY_RUNBOOK.md"), "utf8");
for (const needle of ["Supabase", "Point-in-Time", "dry-run", "fail-closed", "Production"]) {
  if (!runbook.includes(needle)) fail(`runbook missing required topic: ${needle}`);
}
const manifestDoc = fs.readFileSync(path.join(root, "docs/ZWIMA_AI_BACKUP_MANIFEST.md"), "utf8");
if (!manifestDoc.includes("Supabase") || !manifestDoc.includes("PITR")) {
  fail("backup manifest missing Supabase/PITR capability section");
}
ok("DATABASE_BACKUP_CAPABILITY_STATUS", "supabase_platform_documented");

const example = fs.readFileSync(path.join(root, ".env.example"), "utf8");
const exampleKeys = parseEnvExampleKeys(example);
const coverage = assertEnvManifestCoverage(exampleKeys);
if (!coverage.ok) {
  fail(`env manifest missing example keys: ${coverage.missingFromExample.join(",")}`);
}
for (const name of REQUIRED_ENV_NAMES) {
  const scopes = ENV_SCOPE_MANIFEST[name];
  if (!scopes?.length) fail(`no scopes for ${name}`);
  console.log(safeLogLine(`ENV_NAME_SCOPE ${name}=${scopes.join("|")}`));
}
ok("VERCEL_ENV_MANIFEST_STATUS", `required_names=${REQUIRED_ENV_NAMES.length}`);

const previewList = path.join(root, "scripts/preview-list-deployments.mjs");
if (!fs.existsSync(previewList)) fail("preview-list-deployments.mjs missing");
if (!/rollback/i.test(runbook)) fail("runbook missing Preview rollback procedure");
ok("PREVIEW_ROLLBACK_STATUS", "documented+script_present");

let branch = "";
let head = "";
try {
  branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
  head = execSync("git rev-parse --short HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
} catch (err) {
  fail(`git recovery point unreadable: ${err instanceof Error ? err.message : String(err)}`);
}
if (!branch || branch === "HEAD") fail("detached HEAD is not a stable recovery branch label");
if (!/^[0-9a-f]{7,40}$/i.test(head)) fail("invalid HEAD sha");
ok("GIT_RECOVERY_POINT_STATUS", `branch=${branch} head=${head}`);

const dbSummary = summarizeDbHost(process.env.DATABASE_URL);
console.log(
  safeLogLine(
    `DATABASE_URL_SUMMARY present=${dbSummary.present} hostPrefix=${dbSummary.hostPrefix} looksProd=${dbSummary.looksProd}`,
  ),
);

console.log("PRODUCTION_DATABASE_MODIFIED=NO");
console.log("PRODUCTION_MODIFIED=NO");
console.log("BACKUP_CAPABILITY_CHECK=PASS");
process.exit(0);
