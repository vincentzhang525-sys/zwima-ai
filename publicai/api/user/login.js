const {
  getAnonClient,
  getAdminClient,
  parseBody,
  loadProfile,
  mapProfile,
  json,
  handleOptions,
  withCors,
} = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = parseBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || password.length < 6) {
      return json(res, 400, { error: "Invalid email or password" });
    }

    const client = getAnonClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      return json(res, 401, { error: error.message || "Invalid email or password" });
    }

    const authed = getAnonClient(data.session.access_token);
    const profile = await loadProfile(authed, data.user.id);
    if (!profile) {
      return json(res, 500, { error: "Profile not found" });
    }
    if (profile.status === "suspended") {
      return json(res, 403, { error: "This account has been suspended. Please contact support." });
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
