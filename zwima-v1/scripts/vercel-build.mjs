#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl } from "../src/lib/database-url.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const dbUrl = resolveDatabaseUrl("session");
console.log("Using DB:", dbUrl.replace(/:[^:@/]+@/, ":***@"));

const env = { ...process.env, DATABASE_URL: dbUrl };

console.log("Running database migrations...");
if (process.env.VERCEL_ENV === "preview") {
  console.log("Preview: clearing public schema...");
  execSync("npx prisma db execute --stdin --schema prisma/schema.prisma", {
    cwd: root,
    stdio: ["pipe", "inherit", "inherit"],
    env,
    input: "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;",
  });
  const sql = execSync(
    "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { cwd: root, encoding: "utf8", env },
  );
  const sqlPath = path.join(os.tmpdir(), "zwima-preview-schema.sql");
  fs.writeFileSync(sqlPath, sql);
  console.log("Applying full schema (" + sql.length + " bytes)...");
  execSync(`npx prisma db execute --file "${sqlPath}" --schema prisma/schema.prisma`, {
    cwd: root,
    stdio: "inherit",
    env,
  });
  execSync("npx prisma migrate resolve --applied 20250713180000_phase1_infra", {
    cwd: root,
    stdio: "inherit",
    env,
  });
  execSync("npx prisma migrate resolve --applied 20250714120000_phase2_commercial", {
    cwd: root,
    stdio: "inherit",
    env,
  });
  console.log("Preview migration baseline complete.");
} else {
  execSync("npx prisma migrate deploy", { cwd: root, stdio: "inherit", env });
}

execSync("npx prisma generate", { cwd: root, stdio: "inherit", env });
execSync("npx tsx prisma/seed.ts", { cwd: root, stdio: "inherit", env });

console.log("\n--- Qwen endpoint probe (build-time) ---");
try {
  execSync("node scripts/qwen-probe.mjs", { cwd: root, stdio: "inherit", env });
} catch {
  console.log("Qwen probe: no working endpoint/model combination detected at build time.");
}

console.log("\n--- Bootstrap smoke test user ---");
try {
  execSync("node scripts/bootstrap-smoke-user.mjs", { cwd: root, stdio: "inherit", env });
} catch (err) {
  console.log("Smoke user bootstrap skipped:", err instanceof Error ? err.message : err);
}

console.log("\n--- Stripe Step 2 verify ---");
if (process.env.STRIPE_PREVIEW_DISABLED === "true") {
  console.log("Stripe Step 2 verify SKIPPED — STRIPE_PREVIEW_DISABLED=true");
} else {
try {
  execSync("node scripts/stripe-step2-verify.mjs", { cwd: root, stdio: "inherit", env });
} catch {
  console.log("Stripe Step 2 verify did not pass — see log above.");
}
}

execSync("npx next build", { cwd: root, stdio: "inherit", env });
