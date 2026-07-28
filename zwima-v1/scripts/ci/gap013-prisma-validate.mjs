#!/usr/bin/env node
/**
 * GAP-013 — Prisma schema / migration integrity validation (read-only).
 * Never runs migrate deploy, db push, seed, or connects to Production.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function fail(msg) {
  console.error(`PRISMA_VALIDATE_FAIL ${msg}`);
  console.log("PRISMA_VALIDATE_STATUS=FAIL");
  process.exit(1);
}

const schemaPath = path.join(root, "prisma/schema.prisma");
if (!fs.existsSync(schemaPath)) {
  fail("prisma/schema.prisma missing");
}

const migrationsDir = path.join(root, "prisma/migrations");
if (!fs.existsSync(migrationsDir)) {
  fail("prisma/migrations missing");
}

const migrationFolders = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
  .map((d) => d.name)
  .sort();

if (migrationFolders.length === 0) {
  fail("no numbered migration folders found");
}

for (const name of migrationFolders) {
  const sql = path.join(migrationsDir, name, "migration.sql");
  if (!fs.existsSync(sql)) {
    fail(`migration ${name} missing migration.sql`);
  }
}

const lockPath = path.join(migrationsDir, "migration_lock.toml");
if (!fs.existsSync(lockPath)) {
  fail("migration_lock.toml missing");
}

// Dummy URL for prisma validate only — never used to open a Production connection here.
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://ci:ci@127.0.0.1:5432/ci_validate_only",
  DIRECT_URL: process.env.DIRECT_URL || "postgresql://ci:ci@127.0.0.1:5432/ci_validate_only",
};

// Strip migrate authorization so accidental shell wrappers cannot deploy.
delete env.DB_MIGRATION_AUTHORIZED;
delete env.PREVIEW_DB_MIGRATE_AUTHORIZED;

const result = spawnSync("npx", ["prisma", "validate"], {
  cwd: root,
  env,
  encoding: "utf8",
  shell: true,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  fail(`prisma validate exited ${result.status}`);
}

console.log(`PRISMA_VALIDATE_STATUS=PASS migrations=${migrationFolders.length}`);
console.log("PRISMA_MIGRATE_DEPLOY=SKIPPED");
console.log("PRODUCTION_DB_TOUCHED=NO");
process.exit(0);
