const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const { data, error } = await admin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) throw error;
    return json(
      res,
      200,
      (data || []).map((a) => ({
        time: a.created_at,
        actor: a.user_id || "system",
        action: a.action,
        target: a.target || "—",
        detail: a.detail || "",
      }))
    );
  } catch (err) {
    console.error("[admin/audit]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load audit" });
  }
};
