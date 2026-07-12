const {
  getAnonClient,
  getAdminClient,
  parseBody,
  enforceRateLimit,
  writeSecurityEvent,
  getClientIp,
  json,
  handleOptions,
  withCors,
} = require("../lib/supabase");
const { ensureProgress } = require("../onboarding/index.js");
const { sendTransactional } = require("../lib/email");
const { storeCode } = require("../lib/auth/codes");

/** Register via admin API — app email only (no Supabase transactional email). */
async function registerWithAppEmail({ admin, email, password, company, country }) {
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email);
  if (existing) return { error: "User already registered" };

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      company,
      country,
      role: "customer",
      status: "active",
      plan: "free",
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
    plan: "free",
  });

  await admin.from("credit_wallets").insert({ user_id: userId, balance: 0, currency: "EUR" }).then(() => null).catch(() => null);

  await ensureProgress(admin, userId, {
    registered: true,
    email_verified: false,
    credits_received: false,
  });

  const { code } = await storeCode(admin, { userId, email, purpose: "email_verify" });
  try {
    await sendTransactional("verifyEmail", email, { email, code });
  } catch (mailErr) {
    console.error("[user/register] verify email", mailErr);
    return { error: mailErr.message || "Failed to send verification email. Check SMTP configuration." };
  }

  return {
    pending: true,
    email,
    message: "Account created. Check your email for the verification code.",
    requiresVerification: true,
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

    const admin = getAdminClient();
    const result = await registerWithAppEmail({
      admin,
      email,
      password,
      company,
      country: body.country || "Germany",
    });
    if (result.error) return json(res, 400, { error: result.error });
    return json(res, 200, result);
  } catch (err) {
    console.error("[user/register]", err);
    return json(res, err.status || 500, { error: err.message || "Registration failed" });
  }
};
