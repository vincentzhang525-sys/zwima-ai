const { json, handleOptions, withCors, getAdminClient } = require("../lib/supabase");
const support = require("../lib/support");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const admin = getAdminClient();
    const [{ data: top }, { data: popular }, { data: released }] = await Promise.all([
      admin.from("support_tickets").select("*").eq("record_type", "feature").order("vote_count", { ascending: false }).limit(20),
      admin.from("support_tickets").select("*").eq("record_type", "feature").order("created_at", { ascending: false }).limit(20),
      admin.from("support_tickets").select("*").eq("record_type", "feature").in("roadmap_status", ["released", "in_progress", "planned"]).order("updated_at", { ascending: false }).limit(20),
    ]);

    return json(res, 200, {
      topRequested: (top || []).map((r) => support.mapTicket(r)),
      mostPopular: (popular || []).map((r) => support.mapTicket(r)),
      recentlyReleased: (released || []).filter((r) => r.roadmap_status === "released").map((r) => support.mapTicket(r)),
      roadmap: (released || []).map((r) => support.mapTicket(r)),
    });
  } catch (err) {
    console.error("[support/board]", err);
    return json(res, 500, { error: err.message || "Feature board failed" });
  }
};
