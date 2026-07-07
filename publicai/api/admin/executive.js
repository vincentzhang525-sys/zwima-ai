const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function dayStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const dayStart = dayStartIso();
    const monthStart = monthStartIso();

    const [
      { data: users },
      { data: usageAll },
      { data: usageToday },
      { data: usageMonth },
      { data: paymentsMonth },
      { data: txnsTopup },
      { data: txnsUsage },
      { data: sessionsDay },
    ] = await Promise.all([
      admin.from("profiles").select("*"),
      admin.from("usage_records").select("*"),
      admin.from("usage_records").select("*").gte("date_time", dayStart),
      admin.from("usage_records").select("*").gte("date_time", monthStart),
      admin.from("payments").select("*").gte("created_at", monthStart),
      admin.from("credit_transactions").select("*").eq("type", "topup"),
      admin.from("credit_transactions").select("*").eq("type", "usage"),
      admin.from("user_sessions").select("*").gte("last_seen_at", dayStart),
    ]);

    const totalUsers = Number(users?.length || 0);
    const newUsersToday = Number((users || []).filter((u) => String(u.created_at || "").slice(0, 10) === dayStart.slice(0, 10)).length);
    const activeUsers = new Set((sessionsDay || []).map((s) => s.user_id)).size;
    const totalApiRequests = Number(usageAll?.length || 0);
    const todaysRequests = Number(usageToday?.length || 0);
    const monthlyRequests = Number(usageMonth?.length || 0);
    const creditsSold = (txnsTopup || []).reduce((sum, r) => sum + Math.max(0, Number(r.amount || 0)), 0);
    const creditsConsumed = (txnsUsage || []).reduce((sum, r) => sum + Math.abs(Number(r.amount || 0)), 0);
    const mrr = (paymentsMonth || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const estimatedRevenue = mrr;
    const estimatedProviderCost = Number((usageMonth || []).reduce((sum, r) => sum + (Number(r.estimated_cost) || 0), 0).toFixed(2));
    const estimatedGrossProfit = Number((estimatedRevenue - estimatedProviderCost).toFixed(2));

    return json(res, 200, {
      totalUsers,
      newUsersToday,
      activeUsers,
      totalApiRequests,
      todaysRequests,
      monthlyRequests,
      creditsSold,
      creditsConsumed,
      mrr,
      estimatedRevenue,
      estimatedProviderCost,
      estimatedGrossProfit,
      systemHealth: "green",
    });
  } catch (err) {
    console.error("[admin/executive]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load executive metrics" });
  }
};
