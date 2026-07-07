const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const userId = String(req.query?.userId || "");
    if (!userId) return json(res, 400, { error: "userId is required" });
    const [{ data: profile }, { data: keys }, { data: usage }, { data: billing }, { data: sessions }, { data: activity }] = await Promise.all([
      admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      admin.from("api_keys").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      admin.from("usage_records").select("*").eq("user_id", userId).order("date_time", { ascending: false }).limit(100),
      admin.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      admin.from("user_sessions").select("*").eq("user_id", userId).order("last_seen_at", { ascending: false }).limit(50),
      admin.from("audit_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    ]);
    return json(res, 200, { profile, apiKeys: keys || [], usage: usage || [], billing: billing || [], loginHistory: sessions || [], activity: activity || [] });
  } catch (err) {
    console.error("[admin/user-details]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load user details" });
  }
};
