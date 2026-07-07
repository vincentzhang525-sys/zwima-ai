const { json, handleOptions, withCors } = require("../lib/supabase");
const providerRegistry = require("../../config/providerRegistry.js");
const providerRuntime = require("../../gateway/providerRuntime.js");
const ProviderAdapters = require("../../gateway/adapters");
const healthChecker = require("../../gateway/healthChecker.js");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const results = await Promise.all(
      providerRegistry.PROVIDER_DEFS.map(async (def) => {
        const adapterId = providerRegistry.getAdapterId(def.id);
        const adapter = ProviderAdapters.getAdapter(adapterId);
        const configured = providerRegistry.isConfigured(def);
        const check = await healthChecker.checkProvider(adapter, configured);
        providerRuntime.recordHealth(def.id, check);
        const stats = providerRuntime.getStats(def.id);
        return {
          providerId: def.id,
          providerName: def.name,
          healthStatus: check.healthStatus,
          healthLabel: healthChecker.label(check.healthStatus),
          latencyMs: check.latencyMs,
          availability: check.availability,
          configured,
          lastCheck: new Date().toISOString(),
          totalRequests: stats.totalRequests,
          lastRequest: stats.lastRequest,
        };
      })
    );
    return json(res, 200, { providers: results, checkedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[gateway/health]", err);
    return json(res, 500, { error: err.message || "Health check failed" });
  }
};
