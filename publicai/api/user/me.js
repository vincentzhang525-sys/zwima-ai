const { getAuthedClient, loadProfile, json, handleOptions, withCors } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const { client, user } = await getAuthedClient(req);
    const profile = await loadProfile(client, user.id);
    if (!profile) return json(res, 404, { error: "Profile not found" });
    return json(res, 200, { user: profile });
  } catch (err) {
    console.error("[user/me]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load profile" });
  }
};
