#!/usr/bin/env node
/**
 * Build Supabase Postgres URL, update Vercel DATABASE_URL, run prisma db push + seed.
 * Run: cd repo root && npx vercel env run --environment production -- node zwima-v1/scripts/setup-production-db.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectId = "prj_gT8eCGD649DAhVlJ0YCCX2wx3D9B";
const teamId = "team_ywGwgNDnLs6bqeh18JOgHg2p";

const REGIONS = ["aws-0-eu-central-1", "aws-0-eu-west-3", "aws-0-eu-west-1", "aws-0-us-east-1"];

function refFromSupabaseUrl(url) {
  try {
    const host = new URL(url).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function buildUrl(ref, password, region) {
  const encoded = encodeURIComponent(password);
  return `postgresql://postgres.${ref}:${encoded}@${region}.pooler.supabase.com:5432/postgres?sslmode=require`;
}

async function testUrl(url) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

function loadToken() {
  const authPaths = [
    path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json"),
    path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
  ];
  for (const p of authPaths) {
    if (!fs.existsSync(p)) continue;
    return JSON.parse(fs.readFileSync(p, "utf8")).token;
  }
  throw new Error("no vercel token");
}

async function upsertVercelEnv(key, value) {
  const token = loadToken();
  const q = new URLSearchParams({ teamId, upsert: "true" });
  const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?${q}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, type: "encrypted", target: ["production", "preview"] }),
  });
  if (!res.ok) throw new Error(`vercel env ${key} failed ${res.status}`);
}

async function main() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!password || !supabaseUrl) throw new Error("Missing SUPABASE_DB_PASSWORD or SUPABASE_URL");

  const ref = refFromSupabaseUrl(supabaseUrl);
  if (!ref) throw new Error("Could not parse Supabase ref");

  let dbUrl = null;
  for (const region of REGIONS) {
    const candidate = buildUrl(ref, password, region);
    console.log("Trying pooler region:", region);
    if (await testUrl(candidate)) {
      dbUrl = candidate;
      console.log("Connected via", region);
      break;
    }
  }
  if (!dbUrl) throw new Error("Could not connect to Supabase with any pooler region");

  console.log("Updating Vercel DATABASE_URL...");
  await upsertVercelEnv("DATABASE_URL", dbUrl);

  console.log("Running prisma db push...");
  execSync("npx prisma db push --skip-generate", { cwd: root, stdio: "inherit", env: { ...process.env, DATABASE_URL: dbUrl } });

  console.log("Running prisma db seed...");
  execSync("npx tsx prisma/seed.ts", { cwd: root, stdio: "inherit", env: { ...process.env, DATABASE_URL: dbUrl } });

  console.log("Done.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
