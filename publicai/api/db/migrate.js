const fs = require("fs");
const path = require("path");
const { getAdminClient, parseBody, json, handleOptions, withCors } = require("../lib/supabase");

async function needsBootstrap(admin) {
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const hasAdmin = listed?.users?.some((u) => u.email?.toLowerCase() === "admin@zwima-group.info");
  if (!hasAdmin) return true;

  const { count, error } = await admin.from("profiles").select("*", { count: "exact", head: true });
  if (error) {
    const message = String(error.message || "").toLowerCase();
    return message.includes("does not exist") || message.includes("schema cache");
  }
  return (count || 0) === 0;
}

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

const TABLES = [
  "profiles",
  "credit_wallets",
  "credit_transactions",
  "usage_records",
  "api_keys",
  "playground_conversations",
];

function isAuthorized(req, body, allowBootstrap) {
  const secret = process.env.SUPABASE_SEED_SECRET || process.env.ZWIMA_SEED_SECRET;
  const provided = body.secret || req.headers["x-seed-secret"] || "";
  if (secret && provided === secret) return true;
  return allowBootstrap;
}

async function tableExists(admin, table) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (!error) return true;
  const message = String(error.message || "").toLowerCase();
  return !message.includes("does not exist") && !message.includes("schema cache");
}

async function applySchemaWithPg() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    "";

  if (!connectionString) {
    return { applied: false, reason: "DATABASE_URL not configured" };
  }

  let Client;
  try {
    ({ Client } = require("pg"));
  } catch {
    return { applied: false, reason: "pg module unavailable" };
  }

  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    return { applied: true };
  } finally {
    await client.end();
  }
}

async function seedUsers(admin) {
  const results = [];

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
      if (error) {
        results.push({ email, ok: false, error: error.message });
        continue;
      }
      userId = data.user.id;
    } else if (!existing.email_confirmed_at) {
      await admin.auth.admin.updateUserById(existing.id, { email_confirm: true });
    }

    await admin.from("profiles").upsert({
      id: userId,
      email,
      company: seed.company,
      country: seed.country,
      role: seed.role,
      status: seed.status,
      plan: seed.plan,
    });

    await admin.from("credit_wallets").upsert({
      user_id: userId,
      balance: seed.initialCredits,
      currency: "EUR",
    });

    results.push({ email, ok: true, userId });
  }

  return results;
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const admin = getAdminClient();
    const body = parseBody(req);

    const bootstrapAllowed = await needsBootstrap(admin);
    if (!isAuthorized(req, body, bootstrapAllowed)) {
      return json(res, 403, { error: "Forbidden" });
    }

    const tablesBefore = {};
    let schemaMissing = false;
    for (const table of TABLES) {
      const exists = await tableExists(admin, table);
      tablesBefore[table] = exists;
      if (!exists) schemaMissing = true;
    }

    let schemaResult = { applied: false, reason: "tables already present" };
    if (schemaMissing) {
      schemaResult = await applySchemaWithPg();
      if (!schemaResult.applied) {
        return json(res, 503, {
          error: "Database schema not applied",
          tables: tablesBefore,
          hint: "Run supabase/schema.sql in Supabase SQL Editor or set DATABASE_URL for automatic migration",
          schemaResult,
        });
      }
    }

    const tablesAfter = {};
    for (const table of TABLES) {
      tablesAfter[table] = await tableExists(admin, table);
    }

    const seeded = await seedUsers(admin);

    return json(res, 200, {
      ok: true,
      schema: schemaResult,
      tables: tablesAfter,
      seeded,
      rls: "enabled via schema.sql policies",
    });
  } catch (err) {
    console.error("[db/migrate]", err);
    return json(res, 500, { error: err.message || "Migration failed" });
  }
};
