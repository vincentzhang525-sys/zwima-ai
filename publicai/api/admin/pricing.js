const { parseBody, json, handleOptions, withCors } = require("../lib/supabase");
const { requireAdmin } = require("./_common");
const modelConfig = require("../../config/models");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  try {
    await requireAdmin(req);
    if (req.method === "GET") {
      const rows = modelConfig.MODELS.map((m) => ({
        id: m.id,
        provider: m.provider,
        model: m.displayName,
        tokenCost: Number(m.inputPrice || 0) / 1_000_000,
        sellPrice: Number(m.outputPrice || 0) / 1_000_000,
        margin: 25,
      }));
      return json(res, 200, rows);
    }
    if (req.method === "POST") {
      parseBody(req);
      return json(res, 200, { success: true });
    }
    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[admin/pricing]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load pricing" });
  }
};
