#!/usr/bin/env node
/**
 * Run migrations during Vercel build (IPv6 direct db.* may work here).
 * Non-fatal: logs warnings so deploy continues if DB is unreachable.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { applyMigrations } = require(path.join(root, "api", "lib", "runMigrations.js"));

const hasDb =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_PASSWORD ||
  process.env.SUPABASE_ACCESS_TOKEN;

if (!hasDb) {
  console.log("[migrate:build] skipped — no database credentials in build env");
  process.exit(0);
}

console.log("[migrate:build] applying Supabase migrations...");
const result = await applyMigrations();
console.log("[migrate:build]", JSON.stringify(result));

if (!result.applied) {
  console.warn("[migrate:build] migrations not applied during build — use POST /api/db/migrate");
}
