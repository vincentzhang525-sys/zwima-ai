const {
  getAnonClient,
  parseBody,
  loadProfile,
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
    const company = String(body.company || "").trim();

    if (!company) return json(res, 400, { error: "Company name is required." });
    if (!email || password.length < 6) {
      return json(res, 400, { error: "Please provide a valid email and password (min 6 characters)." });
    }

    const client = getAnonClient();
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
      return json(res, 200, {
        pending: true,
        email,
        message: "Registration created. Sign in after email confirmation is disabled in Supabase.",
      });
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
