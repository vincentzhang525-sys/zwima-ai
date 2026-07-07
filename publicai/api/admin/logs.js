const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin, parsePaging } = require("./_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const { from, to, page, pageSize } = parsePaging(req, { pageSize: 50 });
    const q = String(req.query?.q || "").trim().toLowerCase();
    const userId = String(req.query?.userId || "").trim();
    const date = String(req.query?.date || "").trim();

    let query = admin.from("audit_logs").select("*").order("created_at", { ascending: false }).range(from, to);
    if (userId) query = query.eq("user_id", userId);
    if (date) query = query.gte("created_at", `${date}T00:00:00.000Z`).lte("created_at", `${date}T23:59:59.999Z`);
    const { data, error } = await query;
    if (error) throw error;
    let rows = (data || []).map((row) => ({
      time: row.created_at,
      provider: row.target,
      user: row.user_id,
      action: row.action,
      detail: row.detail,
      ip: row.ip,
    }));
    if (q) rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
    return json(res, 200, { page, pageSize, rows });
  } catch (err) {
    console.error("[admin/logs]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load logs" });
  }
};
