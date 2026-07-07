#!/usr/bin/env node
/**
 * Run migrations locally using Vercel production env injection.
 * Usage (from repo root):
 *   vercel env run --environment production -- node publicai/scripts/run-migrations-local.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(root, "..", ".vercel", ".env.production.local"));
loadEnvFile(path.join(root, ".vercel", ".env.production.local"));
loadEnvFile(path.join(root, "..", ".env.local"));

const { applyMigrations, verifyTables } = await import("../api/lib/runMigrations.js");

const SEED_USERS = [
  {
    email: "admin@zwima-group.info",
    password: "admin123",
    company: "Zwima Technologie GmbH",
    country: "Germany",
    role: "admin",
    status: "active",
    plan: "Enterprise",
    initialCredits: 50000,
  },
  {
    email: "demo@zwima-group.info",
    password: "demo123",
    company: "Demo Company GmbH",
    country: "Germany",
    role: "customer",
    status: "active",
    plan: "Starter",
    initialCredits: 5000,
  },
];

async function seedUsers() {
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const seed of SEED_USERS) {
    const email = seed.email.toLowerCase();
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email);

    let userId = existing?.id;
    if (!existing) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: seed.password,
        email_confirm: true,
        user_metadata: {
          company: seed.company,
          country: seed.country,
          role: seed.role,
          status: seed.status,
          plan: seed.plan,
        },
      });
      if (error) throw new Error(`Seed ${email}: ${error.message}`);
      userId = data.user.id;
    } else if (!existing.email_confirmed_at) {
      await admin.auth.admin.updateUserById(existing.id, { email_confirm: true });
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      company: seed.company,
      country: seed.country,
      role: seed.role,
      status: seed.status,
      plan: seed.plan,
    });
    if (profileError) throw new Error(`Profile ${email}: ${profileError.message}`);

    const { error: walletError } = await admin.from("credit_wallets").upsert({
      user_id: userId,
      balance: seed.initialCredits,
      currency: "EUR",
    });
    if (walletError) throw new Error(`Wallet ${email}: ${walletError.message}`);

    console.log(`Seeded ${email}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL not set. Run: vercel env run --environment production -- node publicai/scripts/run-migrations-local.mjs"
    );
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  console.log("Applying migrations via DATABASE_URL...");
  const result = await applyMigrations();
  console.log(JSON.stringify(result, null, 2));
  if (!result.applied) process.exit(1);

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const tables = await verifyTables(admin);
  console.log("Tables:", tables);

  console.log("Seeding users...");
  await seedUsers();
  console.log("Done.");
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
