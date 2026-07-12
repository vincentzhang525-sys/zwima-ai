const {
  getAdminClient,
  parseBody,
  json,
  handleOptions,
  withCors,
  enforceRateLimit,
  writeAuditLog,
  writeSecurityEvent,
  getClientIp,
} = require("../lib/supabase");
const { sendTransactional } = require("../lib/email");
const { storeCode } = require("../lib/auth/codes");

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
      route: "user:forgot-password",
      limit: 5,
      windowSeconds: 60,
      key: `forgot:${ip}`,
    });
    if (!limiter.allowed) {
      await writeSecurityEvent({
        eventType: "blocked_ip",
        ip,
        detail: "Rate limit exceeded on forgot-password",
      });
      return json(res, 429, { error: "Too many reset requests. Please try again later." });
    }

    const body = parseBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return json(res, 400, { error: "Email is required." });

    await writeAuditLog({
      eventType: "auth",
      action: "forgot_password_requested",
      target: email,
      detail: "Password reset requested",
      ip,
    });

    const admin = getAdminClient();
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = listed?.users?.find((u) => u.email?.toLowerCase() === email);

    if (user) {
      const { code } = await storeCode(admin, { userId: user.id, email, purpose: "password_reset" });
      try {
        await sendTransactional("passwordReset", email, {
          email,
          code,
          link: `https://zwima-group.info/forgot-password.html?email=${encodeURIComponent(email)}`,
        });
      } catch (mailErr) {
        console.error("[user/forgot-password] app email", mailErr);
        return json(res, 503, { error: "Unable to send reset email. Please contact support." });
      }
    }

    return json(res, 200, {
      message: "If an account exists for this email, a reset code has been sent.",
    });
  } catch (err) {
    console.error("[user/forgot-password]", err);
    return json(res, err.status || 500, { error: err.message || "Forgot password request failed" });
  }
};
