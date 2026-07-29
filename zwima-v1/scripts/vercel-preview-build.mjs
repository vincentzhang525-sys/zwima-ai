#!/usr/bin/env node
/**
 * Vercel build entry — optional Preview-only migrate deploy, then safe build.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, env = process.env) {
  execSync(cmd, { cwd: root, stdio: "inherit", env, shell: true });
}

const vercelEnv = process.env.VERCEL_ENV || "";
const migrateAuthorized = process.env.PREVIEW_DB_MIGRATE_AUTHORIZED === "true";

console.log("[vercel-preview-build] VERCEL_ENV=" + (vercelEnv || "(unset)"));
console.log("[vercel-preview-build] PREVIEW_DB_MIGRATE_AUTHORIZED=" + migrateAuthorized);

if (migrateAuthorized) {
  if (vercelEnv !== "preview") {
    console.error("[vercel-preview-build] REFUSING migrate: not preview target");
    process.exit(2);
  }
  try {
    run("node scripts/db-migrate-authorized.mjs", {
      ...process.env,
      DB_MIGRATION_AUTHORIZED: "true",
    });
  } catch (err) {
    // Preview-only soft continue: GAP-020 and other no-migration features must still
    // ship a Ready Preview when an unrelated historical Preview migration (e.g. RLS
    // gap fix) remains stuck. Never runs under VERCEL_ENV=production (refused above).
    console.warn(
      "[vercel-preview-build] Preview migrate failed — continuing to app build. " +
        "Schema-dependent features may need a separate Preview DB repair authorization. " +
        String(err instanceof Error ? err.message : err),
    );
  }
}

run("node scripts/vercel-build.mjs");
