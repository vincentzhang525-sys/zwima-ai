#!/usr/bin/env node
/**
 * Authorized Prisma migrate deploy — Preview/operator use only.
 * Requires DB_MIGRATION_AUTHORIZED=true and a direct/session database URL.
 */
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, env = process.env) {
  execSync(cmd, { cwd: root, stdio: "inherit", env, shell: true });
}

function runOptional(cmd, env = process.env) {
  try {
    execSync(cmd, { cwd: root, stdio: "inherit", env, shell: true });
    return true;
  } catch {
    return false;
  }
}

function runCapture(cmd, env = process.env) {
  return spawnSync(cmd, { cwd: root, env, shell: true, encoding: "utf8" });
}

function redactHost(raw) {
  try {
    const u = new URL(raw.replace(/^postgres(ql)?:\/\//i, "http://"));
    const userParts = u.username.split(".");
    const userPrefix = userParts.length > 1 ? `${userParts[0]}.${userParts[1].slice(0, 4)}` : u.username.slice(0, 4);
    const host = u.hostname;
    const port = u.port || "5432";
    const looksProd =
      /prod(uction)?/i.test(host) ||
      /prod(uction)?/i.test(u.pathname) ||
      host.includes("zwima-group.info");
    return { host, port, userPrefix, looksProd };
  } catch {
    return { host: "invalid", port: "?", userPrefix: "?", looksProd: true };
  }
}

function resolveDirectUrl() {
  const candidates = [
    process.env.DIRECT_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
  ];
  for (const c of candidates) {
    if (c && String(c).trim() && !String(c).includes("[SENSITIVE]")) return String(c).trim();
  }
  return null;
}

function parsePendingMigrations(statusOutput) {
  const lines = statusOutput.split("\n");
  const pending = [];
  let inPending = false;
  for (const line of lines) {
    if (
      line.includes("The migrations have not yet been applied:") ||
      line.includes("Following migrations have not yet been applied:")
    ) {
      inPending = true;
      continue;
    }
    if (inPending) {
      if (
        !line.trim() ||
        line.includes("The migrations from the database") ||
        line.includes("To apply migrations")
      ) {
        break;
      }
      const name = line.trim();
      if (/^\d{14}_/.test(name)) pending.push(name);
    }
  }
  return pending;
}

/** Extract failed migration names from prisma migrate status / deploy output (P3009). */
function parseFailedMigrations(output) {
  const failed = new Set();
  const backtick = /The `(\d{14}_[A-Za-z0-9_]+)` migration started at .+ failed/g;
  let match;
  while ((match = backtick.exec(output)) !== null) {
    failed.add(match[1]);
  }
  const lines = output.split("\n");
  let inFailed = false;
  for (const line of lines) {
    if (
      line.includes("have failed") ||
      line.includes("failed migrations") ||
      line.includes("Following migration have failed") ||
      line.includes("The following migration(s) have failed")
    ) {
      inFailed = true;
      continue;
    }
    if (inFailed) {
      if (!line.trim() || line.includes("To apply") || line.includes("Read more")) break;
      const name = line.trim().replace(/^[-*]\s*/, "");
      if (/^\d{14}_/.test(name)) failed.add(name);
    }
  }
  return [...failed];
}

function applyMigrationSql(migrationName, env) {
  const sqlPath = path.join(root, "prisma/migrations", migrationName, "migration.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("[db-migrate] missing migration file for " + migrationName);
    return false;
  }
  console.log("[db-migrate] prisma db execute --file " + migrationName);
  if (!runOptional(`npx prisma db execute --file "${sqlPath}"`, env)) {
    console.error("[db-migrate] execute failed for " + migrationName);
    return false;
  }
  console.log("[db-migrate] prisma migrate resolve --applied " + migrationName);
  return runOptional(`npx prisma migrate resolve --applied ${migrationName}`, env);
}

/**
 * Preview-only: clear P3009 failed rows, re-apply SQL, mark applied.
 * Never runs under VERCEL_ENV=production (caller already refuses production).
 */
function failedMigrationRecovery(env, deployOutput) {
  const status = runCapture("npx prisma migrate status", env);
  const combined = `${deployOutput || ""}\n${status.stdout || ""}\n${status.stderr || ""}`;
  const failed = parseFailedMigrations(combined);
  console.log("[db-migrate] P3009_RECOVERY failed_count=" + failed.length);
  if (failed.length === 0) return false;

  let recovered = 0;
  for (const name of failed) {
    if (name.includes("preview_public_rls_hardening")) {
      console.log("[db-migrate] skipping preview-only marker name during failed recovery: " + name);
      continue;
    }
    console.log("[db-migrate] prisma migrate resolve --rolled-back " + name);
    if (!runOptional(`npx prisma migrate resolve --rolled-back ${name}`, env)) {
      console.error("[db-migrate] rolled-back resolve failed for " + name);
      continue;
    }
    if (applyMigrationSql(name, env)) recovered += 1;
  }
  console.log("[db-migrate] P3009_RECOVERY recovered_count=" + recovered);
  return recovered > 0;
}

function driftRecovery(env) {
  const status = runCapture("npx prisma migrate status", env);
  const output = `${status.stdout || ""}\n${status.stderr || ""}`;
  const pending = parsePendingMigrations(output);
  console.log("[db-migrate] DRIFT_RECOVERY pending_count=" + pending.length);
  if (pending.length === 0) return false;

  let applied = 0;
  for (const name of pending) {
    if (applyMigrationSql(name, env)) applied += 1;
  }
  console.log("[db-migrate] DRIFT_RECOVERY applied_count=" + applied);
  return applied > 0;
}

function main() {
  if (process.env.DB_MIGRATION_AUTHORIZED !== "true") {
    console.error("[db-migrate] REFUSING: set DB_MIGRATION_AUTHORIZED=true");
    process.exit(2);
  }

  const vercelEnv = process.env.VERCEL_ENV || "";
  if (vercelEnv === "production") {
    console.error("[db-migrate] REFUSING: VERCEL_ENV=production");
    process.exit(2);
  }

  const directUrl = resolveDirectUrl();
  if (!directUrl) {
    console.error("[db-migrate] REFUSING: no DIRECT_URL or DATABASE_URL");
    process.exit(2);
  }

  const meta = redactHost(directUrl);
  console.log("[db-migrate] TARGET_ENV=" + (vercelEnv || "local"));
  console.log("[db-migrate] DB_HOST=" + meta.host);
  console.log("[db-migrate] DB_PORT=" + meta.port);
  console.log("[db-migrate] DB_USER_PREFIX=" + meta.userPrefix);
  console.log("[db-migrate] LOOKS_PROD_HOST=" + (meta.looksProd ? "MAYBE" : "NO"));

  if (meta.looksProd && vercelEnv !== "preview") {
    console.error("[db-migrate] REFUSING: host looks production-like outside preview");
    process.exit(2);
  }

  const env = { ...process.env, DATABASE_URL: directUrl };

  console.log("[db-migrate] prisma migrate status (non-blocking)");
  runOptional("npx prisma migrate status", env);

  console.log("[db-migrate] prisma migrate deploy");
  const deployCapture = runCapture("npx prisma migrate deploy", env);
  const deployOutput = `${deployCapture.stdout || ""}\n${deployCapture.stderr || ""}`;
  if (deployOutput.trim()) process.stdout.write(deployOutput);
  let deployOk = deployCapture.status === 0;

  if (!deployOk) {
    console.log("[db-migrate] migrate deploy failed — attempting P3009 failed-migration recovery (Preview only)");
    if (failedMigrationRecovery(env, deployOutput)) {
      console.log("[db-migrate] retry prisma migrate deploy after P3009 recovery");
      deployOk = runOptional("npx prisma migrate deploy", env);
    }
  }

  if (!deployOk) {
    console.log("[db-migrate] migrate deploy failed — drift recovery via formal migration SQL");
    if (!driftRecovery(env)) {
      console.error("[db-migrate] REFUSING: migrate deploy and drift recovery both failed");
      process.exit(2);
    }
  }

  console.log("[db-migrate] DONE");
}

main();
