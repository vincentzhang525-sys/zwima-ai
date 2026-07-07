const {
  getAnonClient,
  getAdminClient,
  parseBody,
  loadProfile,
  enforceRateLimit,
  writeSecurityEvent,
  getClientIp,
  json,
  handleOptions,
  withCors,
} = require("../lib/supabase");
const { ensureProgress } = require("../onboarding/index.js");
const { sendTransactional, shouldAutoVerifyEmail } = require("../lib/email");

const FREE_CREDITS = 500;

async function grantWelcomeCredits(admin, userId) {
  const { data: wallet } = await admin.from("credit_wallets").select("*").eq("user_id", userId).maybeSingle();
  if (wallet) return false;
  await admin.from("credit_wallets").insert({ user_id: userId, balance: FREE_CREDITS, currency: "EUR" });
  await admin.from("credit_transactions").insert({
    user_id: userId,
    type: "bonus",
    amount: FREE_CREDITS,
    description: "Welcome free credits",
    txn_date: new Date().toISOString().slice(0, 10),
    status: "completed",
  });
  return true;
}

async function registerWithMockVerification({ admin, client, email, password, company, country }) {
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email);
  if (existing) return { error: "User already registered" };

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      company,
      country,
      role: "customer",
      status: "active",
      plan: "Starter",
    },
  });
  if (error) return { error: error.message || "Registration failed" };

  const userId = created.user.id;
  await admin.from("profiles").upsert({
    id: userId,
    email,
    company,
    country,
    role: "customer",
    status: "active",
    plan: "Starter",
  });

  const granted = await grantWelcomeCredits(admin, userId);
  await ensureProgress(admin, userId, {
    registered: true,
    email_verified: true,
    credits_received: granted,
  });

  try {
    await sendTransactional("verifyEmail", email, {
      email,
      link: "https://zwima-group.info/verify-email.html",
    });
    await sendTransactional("welcome", email, { name: company, company });
  } catch (mailErr) {
    console.error("[user/register] mock emails", mailErr);
  }

  const signIn = await client.auth.signInWithPassword({ email, password });
  if (!signIn.data?.session) {
    return { error: signIn.error?.message || "Login after registration failed" };
  }

  const authed = getAnonClient(signIn.data.session.access_token);
  const profile = await loadProfile(authed, userId);
  return {
    user: profile,
    session: {
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
      expires_at: signIn.data.session.expires_at,
    },
    mockVerification: true,
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const ip = getClientIp(req);
    const limiter = await enforceRateLimit({
      req,
      route: "user:register",
      limit: 5,
      windowSeconds: 60,
      key: `register:${ip}`,
    });
    if (!limiter.allowed) {
      await writeSecurityEvent({
        eventType: "blocked_ip",
        ip,
        detail: "Rate limit exceeded on register",
      });
      return json(res, 429, { error: "Too many registration attempts. Please try again later." });
    }

    const body = parseBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const company = String(body.company || "").trim();

    if (!company) return json(res, 400, { error: "Company name is required." });
    if (!email || password.length < 6) {
      return json(res, 400, { error: "Please provide a valid email and password (min 6 characters)." });
    }

    const client = getAnonClient();

    if (shouldAutoVerifyEmail()) {
      const admin = getAdminClient();
      const mockResult = await registerWithMockVerification({
        admin,
        client,
        email,
        password,
        company,
        country: body.country || "Germany",
      });
      if (mockResult.error) return json(res, 400, { error: mockResult.error });
      return json(res, 200, mockResult);
    }

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          company,
          country: body.country || "Germany",
          role: "customer",
          status: "active",
          plan: "Starter",
        },
      },
    });

    if (error) {
      return json(res, 400, { error: error.message || "Registration failed" });
    }

    if (!data.session) {
      const admin = getAdminClient();
      if (data.user?.id) {
        await ensureProgress(admin, data.user.id, { registered: true });
      }
      try {
        await sendTransactional("verifyEmail", email, {
          email,
          link: "https://zwima-group.info/verify-email.html",
        });
      } catch (mailErr) {
        console.error("[user/register] verify email", mailErr);
      }

      if (shouldAutoVerifyEmail() && data.user?.id) {
        await admin.auth.admin.updateUserById(data.user.id, { email_confirm: true });
        await ensureProgress(admin, data.user.id, { email_verified: true });
        const granted = await grantWelcomeCredits(admin, data.user.id);
        await ensureProgress(admin, data.user.id, { credits_received: granted });
        const signIn = await client.auth.signInWithPassword({ email, password });
        if (signIn.data?.session) {
          try {
            await sendTransactional("welcome", email, { name: company, company });
          } catch (mailErr) {
            console.error("[user/register] welcome email", mailErr);
          }
          const authed = getAnonClient(signIn.data.session.access_token);
          const profile = await loadProfile(authed, data.user.id);
          return json(res, 200, {
            user: profile,
            session: {
              access_token: signIn.data.session.access_token,
              refresh_token: signIn.data.session.refresh_token,
              expires_at: signIn.data.session.expires_at,
            },
            mockVerification: true,
          });
        }
      }

      return json(res, 200, {
        pending: true,
        email,
        message: "Registration created. Sign in after email confirmation is disabled in Supabase.",
      });
    }

    const admin = getAdminClient();
    const granted = await grantWelcomeCredits(admin, data.user.id);
    await ensureProgress(admin, data.user.id, {
      registered: true,
      email_verified: true,
      credits_received: granted,
    });
    try {
      await sendTransactional("welcome", email, { name: company, company });
    } catch (mailErr) {
      console.error("[user/register] welcome email", mailErr);
    }

    const authed = getAnonClient(data.session.access_token);
    const profile = await loadProfile(authed, data.user.id);

    return json(res, 200, {
      user: profile,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error("[user/register]", err);
    return json(res, err.status || 500, { error: err.message || "Registration failed" });
  }
};
