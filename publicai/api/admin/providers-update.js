const { parseBody, json, handleOptions, withCors, writeAuditLog, getClientIp } = require("../lib/supabase");
const { requireAdmin } = require("./_common");
const providerRuntime = require("../../gateway/providerRuntime.js");
const providerRegistry = require("../../config/providerRegistry.js");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { user } = await requireAdmin(req);
    const body = parseBody(req);
    const providerId = String(body.providerId || "").trim();
    if (!providerId) return json(res, 400, { error: "providerId is required." });
    if (!providerRegistry.getDefinition(providerId)) {
      return json(res, 404, { error: "Unknown provider." });
    }

    const patch = {};
    if (body.enabled !== undefined) patch.enabled = !!body.enabled;
    if (body.priority !== undefined) patch.priority = Number(body.priority) || 99;
    if (body.defaultModel) patch.defaultModel = String(body.defaultModel);

    const updated = providerRuntime.updateProvider(providerId, patch);
    const view = providerRegistry.getById(providerId, { [providerId]: updated });
    await writeAuditLog({
      userId: user.id,
      eventType: "provider",
      action: "provider_updated",
      target: providerId,
      detail: JSON.stringify(patch),
      ip: getClientIp(req),
    });
    return json(res, 200, { success: true, provider: view });
  } catch (err) {
    console.error("[admin/providers-update]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to update provider" });
  }
};
