const {
  getAuthedClient,
  loadProfile,
  parseBody,
  json,
  handleOptions,
  withCors,
} = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  if (req.method !== "PATCH" && req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const { client, user } = await getAuthedClient(req);
    const body = parseBody(req);
    const updates = {};

    if (body.company != null) updates.company = String(body.company).trim();
    if (body.country != null) updates.country = String(body.country).trim();
    if (body.language != null) updates.language = String(body.language).trim();
    if (body.timezone != null) updates.timezone = String(body.timezone).trim();

    if (!Object.keys(updates).length) {
      return json(res, 400, { error: "No profile fields to update" });
    }

    const { error } = await client.from("profiles").update(updates).eq("id", user.id);
    if (error) throw error;

    const profile = await loadProfile(client, user.id);
    return json(res, 200, { user: profile });
  } catch (err) {
    console.error("[user/profile]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to update profile" });
  }
};
