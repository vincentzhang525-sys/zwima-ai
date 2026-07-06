const { getAdminClient, parseBody, json, handleOptions, withCors } = require("../lib/supabase");

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

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const secret = process.env.SUPABASE_SEED_SECRET || process.env.ZWIMA_SEED_SECRET;
  const body = parseBody(req);
  if (!secret || body.secret !== secret) {
    return json(res, 403, { error: "Forbidden" });
  }

  try {
    const admin = getAdminClient();
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

    return json(res, 200, { seeded: results });
  } catch (err) {
    console.error("[db/seed-users]", err);
    return json(res, 500, { error: err.message || "Seed failed" });
  }
};
