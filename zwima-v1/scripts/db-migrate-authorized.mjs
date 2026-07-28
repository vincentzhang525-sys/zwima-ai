#!/usr/bin/env node
/**
 * Authorized Prisma migrate deploy — Preview/operator use only.
 * Requires DB_MIGRATION_AUTHORIZED=true and a direct/session database URL.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, env = process.env) {
  execSync(cmd, { cwd: root, stdio: "inherit", env, shell: true });
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
  console.log("[db-migrate] prisma migrate status");
  run("npx prisma migrate status", env);
  console.log("[db-migrate] prisma migrate deploy");
  run("npx prisma migrate deploy", env);
  console.log("[db-migrate] DONE");
}

main();
