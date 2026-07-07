const { json, handleOptions, withCors } = require("../lib/supabase");
const providerRegistry = require("../../config/providerRegistry.js");
const modelRegistry = require("../../config/modelRegistry.js");
const ProviderAdapters = require("../../gateway/adapters");
const healthChecker = require("../../gateway/healthChecker.js");

const PUBLIC_PROVIDERS = [
  { id: "openai", name: "OpenAI", availability: "live" },
  { id: "google", name: "Google Gemini", availability: "live" },
  { id: "anthropic", name: "Claude", availability: "waiting_api" },
  { id: "deepseek", name: "DeepSeek", availability: "waiting_api" },
  { id: "qwen", name: "Qwen", availability: "waiting_api" },
];

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const results = await Promise.all(
      PUBLIC_PROVIDERS.map(async (def) => {
        const adapterId = providerRegistry.getAdapterId(def.id);
        const adapter = ProviderAdapters.getAdapter(adapterId);
        const configured = providerRegistry.isConfigured(def);
        const check = await healthChecker.checkProvider(adapter, configured);
        const models = modelRegistry.getByProvider(def.id).map((m) => ({
          id: m.id,
          displayName: m.displayName,
          status: m.status,
        }));
        const availability = def.availability === "live" && check.healthStatus === "online" ? "live" : def.availability;
        return {
          provider: def.name,
          providerId: def.id,
          health: check.healthStatus,
          healthLabel: healthChecker.label(check.healthStatus),
          latencyMs: check.latencyMs || 0,
          models,
          modelCount: models.length,
          availability,
          availabilityLabel: availability === "live" ? "Live" : availability === "waiting_api" ? "Waiting API" : "Coming Soon",
        };
      })
    );

    const allOperational = results.filter((r) => r.availability === "live").length;
    return json(res, 200, {
      status: allOperational >= 2 ? "operational" : "degraded",
      providers: results,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[status/public]", err);
    return json(res, 500, { error: err.message || "Status check failed" });
  }
};
