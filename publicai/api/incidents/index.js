const { json, handleOptions, withCors } = require("../lib/supabase");
const support = require("../lib/support");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const { getAdminClient } = require("../lib/supabase");
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("status_incidents")
      .select("*")
      .eq("published", true)
      .order("starts_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    const active = (data || []).filter((row) => row.incident_status !== "resolved" && !row.resolved_at);
    return json(res, 200, {
      active: active.map(support.mapIncident),
      history: (data || []).map(support.mapIncident),
    });
  } catch (err) {
    console.error("[incidents]", err);
    return json(res, 500, { error: err.message || "Incidents request failed" });
  }
};
