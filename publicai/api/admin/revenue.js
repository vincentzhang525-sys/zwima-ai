const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

function bucket(rows, field, sliceLen) {
  const m = {};
  (rows || []).forEach((row) => {
    const key = String(row[field] || "").slice(0, sliceLen);
    m[key] = (m[key] || 0) + (Number(row.amount) || 0);
  });
  return Object.entries(m)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => ({ x: k, y: Number(v.toFixed(2)) }));
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const [{ data: payments }, { data: usage }, { data: users }, { data: subs }, { data: sold }, { data: used }] = await Promise.all([
      admin.from("payments").select("*").order("created_at", { ascending: true }),
      admin.from("usage_records").select("*").order("date_time", { ascending: true }),
      admin.from("profiles").select("*").order("created_at", { ascending: true }),
      admin.from("subscriptions").select("*"),
      admin.from("credit_transactions").select("*").eq("type", "topup"),
      admin.from("credit_transactions").select("*").eq("type", "usage"),
    ]);
    const revenueByDay = bucket(payments, "created_at", 10);
    const revenueByMonth = bucket(payments, "created_at", 7);
    const providerCostByMonth = Object.entries(
      (usage || []).reduce((acc, row) => {
        const key = String(row.date_time || "").slice(0, 7);
        acc[key] = (acc[key] || 0) + (Number(row.estimated_cost) || 0);
        return acc;
      }, {})
    ).map(([x, y]) => ({ x, y: Number(y.toFixed(2)) }));
    const userGrowth = Object.entries(
      (users || []).reduce((acc, row) => {
        const key = String(row.created_at || "").slice(0, 7);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    ).map(([x, y]) => ({ x, y }));
    const subDist = Object.entries(
      (subs || []).reduce((acc, row) => {
        const key = String(row.plan || "unknown").toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    ).map(([label, value]) => ({ label, value }));

    return json(res, 200, {
      revenueByDay,
      revenueByMonth,
      creditsSold: (sold || []).reduce((s, r) => s + Math.max(0, Number(r.amount || 0)), 0),
      creditsUsed: (used || []).reduce((s, r) => s + Math.abs(Number(r.amount || 0)), 0),
      providerCostByMonth,
      grossProfitByMonth: revenueByMonth.map((r) => {
        const c = providerCostByMonth.find((x) => x.x === r.x)?.y || 0;
        return { x: r.x, y: Number((r.y - c).toFixed(2)) };
      }),
      userGrowth,
      subscriptionDistribution: subDist,
    });
  } catch (err) {
    console.error("[admin/revenue]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load revenue metrics" });
  }
};
