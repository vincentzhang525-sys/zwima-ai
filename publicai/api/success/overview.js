const { getAuthedClient, json, handleOptions, withCors } = require("../lib/supabase");
const support = require("../lib/support");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const { getAdminClient } = require("../lib/supabase");
    const admin = getAdminClient();
    let userId = null;
    try {
      const { user } = await getAuthedClient(req);
      userId = user?.id;
    } catch {
      /* public board */
    }

    const [{ data: top }, { data: popular }, { data: released }, { data: openTickets }, { data: incidents }] = await Promise.all([
      admin.from("support_tickets").select("*").eq("record_type", "feature").order("vote_count", { ascending: false }).limit(10),
      admin.from("support_tickets").select("*").eq("record_type", "feature").order("created_at", { ascending: false }).limit(10),
      admin.from("support_tickets").select("*").eq("record_type", "feature").eq("roadmap_status", "released").order("updated_at", { ascending: false }).limit(10),
      userId
        ? admin.from("support_tickets").select("*").eq("user_id", userId).eq("record_type", "ticket").in("status", ["open", "assigned", "waiting_customer"]).limit(20)
        : Promise.resolve({ data: [] }),
      admin.from("status_incidents").select("*").eq("published", true).order("starts_at", { ascending: false }).limit(5),
    ]);

    let voted = new Set();
    if (userId && (top || []).length) {
      const ids = [...new Set([...(top || []), ...(popular || [])].map((f) => f.id))];
      const { data: votes } = await admin.from("feature_votes").select("feature_id").eq("user_id", userId).in("feature_id", ids);
      voted = new Set((votes || []).map((v) => v.feature_id));
    }

    const mapFeatures = (rows) =>
      (rows || []).map((row) => support.mapTicket(row, { hasVoted: voted.has(row.id) }));

    const recentTickets = userId
      ? (
          await admin.from("support_tickets").select("*").eq("user_id", userId).eq("record_type", "ticket").order("created_at", { ascending: false }).limit(5)
        ).data
      : [];

    const userFeatures = userId
      ? (
          await admin.from("support_tickets").select("*").eq("user_id", userId).eq("record_type", "feature").order("created_at", { ascending: false }).limit(5)
        ).data
      : [];

    const activeIncidents = (incidents || []).filter((i) => i.incident_status !== "resolved" && !i.resolved_at);

    let systemHealth = "operational";
    try {
      const { error } = await admin.from("profiles").select("id").limit(1);
      if (error) systemHealth = "degraded";
      if (activeIncidents.length) systemHealth = "degraded";
    } catch {
      systemHealth = "degraded";
    }

    return json(res, 200, {
      openTickets: (openTickets || []).map((r) => support.mapTicket(r)),
      recentTickets: (recentTickets || []).map((r) => support.mapTicket(r)),
      featureRequests: (userFeatures || []).map((r) => support.mapTicket(r)),
      votes: mapFeatures(top).filter((f) => voted.has(f.id)),
      announcements: activeIncidents.map(support.mapIncident),
      knownIncidents: (incidents || []).map(support.mapIncident),
      systemHealth,
      systemComponents: [],
      topRequested: mapFeatures(top),
      mostPopular: mapFeatures(popular),
      recentlyReleased: mapFeatures(released),
    });
  } catch (err) {
    console.error("[success/overview]", err);
    return json(res, err.status || 500, { error: err.message || "Success overview failed" });
  }
};
