const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [{ data: payments }, { data: usage }, { data: users }] = await Promise.all([
      admin.from("payments").select("*"),
      admin.from("usage_records").select("*"),
      admin.from("profiles").select("*"),
    ]);
    const totalRevenue = (payments || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const todayRevenue = (payments || [])
      .filter((r) => String(r.created_at || "").slice(0, 10) === today)
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const tokenUsage = (usage || []).reduce((s, r) => s + (Number(r.total_tokens) || 0), 0);
    const apiCalls = Number(usage?.length || 0);
    const apiCost = Number((usage || []).reduce((s, r) => s + (Number(r.estimated_cost) || 0), 0).toFixed(2));
    const grossProfit = Number((totalRevenue - apiCost).toFixed(2));
    const providerUsage = Object.entries(
      (usage || []).reduce((acc, r) => {
        const p = r.provider || "Unknown";
        acc[p] = (acc[p] || 0) + (Number(r.total_tokens) || 0);
        return acc;
      }, {})
    ).map(([provider, tokens]) => ({ provider, tokens }));
    const topCustomers = (users || []).slice(0, 5).map((u) => ({
      name: u.company || u.email,
      revenue: Math.round(totalRevenue / Math.max(1, users.length)),
      credits: 0,
    }));
    const mrr = (payments || [])
      .filter((r) => String(r.created_at || "") >= monthStart)
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return json(res, 200, {
      todayRevenue,
      totalRevenue,
      tokenUsage,
      apiCalls,
      apiCost,
      grossProfit,
      activeUsers: 0,
      newUsers: 0,
      creditsSold: 0,
      mrr,
      arr: mrr * 12,
      providerUsage,
      topCustomers,
    });
  } catch (err) {
    console.error("[admin/statistics]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load statistics" });
  }
};
