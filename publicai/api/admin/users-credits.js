const { parseBody, json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const body = parseBody(req);
    const userId = String(body.userId || "");
    const delta = Number(body.delta || 0);
    if (!userId || !delta) return json(res, 400, { error: "userId and delta are required" });
    const { data: wallet } = await admin.from("credit_wallets").select("*").eq("user_id", userId).maybeSingle();
    const next = (Number(wallet?.balance) || 0) + delta;
    const { error } = await admin.from("credit_wallets").upsert({ user_id: userId, balance: next, currency: "EUR" });
    if (error) throw error;
    await admin.from("credit_transactions").insert({
      user_id: userId,
      type: "adjustment",
      amount: delta,
      description: "Admin credit reset",
      txn_date: new Date().toISOString().slice(0, 10),
      status: "completed",
    });
    return json(res, 200, { success: true, balance: next });
  } catch (err) {
    console.error("[admin/users-credits]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to adjust credits" });
  }
};
