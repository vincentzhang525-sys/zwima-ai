const {
  getAnonClient,
  getAdminClient,
  parseBody,
  loadProfile,
  json,
  handleOptions,
  withCors,
  enforceRateLimit,
  getClientIp,
} = require("../lib/supabase");
const { storeCode, verifyCode } = require("../lib/auth/codes");
const { sendTransactional } = require("../lib/email");
const { ensureProgress } = require("../onboarding/index.js");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const ip = getClientIp(req);
    const limiter = await enforceRateLimit({
      req,
      route: "user:verify-email",
      limit: 10,
      windowSeconds: 60,
      key: `verify:${ip}`,
    });
    if (!limiter.allowed) return json(res, 429, { error: "Too many attempts. Please try again later." });

    const body = parseBody(req);
    const action = body.action || "verify";
    const email = String(body.email || "").trim().toLowerCase();
    const admin = getAdminClient();

    if (action === "resend") {
      if (!email) return json(res, 400, { error: "Email is required." });
      const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const user = listed?.users?.find((u) => u.email?.toLowerCase() === email);
      if (!user) {
        return json(res, 200, { ok: true, message: "If an account exists, a verification code has been sent." });
      }
      if (user.email_confirmed_at) {
        return json(res, 400, { error: "Email is already verified." });
      }
      const { code } = await storeCode(admin, { userId: user.id, email, purpose: "email_verify" });
      await sendTransactional("verifyEmail", email, { email, code });
      return json(res, 200, { ok: true, message: "Verification code sent." });
    }

    const code = String(body.code || "").trim();
    if (!email || !code) return json(res, 400, { error: "Email and verification code are required." });

    const verified = await verifyCode(admin, { email, code, purpose: "email_verify" });
    if (!verified.ok) return json(res, 400, { error: verified.error });

    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = listed?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!user) return json(res, 404, { error: "Account not found." });

    await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    await admin.from("profiles").update({ email_verified_at: new Date().toISOString() }).eq("id", user.id);
    await ensureProgress(admin, user.id, { email_verified: true });

    try {
      const { data: prof } = await admin.from("profiles").select("company").eq("id", user.id).maybeSingle();
      await sendTransactional("welcome", email, { name: prof?.company, company: prof?.company });
    } catch (mailErr) {
      console.error("[user/verify-email] welcome", mailErr.message);
    }

    if (body.password) {
      const client = getAnonClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password: String(body.password) });
      if (error) return json(res, 200, { ok: true, verified: true, message: "Email verified. Please sign in." });
      const authed = getAnonClient(data.session.access_token);
      const profile = await loadProfile(authed, user.id);
      return json(res, 200, {
        ok: true,
        verified: true,
        user: profile,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      });
    }

    return json(res, 200, { ok: true, verified: true, message: "Email verified successfully." });
  } catch (err) {
    console.error("[user/verify-email]", err);
    return json(res, err.status || 500, { error: err.message || "Verification failed" });
  }
};
