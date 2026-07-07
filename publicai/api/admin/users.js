const { json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin, parsePaging } = require("./_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const { page, pageSize, from, to } = parsePaging(req, { pageSize: 20 });
    const q = String(req.query?.q || "").trim().toLowerCase();
    const role = String(req.query?.role || "").trim();
    const status = String(req.query?.status || "").trim();
    const sort = String(req.query?.sort || "created_at_desc");

    let query = admin.from("profiles").select("*");
    if (q) query = query.or(`email.ilike.%${q}%,company.ilike.%${q}%`);
    if (role) query = query.eq("role", role);
    if (status) query = query.eq("status", status);
    if (sort === "created_at_asc") query = query.order("created_at", { ascending: true });
    else query = query.order("created_at", { ascending: false });
    query = query.range(from, to);

    const { data, error } = await query;
    if (error) throw error;
    const userIds = (data || []).map((u) => u.id);

    const [{ data: wallets }, { data: keys }, { data: usage }, { data: payments }, { data: sessions }, { data: logs }] = await Promise.all([
      admin.from("credit_wallets").select("*").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("api_keys").select("*").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("usage_records").select("*").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("payments").select("*").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("user_sessions").select("*").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("audit_logs").select("*").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const byUser = (rows, k = "user_id") =>
      (rows || []).reduce((acc, row) => {
        const id = row[k];
        if (!acc[id]) acc[id] = [];
        acc[id].push(row);
        return acc;
      }, {});
    const walletsBy = (wallets || []).reduce((acc, row) => ((acc[row.user_id] = row), acc), {});
    const keysBy = byUser(keys);
    const usageBy = byUser(usage);
    const payBy = byUser(payments);
    const sessBy = byUser(sessions);
    const logBy = byUser(logs);

    const users = (data || []).map((u) => {
      const uid = u.id;
      return {
        id: uid,
        name: u.company || u.email,
        email: u.email,
        role: u.role,
        status: u.status,
        credits: Number(walletsBy[uid]?.balance) || 0,
        apiKeys: Number(keysBy[uid]?.length || 0),
        usageRequests: Number(usageBy[uid]?.length || 0),
        billingCount: Number(payBy[uid]?.length || 0),
        loginHistoryCount: Number(sessBy[uid]?.length || 0),
        activityCount: Number(logBy[uid]?.length || 0),
      };
    });

    return json(res, 200, { page, pageSize, users });
  } catch (err) {
    console.error("[admin/users]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load users" });
  }
};
