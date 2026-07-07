const { json, handleOptions, withCors } = require("../lib/supabase");
const providerRegistry = require("../../config/providerRegistry.js");
const modelRegistry = require("../../config/modelRegistry.js");
const ProviderAdapters = require("../../gateway/adapters");
const healthChecker = require("../../gateway/healthChecker.js");

const PUBLIC_PROVIDERS = [
  { id: "openai", name: "OpenAI", availability: "live", availabilityLabel: "Live" },
  { id: "google", name: "Google Gemini", availability: "live", availabilityLabel: "Live" },
  { id: "anthropic", name: "Claude", availability: "waiting_api_key", availabilityLabel: "Waiting API Key" },
  { id: "deepseek", name: "DeepSeek", availability: "waiting_balance", availabilityLabel: "Waiting Balance / API Key" },
  { id: "qwen", name: "Qwen", availability: "waiting_api_key", availabilityLabel: "Waiting API Key" },
  { id: "mistral", name: "Mistral", availability: "coming_soon", availabilityLabel: "Coming Soon" },
  { id: "openrouter", name: "OpenRouter", availability: "coming_soon", availabilityLabel: "Coming Soon" },
];

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const results = await Promise.all(
      PUBLIC_PROVIDERS.map(async (def) => {
        let health = "not_configured";
        let healthLabel = "Not configured";
        let latencyMs = 0;
        try {
          const adapterId = providerRegistry.getAdapterId(def.id);
          const adapter = ProviderAdapters.getAdapter(adapterId);
          const configured = providerRegistry.isConfigured(def);
          const check = await healthChecker.checkProvider(adapter, configured);
          health = check.healthStatus;
          healthLabel = healthChecker.label(check.healthStatus);
          latencyMs = check.latencyMs || 0;
        } catch {
          health = "inactive";
          healthLabel = "Inactive";
        }
        const models = modelRegistry.getByProvider(def.id).map((m) => ({
          id: m.id,
          displayName: m.displayName,
          status: m.status,
        }));
        const availability =
          def.availability === "live" && health === "online" ? "live" : def.availability;
        return {
          provider: def.name,
          providerId: def.id,
          health,
          healthLabel,
          latencyMs,
          models,
          modelCount: models.length,
          availability,
          availabilityLabel: def.availabilityLabel,
        };
      })
    );

    const liveCount = results.filter((r) => r.availability === "live").length;
    return json(res, 200, {
      status: liveCount >= 2 ? "operational" : "degraded",
      providers: results,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[status/public]", err);
    return json(res, 500, { error: err.message || "Status check failed" });
  }
};
