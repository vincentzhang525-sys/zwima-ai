#!/usr/bin/env node
/**
 * Normal Vercel / CI build — NO database mutations.
 * Allowed: prisma generate, optional typecheck, next build.
 * Forbidden: prisma migrate*, db push, seed, schema reset.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
}

console.log("[vercel-build] Safe build mode — database mutations disabled");
console.log("[vercel-build] VERCEL_ENV=", process.env.VERCEL_ENV || "(unset)");

if (process.env.DB_MIGRATION_AUTHORIZED === "true" || process.env.ALLOW_PRISMA_MIGRATE_DEPLOY === "true") {
  console.error(
    "[vercel-build] REFUSING: migration auth flags must not be set on normal builds. Use: npm run db:migrate:authorized",
  );
  process.exit(2);
}

// Explicit allow-list only — never invoke migrate / db push / seed here.
run("npx prisma generate");

if (process.env.VERCEL_BUILD_TYPECHECK === "true") {
  console.log("[vercel-build] Running typecheck (VERCEL_BUILD_TYPECHECK=true)");
  run("npx tsc --noEmit");
}

run("npx next build");

console.log("[vercel-build] Complete (generate + build only)");
