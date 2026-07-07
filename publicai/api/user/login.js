const {
  getAnonClient,
  getAdminClient,
  parseBody,
  loadProfile,
  enforceRateLimit,
  writeAuditLog,
  writeSecurityEvent,
  getClientIp,
  json,
  handleOptions,
  withCors,
} = require("../lib/supabase");
const crypto = require("crypto");

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
      route: "user:login",
      limit: 10,
      windowSeconds: 60,
      key: `login:${ip}`,
    });
    if (!limiter.allowed) {
      await writeSecurityEvent({
        eventType: "blocked_ip",
        ip,
        detail: "Rate limit exceeded on login",
      });
      return json(res, 429, { error: "Too many login attempts. Please try again later." });
    }

    const body = parseBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || password.length < 6) {
      return json(res, 400, { error: "Invalid email or password" });
    }

    const client = getAnonClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      await writeSecurityEvent({
        eventType: "failed_login",
        ip,
        detail: `${email}: ${error.message || "invalid credentials"}`,
      });
      return json(res, 401, { error: error.message || "Invalid email or password" });
    }

    const authed = getAnonClient(data.session.access_token);
    const profile = await loadProfile(authed, data.user.id);
    if (!profile) {
      return json(res, 500, { error: "Profile not found" });
    }
    if (profile.status === "suspended") {
      await writeSecurityEvent({
        eventType: "failed_login",
        userId: data.user.id,
        ip,
        detail: "Suspended user login attempt",
      });
      return json(res, 403, { error: "This account has been suspended. Please contact support." });
    }

    await writeAuditLog({
      userId: data.user.id,
      eventType: "auth",
      action: "user_login",
      target: "session",
      detail: "User signed in",
      ip,
      notify: true,
      notificationCategory: "security",
    });

    const admin = getAdminClient();
    await admin.from("user_sessions").insert({
      user_id: data.user.id,
      session_token_hash: crypto.createHash("sha256").update(String(data.session.refresh_token || "")).digest("hex"),
      remember_me: Boolean(body.remember),
      last_seen_at: new Date().toISOString(),
      expires_at: new Date((Number(data.session.expires_at) || Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString(),
      ip,
      user_agent: String(req.headers["user-agent"] || ""),
    });

    try {
      const { ensureProgress } = require("../onboarding/index.js");
      await ensureProgress(admin, data.user.id, { email_verified: true });
    } catch (onbErr) {
      console.error("[user/login] onboarding", onbErr);
    }

    return json(res, 200, {
      user: profile,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error("[user/login]", err);
    return json(res, err.status || 500, { error: err.message || "Login failed" });
  }
};
