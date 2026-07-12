#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl } from "../src/lib/database-url.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const dbUrl = resolveDatabaseUrl("session");
console.log("Using DB:", dbUrl.replace(/:[^:@/]+@/, ":***@"));

const env = { ...process.env, DATABASE_URL: dbUrl };

function pgUrl(url) {
  return url.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?&/, "?").replace(/\?$/, "");
}

async function schemaReady() {
  const client = new pg.Client({
    connectionString: pgUrl(dbUrl),
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const result = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'Provider'
      ) AS ready`
    );
    return result.rows[0]?.ready === true;
  } catch (err) {
    console.log("Schema check failed:", err instanceof Error ? err.message : err);
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

function applySchemaSql() {
  const sqlPath = path.join(os.tmpdir(), "zwima-prisma-init.sql");
  const sql = execSync(
    "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { cwd: root, encoding: "utf8", env }
  );
  fs.writeFileSync(sqlPath, sql);
  console.log("Applying schema SQL (" + sql.length + " bytes)...");
  try {
    execSync(`npx prisma db execute --file "${sqlPath}" --schema prisma/schema.prisma`, {
      cwd: root,
      stdio: "inherit",
      env,
    });
  } catch (err) {
    console.log("Schema apply skipped or partially applied:", err instanceof Error ? err.message : err);
  }
}

if (await schemaReady()) {
  console.log("Schema already present, skipping SQL apply.");
} else {
  applySchemaSql();
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

execSync("npx next build", { cwd: root, stdio: "inherit", env });
