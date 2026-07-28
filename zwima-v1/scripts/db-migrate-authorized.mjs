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
    if (line.includes("The migrations have not yet been applied:")) {
      inPending = true;
      continue;
    }
    if (inPending) {
      if (!line.trim() || line.includes("The migrations from the database")) break;
      const name = line.trim();
      if (name) pending.push(name);
    }
  }
  return pending;
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
  const deployOk = runOptional("npx prisma migrate deploy", env);

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
