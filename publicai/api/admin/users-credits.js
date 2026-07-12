const { parseBody, json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");
const ledger = require("../lib/credits/ledger");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin, user: adminUser } = await requireAdmin(req);
    const body = parseBody(req);
    const userId = String(body.userId || "");
    const delta = Number(body.delta || 0);
    const reason = String(body.reason || body.description || "Admin credit adjustment").trim();
    if (!userId || !delta) return json(res, 400, { error: "userId and delta are required" });
    if (!reason) return json(res, 400, { error: "reason is required for manual adjustments" });

    const result = await ledger.creditAtomic(admin, {
      userId,
      amount: delta,
      type: "adjustment",
      description: reason,
      referenceType: "admin_adjustment",
      referenceId: adminUser.id,
      idempotencyKey: body.idempotencyKey || `admin:${adminUser.id}:${userId}:${Date.now()}`,
      actorId: adminUser.id,
      actorType: "admin",
    });

    return json(res, 200, { success: true, balance: result.balance, txnId: result.txnId, alreadyApplied: result.alreadyApplied });
  } catch (err) {
    console.error("[admin/users-credits]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to adjust credits" });
  }
};
