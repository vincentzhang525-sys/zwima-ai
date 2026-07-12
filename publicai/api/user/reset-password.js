const {
  getAdminClient,
  parseBody,
  json,
  handleOptions,
  withCors,
  enforceRateLimit,
  getClientIp,
  writeAuditLog,
} = require("../lib/supabase");
const { verifyCode } = require("../lib/auth/codes");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const ip = getClientIp(req);
    const limiter = await enforceRateLimit({
      req,
      route: "user:reset-password",
      limit: 5,
      windowSeconds: 60,
      key: `reset:${ip}`,
    });
    if (!limiter.allowed) return json(res, 429, { error: "Too many attempts. Please try again later." });

    const body = parseBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const password = String(body.password || "");

    if (!email || !code || password.length < 6) {
      return json(res, 400, { error: "Email, verification code, and new password (min 6 characters) are required." });
    }

    const admin = getAdminClient();
    const verified = await verifyCode(admin, { email, code, purpose: "password_reset" });
    if (!verified.ok) return json(res, 400, { error: verified.error });

    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = listed?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!user) return json(res, 404, { error: "Account not found." });

    const { error } = await admin.auth.admin.updateUserById(user.id, { password });
    if (error) return json(res, 400, { error: error.message || "Password update failed." });

    await writeAuditLog({
      userId: user.id,
      eventType: "auth",
      action: "password_reset_completed",
      target: email,
      detail: "Password reset via verification code",
      ip,
    });

    return json(res, 200, { ok: true, message: "Password updated successfully." });
  } catch (err) {
    console.error("[user/reset-password]", err);
    return json(res, err.status || 500, { error: err.message || "Password reset failed" });
  }
};
