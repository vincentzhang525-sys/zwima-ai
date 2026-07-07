const { getAuthedClient, getAdminClient, loadProfile, json, handleOptions, withCors } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const { client, user } = await getAuthedClient(req);
    const profile = await loadProfile(client, user.id);
    const role = String(profile?.role || "").toLowerCase();
    if (!["owner", "admin", "support"].includes(role)) {
      return json(res, 403, { error: "Admin access required." });
    }

    const admin = getAdminClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: sessions }, { data: failedLogins }, { data: blockedIps }, { data: activities }] = await Promise.all([
      admin.from("user_sessions").select("*").gte("last_seen_at", since24h).order("last_seen_at", { ascending: false }).limit(50),
      admin.from("security_events").select("*").eq("event_type", "failed_login").gte("created_at", since24h).order("created_at", { ascending: false }).limit(100),
      admin.from("security_events").select("*").eq("event_type", "blocked_ip").gte("created_at", since24h).order("created_at", { ascending: false }).limit(100),
      admin.from("audit_logs").select("*").gte("created_at", since24h).order("created_at", { ascending: false }).limit(50),
    ]);

    return json(res, 200, {
      activeSessions: Number(sessions?.length || 0),
      failedLogins: Number(failedLogins?.length || 0),
      blockedIps: [...new Set((blockedIps || []).map((row) => row.ip).filter(Boolean))],
      recentActivities: (activities || []).map((row) => ({
        id: row.id,
        action: row.action,
        detail: row.detail,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error("[admin/security]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load security dashboard" });
  }
};
