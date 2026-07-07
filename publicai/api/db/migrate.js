const { getAdminClient, parseBody, json, handleOptions, withCors } = require("../lib/supabase");
const { applyMigrations, verifyTables, getConnectionDebugInfo } = require("../lib/runMigrations");

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

function isAuthorized(req, body, allowBootstrap) {
  const secret = process.env.SUPABASE_SEED_SECRET || process.env.ZWIMA_SEED_SECRET;
  const provided = body.secret || req.headers["x-seed-secret"] || "";
  if (secret && provided === secret) return true;
  return allowBootstrap;
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

    let bootstrapAllowed = false;
    try {
      bootstrapAllowed = await needsBootstrap(admin);
    } catch (bootstrapErr) {
      console.error("[db/migrate] bootstrap check failed", bootstrapErr);
      bootstrapAllowed = true;
    }
    if (!isAuthorized(req, body, bootstrapAllowed)) {
      return json(res, 403, { error: "Forbidden" });
    }

    const tablesBefore = await verifyTables(admin);
    const schemaMissing = Object.values(tablesBefore).some((exists) => !exists);

    let schemaResult = { applied: false, reason: "tables already present" };
    if (schemaMissing) {
      schemaResult = await applyMigrations();
      if (!schemaResult.applied) {
        return json(res, 503, {
          error: "Database schema not applied",
          tables: tablesBefore,
          schemaResult,
          connectionDebug: getConnectionDebugInfo(),
        });
      }
    }

    const tablesAfter = await verifyTables(admin);
    const seeded = await seedUsers(admin);

    return json(res, 200, {
      ok: true,
      schema: schemaResult,
      tables: tablesAfter,
      seeded,
      rls: "enabled via migration 20260706120700_rls_policies.sql",
    });
  } catch (err) {
    console.error("[db/migrate]", err);
    return json(res, 500, { error: err.message || "Migration failed" });
  }
};
