const { parseBody, json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const body = parseBody(req);
    const userId = String(body.userId || "");
    const enabled = Boolean(body.enabled);
    if (!userId) return json(res, 400, { error: "userId is required" });
    const { error } = await admin
      .from("profiles")
      .update({ status: enabled ? "active" : "suspended" })
      .eq("id", userId);
    if (error) throw error;
    return json(res, 200, { success: true });
  } catch (err) {
    console.error("[admin/users-toggle]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to toggle user" });
  }
};
