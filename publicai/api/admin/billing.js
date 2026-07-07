const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const { data } = await admin.from("payments").select("*").order("created_at", { ascending: false }).limit(100);
    const rows = data || [];
    return json(res, 200, {
      payments: rows.map((p) => ({
        createdAt: p.created_at,
        amountEur: Number(p.amount) || 0,
        credits: Math.round((Number(p.amount) || 0) * 1000),
        status: p.status,
        sessionId: p.id,
      })),
      invoices: rows.map((p) => ({
        id: p.id,
        date: String(p.created_at || "").slice(0, 10),
        amountEur: Number(p.amount) || 0,
        credits: Math.round((Number(p.amount) || 0) * 1000),
        status: p.status,
      })),
    });
  } catch (err) {
    console.error("[admin/billing]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load billing" });
  }
};
