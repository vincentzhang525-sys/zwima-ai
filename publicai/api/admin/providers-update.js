const { parseBody, json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    await requireAdmin(req);
    parseBody(req);
    return json(res, 200, { success: true });
  } catch (err) {
    console.error("[admin/providers-update]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to update provider" });
  }
};
