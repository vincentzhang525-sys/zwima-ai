#!/usr/bin/env node
/**
 * Ensure smoke-test platform API key exists in production DB.
 * Uses SMOKE_TEST_API_KEY if set; otherwise creates one and upserts to Vercel.
 * Never prints full keys unless newly generated (prefix only in logs).
 */
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { resolveDirectDatabaseUrl } from "../src/lib/database-url.ts";

const projectId = "prj_gT8eCGD649DAhVlJ0YCCX2wx3D9B";
const teamId = "team_ywGwgNDnLs6bqeh18JOgHg2p";
const SMOKE_EMAIL = "smoke-test@zwima-group.info";
const SMOKE_CLERK = "smoke_test_internal";

function hashApiKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

function generateApiKey() {
  const secret = randomBytes(24).toString("hex");
  const fullKey = `sk_live_${secret}`;
  const prefix = `${fullKey.slice(0, 16)}…`;
  return { fullKey, prefix, keyHash: hashApiKey(fullKey) };
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
  const dbUrl = resolveDirectDatabaseUrl();
  const pgUrl = dbUrl.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?&/, "?").replace(/\?$/, "");
  const client = new pg.Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let apiKey = process.env.SMOKE_TEST_API_KEY?.trim();
  let created = false;
  if (!apiKey?.startsWith("sk_live_")) {
    const gen = generateApiKey();
    apiKey = gen.fullKey;
    created = true;
    console.log("Generated smoke API key prefix:", gen.prefix);
    try {
      await upsertVercelEnv("SMOKE_TEST_API_KEY", apiKey);
      console.log("Upserted SMOKE_TEST_API_KEY to Vercel (encrypted).");
    } catch (err) {
      console.log("Could not upsert SMOKE_TEST_API_KEY to Vercel:", err instanceof Error ? err.message : err);
    }
  } else {
    console.log("Using existing SMOKE_TEST_API_KEY prefix:", apiKey.slice(0, 16) + "…");
  }

  const keyHash = hashApiKey(apiKey);
  const prefix = `${apiKey.slice(0, 16)}…`;

  const userRes = await client.query(`SELECT id FROM "User" WHERE email = $1 LIMIT 1`, [SMOKE_EMAIL]);
  let userId = userRes.rows[0]?.id;
  if (!userId) {
    userId = `smoke_${randomBytes(8).toString("hex")}`;
    await client.query(
      `INSERT INTO "User" (id, "clerkId", email, tier, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'STANDARD', true, NOW(), NOW())`,
      [userId, SMOKE_CLERK, SMOKE_EMAIL]
    );
    console.log("Created smoke user:", SMOKE_EMAIL);
  }

  await client.query(
    `INSERT INTO "CreditBalance" (id, "userId", credits, "frozenCredits", "lifetimeSpend", "lifetimeRecharge", "updatedAt")
     VALUES ($1, $2, 500000, 0, 0, 500000, NOW())
     ON CONFLICT ("userId") DO UPDATE SET credits = GREATEST("CreditBalance".credits, 500000), "updatedAt" = NOW()`,
    [`cb_${userId}`, userId]
  );

  const existingKey = await client.query(`SELECT id FROM "ApiKey" WHERE "keyHash" = $1 LIMIT 1`, [keyHash]);
  if (!existingKey.rows[0]) {
    await client.query(
      `INSERT INTO "ApiKey" (id, "userId", name, "keyHash", prefix, enabled, permission, "usageCount", "createdAt")
       VALUES ($1, $2, 'Phase6 Smoke Test', $3, $4, true, 'CHAT', 0, NOW())`,
      [`key_${randomBytes(8).toString("hex")}`, userId, keyHash, prefix]
    );
    console.log("Registered smoke API key in database.");
  } else {
    console.log("Smoke API key already registered.");
  }

  await client.end();
  if (created) {
    console.log("IMPORTANT: redeploy required for runtime to pick up new SMOKE_TEST_API_KEY.");
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
