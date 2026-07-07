const { parseBody, json, handleOptions, withCors, getAdminClient } = require("../lib/supabase");
const { requireAdmin } = require("./_common");
const providerRegistry = require("../../config/providerRegistry.js");
const providerRuntime = require("../../gateway/providerRuntime.js");
const ProviderAdapters = require("../../gateway/adapters");
const healthChecker = require("../../gateway/healthChecker.js");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  try {
    const { admin } = await requireAdmin(req);
    const dayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const { data: usage } = await admin.from("usage_records").select("*").gte("date_time", dayStart);

    const providers = await Promise.all(
      providerRegistry.PROVIDER_DEFS.map(async (def) => {
        const adapter = ProviderAdapters.getAdapter(providerRegistry.getAdapterId(def.id));
        const configured = providerRegistry.isConfigured(def);
        const check = await healthChecker.checkProvider(adapter, configured);
        providerRuntime.recordHealth(def.id, check);
        const runtime = providerRuntime.getRuntimeMap()[def.id] || {};
        const stats = providerRuntime.getStats(def.id);

        const normalized = (usage || []).filter(
          (u) =>
            String(u.provider || "").toLowerCase().includes(def.name.toLowerCase()) ||
            String(u.provider || "").toLowerCase().includes(def.id) ||
            String(u.provider || "").toLowerCase().includes("gateway")
        );
        const dbRequests = normalized.length;
        const creditsUsed = normalized.reduce((sum, u) => sum + (Number(u.credits_deducted) || 0), 0);
        const dbLatency = dbRequests
          ? Math.round(normalized.reduce((sum, u) => sum + (Number(u.request_time_ms) || 0), 0) / dbRequests)
          : 0;
        const lastDb = normalized[0];

        const view = providerRegistry.getById(def.id, { [def.id]: runtime }, { [def.id]: check });
        return {
          id: def.id,
          name: def.name,
          status: check.healthStatus,
          healthLabel: healthChecker.label(check.healthStatus),
          enabled: view.enabled,
          priority: view.priority,
          defaultModel: view.defaultModel,
          latency: check.latencyMs || dbLatency || stats.latencyMs || 0,
          lastRequest: stats.lastRequest || lastDb?.date_time || null,
          totalRequests: Math.max(stats.totalRequests, dbRequests),
          creditsUsed,
          errorCount: check.healthStatus === healthChecker.HEALTH.API_ERROR ? 1 : 0,
          dailyRequests: dbRequests,
          apiKeyStatus: configured ? "Configured" : "Not Configured",
          healthStatus: check.healthStatus,
          lastCheck: new Date().toISOString(),
          configured,
        };
      })
    );

    return json(res, 200, providers);
  } catch (err) {
    console.error("[admin/providers]", err);
    return json(res, err.status || 500, { error: err.message || "Failed to load providers" });
  }
};
